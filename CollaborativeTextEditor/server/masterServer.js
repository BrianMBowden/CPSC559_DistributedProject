const ws = require("ws");
const portfinder = require("portfinder");
const uuid = require("uuid/v4");
const child_process = require("child_process");

const conf = require('./conf.json');
const masterConnection = require('./masterConnection.js');
const client = require('./client.js');
const webserver = require('./webserver.js');

function noop() {}

function heartbeat() {
    this.isAlive = true;
}

let MasterServer = function() {
    let self = this;

    self.id = uuid();
    self.isPrimary = null;
    self.webServer = null;

    self.primary = {
        id: null,
        mmPort: null
    };

    self.clientSocketServerPort = null;
    self.masterSocketServerPort = null;

    self.clientSocketServer = null;
    self.masterSocketServer = null;
    self.clientInitialSocketServer = null;

    self.masters = [];
    self.clients = [];

    self.init = function(cb) {
        console.log('Initializing master with id', self.id);
        let readyCount = 0;
        // accept connections from clients
        portfinder.getPort((err, port) => {
            if (err) {
                throw err;
            }

            self.clientSocketServerPort = port;

            self.clientSocketServer = new ws.Server({
                port: port
            });

            self.clientSocketServer.on('connection', function connection(ws) {
                ws.isalive = true;
                ws.on('pong', heartbeat);

                let client = new client.Client(self, ws);
                ws.__client = client;

                self.clients.push(client);

                ws.on('close', function() {
                    self.deadClient(client);
                });
            });

            setInterval(function ping() {
                self.clientSocketServer.clients.forEach(function each(ws) {
                    if (ws.isAlive === false) {
                        // connection is dead
                        self.deadClient(ws.__client);
                    }
                    ws.isAlive = false();
                    ws.ping(noop);
                });
            }, conf.heartbeatInterval);

            console.log(`Client socket server running on ${port}`);
            readyCount++;
            if (readyCount == 2) {
                cb();
            }
        });

        // accept connections from masters
        portfinder.getPort((err, port) => {
            if (err) {
                throw err;
            }

            self.masterSocketServerPort = port;

            self.masterSocketServer = new ws.Server({
                port: port
            });

            self.masterSocketServer.on('connection', function connection(ws) {
                ws.isalive = true;
                ws.on('pong', heartbeat);

                let master = new masterConnection.MasterConnection(self, ws);
                ws.__master = master;

                self.masters.push(master);

                ws.on('close', function() {
                    self.deadMaster(master);
                });
            });

            setInterval(function ping() {
                self.clientSocketServer.clients.forEach(function each(ws) {
                    if (ws.isAlive === false) {
                        // connection is dead
                        self.deadMaster(ws.__master);
                    }
                    ws.isAlive = false();
                    ws.ping(noop);
                });
            }, conf.heartbeatInterval);

            console.log(`Master socket server running on ${port}`);
            readyCount++;
            if (readyCount == 2) {
                cb();
            }
        });
    }

    self.processMasterPorts = function(ports) {
        for (let port of ports) {
            if (port === self.masterSocketServerPort) {
                continue;
            }
            let connected = false;
            for (let master of self.masters) {
                if (port === master.masterSocketServerPort) {
                    connected = true;
                    break;
                }
            }
            if (connected) {
                continue;
            }
            // this is a new master!
            self.connectToMaster(port);
        }
    }

    self.connectToMaster = function(port) {
        let socket = new ws(`ws://localhost:${port}`);
        socket.on('open', function() {
            let master = new masterConnection.MasterConnection(self, socket);
            master.masterSocketServerPort = port;
            socket.__master = master;
            self.masters.push(master);
            master.sentHello = true;
            master.send({
                action: 'MasterHello',
                masters: self.getMasterPorts(),
                myPort: self.masterSocketServerPort,
                primary: self.primary
            });

            socket.on('close', function() {
                self.deadMaster(master);
            });
        });
    };

    self.becomePrimary = function(callback) {
        console.log(`Master ${self.id} is becoming primary`);
        self.isPrimary = true;
        self.primary.id = self.id;
        self.primary.mmPort = self.masterSocketServerPort;
        self.primary.updated = Date.now();
        self.launchWebServer(() => {
            self.createMasterIfRequired(callback);
        });
    };

    self.launchWebServer = function(callback) {
        webserver.init(self, callback);
    };

    self.broadcastToMasters = function(msg) {
        for (let master of self.masters) {
            master.send(msg);
        }
    };

    self.createMasterIfRequired = function(callback) {
        if (!self.isPrimary) {
            console.warn('Cannot spawn new masters if I am not the primary!');
        } else {
            let newMastersToCreate = conf.minMasters - self.masters.length - 1;
            // TODO: LOAD BALANCING?
            if (newMastersToCreate > 0) {
                for (let i = 0; i < newMastersToCreate; i++) {
                    self.spawnMaster();
                }
            }
        }
        callback();
    };

    self.spawnMaster = function() {
        masterPorts = self.getMasterPorts().join(',');
        console.log('Sharing master ports with new master: ' + masterPorts);
        let child = child_process.spawn('node', [
            'server.js',
            '--action', 'join',
            '--peers', masterPorts
        ], {
            detached: true,
            stdio: [
                'ignore',
                'ignore',
                'ignore'
            ]
        });
        child.unref();
    }

    self.getMasterPorts = function() {
        let masterPorts = new Set();
        masterPorts.add(self.masterSocketServerPort);

        for (let master of self.masters) {
            if (master.masterSocketServerPort) {
                masterPorts.add(master.masterSocketServerPort);
            } else {
                console.warn('cannot share master port!', master.masterSocketServerPort);
            }
        }

        return Array.from(masterPorts);
    }

    self.deadClient = function(client) {
        console.log(`client ${client.id} has died`);
        client.socket.terminate();
        for (let i = 0; i < self.clients.length; i++) {
            if (self.clients[i] === client) {
                self.clients.splice(0, 1);
                delete client;
                break;
            }
        }
    };

    self.deadMaster = function(master) {
        console.log(`master ${master.masterSocketServerPort} has died`);
        master.socket.terminate();
        for (let i = 0; i < self.masters.length; i++) {
            if (self.masters[i] === master) {
                self.masters.splice(0, 1);
                delete master;
                break;
            }
        }
    };
};

function createNewMasterServer(options, callback) {
    let master = new MasterServer();

    master.init(function() {
        if (options.primary) {
            master.becomePrimary(() => {
                callback(master);
            });
        } else {
            for (let port of options.masterPorts) {
                master.connectToMaster(port);
            }
            callback(master);
        }
    });
};

module.exports = {
    MasterServer: MasterServer,
    createNewMasterServer: createNewMasterServer
};
