const ws = require('ws');
const portfinder = require('ws');
const child_process = require('child_process');

const conf = require('./conf.json');

let Client = function(masterServer, socket) {
    let self = this;

    self.masterServer = masterServer;
    self.socket = socket;
    self.id = null;

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
            default:
                console.log('unknown slave message');
                break;
        }
    });

    self.slave.on('close', () => {
        console.log('Client detached');
    });
};

module.exports = {
    Client: Client
};
