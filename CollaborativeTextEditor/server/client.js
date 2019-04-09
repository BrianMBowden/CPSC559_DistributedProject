/**
 * @file client.js
 * @overview Logic for talking to a client on the master-client connection
 */

const ws = require('ws');
const child_process = require('child_process');
const Automerge = require('automerge');
const uuid = require('uuid/v4');

const conf = require('./conf.json');

/**
 * Logic for talking to a client on the master-client socket
 * @class Client
 * @memberof client
 * @param {masterServer.MasterServer} masterServer - the server that owns this client
 * @param {WebSocket} socket - the socket the client is attached to
 */
let Client = function(masterServer, socket) {
    // capture context
    let self = this;

    self.masterServer = masterServer; // the master that owns this client
    self.socket = socket; // the socket the client is connected to
    self.id = null; // the id of the client
    self._thisClient = uuid(); // the instance id unique to this connection
    self.document = null; // the document this client is looking at
    self.document_share_id = null; // the document's ShareID
    self.document_title = null; // the document's title
    self.document_owner = null; // the client that owns this document

    self.crdt = null; // the Automerge instance containing this document
    self.pendingChanges = false; // true if this document has pending changes

    console.log(`Client connected to master`);

    // immediately create a slave server to handle this client
    self.slave = child_process.fork('./slave.js');

    // fires every time we get data from the slave
    self.slave.on('message', function(incoming) {
        console.log('[slave<<]', incoming);
        switch (incoming.action) {
            // SLAVE TO MASTER MESSAGES
            case 'SlaveReady':
                /*  Sent when the slave has created it's client socket and is ready to receive the client
                    {
                        "action": "SlaveReady",
                        "port": the port the slave is listening on
                    }
                */

                // tell the client where to connect to next, and kill the socket
                self.socket.send(JSON.stringify({
                    action: 'ClientHello',
                    port: incoming.port
                }));
                self.socket.close();
                break;
            case 'ClientInformation':
                /*  Sent when the client has established it's connection with the slave
                    {
                        "action": "ClientInformation",
                        "client_id": "the client's id"
                    }
                */
                self.id = incoming.client_id;
                break;
            case 'rename':
                /*  Sent when the client would like to rename a document
                    {
                        "action": "rename",
                        "document_id": "the id of the document to rename",
                        "new_doc_name": "the new title of the document"
                    }
                */
                self.masterServer.docClient.update({
                    TableName: 'documents',
                    Key: {
                        'DocID': incoming.document_id
                    },
                    UpdateExpression: 'set title = :t',
                    ExpressionAttributeValues: {
                        ':t': incoming.new_doc_name
                    }
                }, (err) => {
                    if (err) {
                        // db failure?
                        console.log(err);
                    } else {
                        for (let client of self.masterServer.clients) {
                            if (client.document == self.document) {
                                client.document_title = incoming.new_doc_name;
                            }
                            // send every slave the new name
                            client.slave.send({
                                action: 'rename_document',
                                document_id: incoming.document_id,
                                new_doc_name: incoming.new_doc_name
                            });
                        }
                    }
                });
                break;
            case 'open_document':
                /* Sent when a client would like to open a document
                    {
                        "action": "open_document",
                        "client_id": "the client id of the client opening this document",
                        "document_id": "the document that the client wants to open"
                    }
                */

                // check if the document is already open in the master
                let exists = false;
                for (let client of self.masterServer.clients) {
                    if (client.document === incoming.document_id) {
                        // the document is already open - use the existing state
                        self.slave.send({
                            action: 'document_already_open',
                            crdt: Automerge.save(client.crdt),
                            originalRequest: incoming,
                            document_id: client.document_id,
                            document_share_id: client.document_share_id,
                            title: client.document_title,
                            ownr: client.document_owner
                        });
                        self.document = client.document;
                        self.document_share_id = client.document_share_id;
                        self.document_title = client.document_title;
                        self.document_owner = client.document_owner;
                        self.crdt = client.crdt;
                        exists = true;
                        break;
                    }
                }

                // open the document from the db
                if (!exists) {
                    incoming.action = 'actually_open_document';
                    self.slave.send(incoming);
                }
                break;
            case 'AddDocumentResponsibility':
                /*  Sent when this master should add a document to it's document list
                    {
                        "action": "AddDocumentResponsibility",
                        "document_id": "the id of the document to add",
                        "title": "the document's title",
                        "owner": "the client ID of the client that owns the document",
                        "crdt": "the serialized Automerge instance of the document",
                    }
                */
                self.document = incoming.document_id;
                self.document_share_id = incoming.document_share_id;
                self.document_title = incoming.title;
                self.document_owner = incoming.owner;
                self.crdt = Automerge.load(incoming.crdt);

                // if the master doesn't already have this document, it should load it
                if (self.masterServer.documents.indexOf(incoming.document_id) === -1) {
                    self.masterServer.documents.push(incoming.document_id);
                }
                break;
            case 'insert':
                /*  Sent when the client wants to insert stuff into the document
                    {
                        "action": "insert",
                        "client_id": "the client's id",
                        "document_id": "the id of the document to insert into",
                        "payload": {
                            "data_type": "text",
                            "offset": "document offset",
                            "length": "length of text to insert",
                            "data": "the text to insert"
                        }
                    }
                */
                let newDoc = Automerge.change(self.crdt, doc => {
                    doc.text.insertAt(incoming.payload.offset, incoming.payload.data);
                });
                let changes = Automerge.getChanges(self.crdt, newDoc);

                // propogate changes to all clients
                for (let client of self.masterServer.clients) {
                    if (client.document === self.document) {
                        client.crdt = Automerge.applyChanges(client.crdt, changes);
                        if (client._thisClient !== self._thisClient) {
                            client.slave.send({
                                action: 'update_document',
                                content: client.crdt.text.join('')
                            });
                        }
                    }
                }

                self.pendingChanges = true;
                break;
            case 'delete':
                /*  Sent when the client wants to delete stuff in the document
                    {
                        "action": "delete",
                        "client_id": "the client's id",
                        "document_id": "the id of the document to delete in",
                        "payload": {
                            "data_type": "text",
                            "offset": "document offset",
                            "length": "length of text to delete",
                            "data": "the text to delete"
                        }
                    }
                */
                let newDoc2 = Automerge.change(self.crdt, doc => {
                    doc.text.deleteAt(incoming.payload.offset);
                });
                let changes2 = Automerge.getChanges(self.crdt, newDoc2);

                // propogate changes to all clients
                for (let client of self.masterServer.clients) {
                    if (client.document === self.document) {
                        client.crdt = Automerge.applyChanges(client.crdt, changes2);
                        if (client._thisClient !== self._thisClient) {
                            client.slave.send({
                                action: 'update_document',
                                content: client.crdt.text.join('')
                            });
                        }
                    }
                }

                self.pendingChanges = true;
                break;
            case 'cursor_change':
                /*  Sent when the client's cursor has changed
                    {
                        "action": "cursor_change",
                        "client_id": "the client that changed their cursor",
                        "client_instance": "the unique identifier of the client instance that changed their cursor",
                        "client_username": "the username of the client that changed their cursor",
                        "cursor": "the Quill.Range representing the new cursor"
                    }
                */

                // propogate this new cursor to every other client
                for (let client of self.masterServer.clients) {
                    if (client.document === self.document) {
                        if (client._thisClient !== self._thisClient) {
                            client.slave.send({
                                action: 'update_cursor',
                                client_id: incoming.client_id,
                                client_username: incoming.client_username,
                                client_instance: incoming.client_instance,
                                cursor: incoming.cursor
                            });
                        }
                    }
                }
                break;
            default:
                console.log('unknown slave message');
                break;
        }
    });

    // fired when the slave goes down
    self.slave.on('close', () => {
        // save the document again
        if (self.pendingChanges) {
            self.masterServer.saveDocument(self.document, self.crdt, (err) => {
                if (err) {
                    console.log(err);
                }
            });
        }
        // handle the dead connection
        self.masterServer.deadClient(self._thisClient);
    });
};

/**
 * @namespace client
 */
module.exports = {
    Client: Client
};
