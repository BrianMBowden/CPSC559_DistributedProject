const ws = require('ws');
const portfinder = require("portfinder");

const AWS = require('aws-sdk');

const conf = require('./conf.json');
const awsConf = require('./aws.json');
const automerge = require('automerge');

let socket = null;
let client_id = null;

AWS.config.update(awsConf.aws);
let docClient = new AWS.DynamoDB.DocumentClient();

process.on('message', (incoming) => {
    switch(incoming.action) {
        // MASTER TO SLAVE MESSAGES
        case 'rename_document':
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
                    docClient.get({
                        TableName: 'documents',
                        Key: {
                            DocID: incoming.document_id
                        }
                    }, (err, doc) => {
                        socket.send(JSON.stringify({
                            action: 'load_document',
                            document_id: doc.Item.DocID,
                            document_share_id: doc.Item.DocShareID,
                            title: doc.Item.title,
                            owner: doc.Item.ownr,
                            content: doc.Item.content
                        }));
                    });
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
