const ws = require('ws');
const portfinder = require('ws');
const child_process = require('child_process');
const Automerge = require('automerge');
const uuid = require('uuid/v4');

const conf = require('./conf.json');

let Client = function(masterServer, socket) {
    let self = this;

    self.masterServer = masterServer;
    self.socket = socket;
    self.id = null;
    self._thisClient = uuid();
    self.document = null;
    self.document_share_id = null;
    self.document_title = null;
    self.document_owner = null;

    self.crdt = null;
    self.pendingChanges = false;

    console.log(`Client connected to master`);

    self.slave = child_process.fork('./slave.js');

    self.slave.on('message', function(incoming) {
        console.log('[slave<<]', incoming);
        switch (incoming.action) {
            // SLAVE TO MASTER MESSAGES
            case 'SlaveReady':
                self.socket.send(JSON.stringify({
                    action: 'ClientHello',
                    port: incoming.port
                }));
                self.socket.close();
                break;
            case 'ClientInformation':
                self.id = incoming.client_id;
                break;
            case 'rename':
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
                let exists = false;
                for (let client of self.masterServer.clients) {
                    if (client.document === incoming.document_id) {
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

                if (!exists) {
                    incoming.action = 'actually_open_document';
                    self.slave.send(incoming);
                }
                break;
            case 'AddDocumentResponsibility':
                self.document = incoming.document_id;
                self.document_share_id = incoming.document_share_id;
                self.document_title = incoming.title;
                self.document_owner = incoming.owner;
                self.crdt = Automerge.load(incoming.crdt);
                if (self.masterServer.documents.indexOf(incoming.document_id) === -1) {
                    self.masterServer.documents.push(incoming.document_id);
                }
                break;
            case 'insert':
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
            default:
                console.log('unknown slave message');
                break;
        }
    });

    self.slave.on('close', () => {
        self.masterServer.deadClient(self._thisClient);
    });
};

module.exports = {
    Client: Client
};
