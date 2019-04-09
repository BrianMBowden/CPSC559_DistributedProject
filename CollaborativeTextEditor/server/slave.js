/**
 * @file slave.js
 * @overview slave server logic
 */

const ws = require('ws');
const getPort = require('get-port');

const AWS = require('aws-sdk');

const conf = require('./conf.json');
const awsConf = require('./aws.json');
const Automerge = require('automerge');

let socket = null; // the slave-client socket
let client_id = null; // the connected client's ID

// connect to the database
AWS.config.update(awsConf.aws);
let docClient = new AWS.DynamoDB.DocumentClient();

// fires on every message from the master that controls this slave
process.on('message', (incoming) => {
    console.log('master>slave', incoming);

    switch(incoming.action) {
        // MASTER TO SLAVE MESSAGES
        case 'rename_document':
            /*  Sent when another client has renamed a document
                {
                    "action": "rename_document",
                    "document_id": "the DocID of the document that got renamed",
                    "new_doc_name": "the new document title"
                }
            */

            // forward this as-is to the client
            socket.send(JSON.stringify(incoming));
            break;
        case 'actually_open_document':
            /*  Sent when the client has requested to open a document and no other clients have it open already
                {
                    "action: "actually_open_document",
                    "client_id": "the id of the client opening this document",
                    "document_id": "the id of the document to open"
                }
            */

            // grab the document from the db
            docClient.get({
                TableName: 'documents',
                Key: {
                    DocID: incoming.document_id
                }
            }, (err, doc) => {
                if (doc && doc.Item) {
                    // un-serialize the document
                    let crdt = Automerge.load(doc.Item.content);

                    // send our master this document id so that they know they are responsible for it
                    process.send({
                        action: 'AddDocumentResponsibility',
                        document_id: doc.Item.DocID,
                        document_share_id: doc.Item.DocShareID,
                        title: doc.Item.title,
                        owner: doc.Item.ownr,
                        crdt: doc.Item.content
                    });

                    // send the client the document
                    socket.send(JSON.stringify({
                        action: 'load_document',
                        document_id: doc.Item.DocID,
                        document_share_id: doc.Item.DocShareID,
                        title: doc.Item.title,
                        owner: doc.Item.ownr,
                        content: crdt.text.join('')
                    }));
                } else {
                    // the document ID is not in the db
                    socket.send(JSON.stringify({
                        action: 'dialog',
                        title: 'Document not found!',
                        content: 'The document you were looking for could not be located.'
                    }));
                }
            });
            break;
        case 'document_already_open':
            /*  Sent when the client tried to open a document and it was already open in another client
                {
                    "action": "document_already_open",
                    "crdt": "the serialized document contents",
                    "originalRequest": {
                        "action": "open_document",
                        "client_id": "the client id of the client opening this document",
                        "document_id": "the document that the client wants to open"
                    },
                    "document_id": "the document that the client wants to open",
                    "document_share_id": "the ShareID of the document",
                    "title": "the title of the document",
                    "ownr": "the client_id that owns this document"
                }
            */

            // send the document to the client
            socket.send(JSON.stringify({
                action: 'load_document',
                document_id: incoming.document_id,
                document_share_id: incoming.document_share_id,
                title: incoming.title,
                owner: incoming.ownr,
                content: Automerge.load(incoming.crdt).text.join('')
            }));
            break;
        case 'update_document':
            /* Sent when the document has been updated
                {
                    "action": "update_document",
                    "content": "string with the new document document"
                }
            */

            // just forward this to the client
            socket.send(JSON.stringify(incoming));
            break;
        case 'update_cursor':
            /* Sent when a client (not this client) had a cursor update
                {
                    "action": "update_cursor",
                    "client_instance": "typeit._instance of the client that sent the update",
                    "client_username": "the username of the client that updated their cursor"
                    "cursor": Quill.Range
                }
            */

            // just forward this to the client
            socket.send(JSON.stringify(incoming));
            break;
        default:
            console.log('Unknown action', incoming);
            break;
    }
});

// start up the slave-client socket
getPort().then(function(port) {
    let sock = new ws.Server({
        port: port
    });

    // fires when the client connects
    sock.on('connection', (ws) => {
        socket = ws;

        // fires when the client goes away
        socket.on('close', () => {
            console.log('client went away. Killing slave');
            process.exit(1);
        });

        // fires when the client sends us a message
        socket.on('message', (message) => {
            // the message should be serialized JSON - if it isn't then print a warning and discard the message
            try {
                var incoming = JSON.parse(message);
            } catch (e) {
                console.log('bad message on slave-client socket', message);
                return;
            }

            // only log these messages when they're not pings because that gets way too spammy
            if (incoming.action !== 'ping') {
                console.log(`[client<<]`, incoming);
            }

            switch (incoming.action) {
                // SLAVE TO CLIENT MESSAGES
                case 'ClientInformation':
                    /*  Sent when a client is first connecting to this slave
                        {
                            "action": "ClientInformation",
                            "client_id": "the id of the client"
                        }
                    */
                    client_id = incoming.client_id;

                    // forward this to the master
                    process.send(incoming);
                    break;
                case 'rename':
                    /*  Sent when a client wants to rename a document
                        {
                            "action": "rename",
                            "client_id": "the id of the client",
                            "document_id": "the id of the document to rename",
                            "new_doc_name": "the new title of the document"
                        }
                    */

                    // write request - forward this to the master
                    process.send(incoming);
                    break;
                case 'open_document':
                    /*  Sent when the client wants to open a document
                        {
                            "action": "open_document",
                            "client_id": "this id of the client",
                            "document_id": "the id of the document to open"
                        }
                    */

                    // forward to master
                    process.send(incoming);
                    break;
                case 'insert':
                    /*  Sent when the client wants to insert a character in the document
                        {
                            "action": "insert",
                            "client_id": "the id of the client",
                            "document_id": "the document to insert the character in",
                            "payload": {
                                "data_type": "text",
                                "offset": "the offset in the document to insert in",
                                "length": the length of the text being inserted,
                                "data": the actual text to insert
                            }
                        }
                    */

                    // write request - forward to master
                    process.send(incoming);
                    break;
                case 'delete':
                    /*  Sent when the client wants to insert a character in the document
                        {
                            "action": "delete",
                            "client_id": "the id of the client",
                            "document_id": "the document to delete the character in",
                            "payload": {
                                "data_type": "text",
                                "offset": "the offset in the document to delete at",
                                "length": the length of the text being deleted,
                                "data": the actual text to delete
                            }
                        }
                    */

                    // write request - forward to master
                    process.send(incoming);
                    break;
                case 'cursor_change':
                    /*  Sent when the client's cursor has changed
                        {
                            "action": "cursor_change",
                            "client_id": "the id of the client",
                            "client_username": "the username of the client",
                            "client_instance": "the instance ID of the client",
                            "cursor": "a Quill.Range representing the new cursor position"
                        }
                    */

                    // this should be sent to all clients with this document open, so forward it to the master
                    process.send(incoming);
                    break;
                case 'ping':
                    /* Sent as a keep-alive between the client and slave
                        {
                            "action": "ping"
                        }
                    */
                    socket.send(JSON.stringify({
                        action: 'pong'
                    }));
                    break;
                default:
                    console.log('unknown action on slave-client socket', incoming.action);
                    break;
            }
        });
    });

    // now that the socket is ready, tell the master that we can receive a client
    process.send({
        action: 'SlaveReady',
        port: port
    });
});
