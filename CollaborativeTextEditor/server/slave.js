const ws = require('ws');
const portfinder = require("portfinder");

const AWS = require('aws-sdk');

const conf = require('./conf.json');
const awsConf = require('./aws.json');
const automerge = require('automerge');

let socket = null;

AWS.config.update(awsConf.aws);
let docClient = new AWS.DynamoDB.DocumentClient();

process.on('message', (incoming) => {
    switch(incoming.action) {
        // MASTER TO SLAVE MESSAGES
        default:
            console.log('Unknown action', incoming);
            break;
    }
});

portfinder.getPort((err, port) => {
    if (err) {
        throw err;
    }

    socket = new ws.Server({
        port: port
    });

    socket.on('connection', (ws) => {
        ws.on('close', () => {
            process.exit(1);
        });

        ws.on('message', (message) => {
            try {
                var incoming = JSON.parse(message);
            } catch (e) {
                console.log('bad message on slave-client socket', message);
                return;
            }

            switch (incoming.action) {
                // SLAVE TO CLIENT MESSAGES
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
