const ws = require('ws');
const portfinder = require('ws');
const child_process = require('child_process');

const conf = require('./conf.json');

let Client = function(masterServer, socket) {
    let self = this;

    self.masterServer = masterServer;
    self.socket = socket;
    self.id = null;
    self.document = null;

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
                            client.slave.send({
                                action: 'rename_document',
                                document_id: incoming.document_id,
                                new_doc_name: incoming.new_doc_name
                            });
                        }
                    }
                });
                break;
            default:
                console.log('unknown slave message');
                break;
        }
    });

    self.slave.on('close', () => {
        self.masterServer.deadClient(self.id);
    });
};

module.exports = {
    Client: Client
};
