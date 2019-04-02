const ws = require('ws');
const portfinder = require("portfinder");

const AWS = require('aws-sdk');

const conf = require('./conf.json');
const awsConf = require('./aws.json');
const Automerge = require('automerge');

let socket = null;
let client_id = null;

AWS.config.update(awsConf.aws);
let docClient = new AWS.DynamoDB.DocumentClient();

process.on('message', (incoming) => {
    console.log('master>slave', incoming);
    switch(incoming.action) {
        // MASTER TO SLAVE MESSAGES
        case 'rename_document':
            socket.send(JSON.stringify(incoming));
            break;
        case 'actually_open_document':
            docClient.get({
                TableName: 'documents',
                Key: {
                    DocID: incoming.document_id
                }
            }, (err, doc) => {
                if (doc && doc.Item) {
                    let crdt = Automerge.load(doc.Item.content);
                    process.send({
                        action: 'AddDocumentResponsibility',
                        document_id: doc.Item.DocID,
                        document_share_id: doc.Item.DocShareID,
                        title: doc.Item.title,
                        owner: doc.Item.ownr,
                        crdt: doc.Item.content
                    });
                    socket.send(JSON.stringify({
                        action: 'load_document',
                        document_id: doc.Item.DocID,
                        document_share_id: doc.Item.DocShareID,
                        title: doc.Item.title,
                        owner: doc.Item.ownr,
                        content: crdt.text.join('')
                    }));
                } else {
                    socket.send(JSON.stringify({
                        action: 'dialog',
                        title: 'Document not found!',
                        content: 'The document you were looking for could not be located.'
                    }));
                }
            });
            break;
        case 'document_already_open':
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
            socket.send(JSON.stringify(incoming));
            break;
        default:
            console.log('Unknown action', incoming);
            break;
    }
});

portfinder.getPort((err, port) => {
    if (err) {
        throw err;
    }

    let sock = new ws.Server({
        port: port
    });

    sock.on('connection', (ws) => {
        socket = ws;
        socket.on('close', () => {
            console.log('client went away. Killing slave');
            process.exit(1);
        });

        socket.on('message', (message) => {
            try {
                var incoming = JSON.parse(message);
            } catch (e) {
                console.log('bad message on slave-client socket', message);
                return;
            }

            if (incoming.action !== 'ping') {
                console.log(`[client<<]`, incoming);
            }

            switch (incoming.action) {
                // SLAVE TO CLIENT MESSAGES
                case 'ClientInformation':
                    client_id = incoming.client_id;
                    process.send(incoming);
                    break;
                case 'rename':
                    // write request - goes through master
                    process.send(incoming);
                    break;
                case 'open_document':
                    process.send(incoming);
                    break;
                case 'insert':
                case 'delete':
                    process.send(incoming);
                    break;
                case 'ping':
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

    process.send({
        action: 'SlaveReady',
        port: port
    });
});
