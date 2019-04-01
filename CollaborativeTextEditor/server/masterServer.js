const ws = require("ws");
const portfinder = require("portfinder");
const uuid = require("uuid/v4");
const child_process = require("child_process");
const killPort = require('kill-port');
const fs = require('fs');

const conf = require('./conf.json');
const masterConnection = require('./masterConnection.js');
const client = require('./client.js');
const webserver = require('./webserver.js');

function noop() {}

function heartbeat() {
    this.isAlive = true;
}

let propogateLog;

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

    self.documents = [];

    self.inElection = false;
    self.electionTimer = null;

    self.init = function(cb) {
        console.log('Initializing master with id', self.id, "pid:", process.pid);
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

        setTimeout(function() {
            // if we don't know who the primary is within 1s, call an election
            if (!self.primary.id) {
                self.electPrimary();
            }
        }, 1000);
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
    };

    self.electPrimary = function() {
        self.inElection = true;
        let ports = self.getMasterPorts();
        ports.sort();
        if (self.masterSocketServerPort === ports[ports.length - 1]) {
            // we are the new leader
            self.broadcastToMasters({
                action: 'ElectionVictory',
                id: self.id,
                mmPort: self.masterSocketServerPort,
                updated: Date.now()
            });
            self.inElection = false;
            self.becomePrimary((err) => {
                if (err) {
                    throw err;
                }
            });
        } else {
            let sentMessage = false;
            for (let master of self.masters) {
                if (master.masterSocketServerPort > self.masterSocketServerPort) {
                    master.send({
                        action: 'CallElection'
                    });
                    sentMessage = true;
                }
            }
            if (sentMessage) {
                self.electionTimer = setTimeout(function() {
                    // there were no answers. I am the victor
                    self.broadcastToMasters({
                        action: 'ElectionVictory',
                        id: self.id,
                        mmPort: self.masterSocketServerPort,
                        updated: Date.now()
                    });
                    self.inElection = false;
                    self.becomePrimary((err) => {
                        if (err) {
                            throw err;
                        }
                    });
                }, conf.electionWaitTime);
            }
        }
    };

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
        if (!self.isPrimary) {
            console.log(`Master ${self.id} is becoming primary`);
            self.isPrimary = true;
            self.primary.id = self.id;
            self.primary.mmPort = self.masterSocketServerPort;
            self.primary.updated = Date.now();
            killPort(conf.primaryPort).then(() => {
                self.launchWebServer(() => {
                    self.createMasterIfRequired(callback);
                });
            });
        } else {
            console.log('Already the primary');
        }
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
        let options = [
            'server.js',
            '--action', 'join',
            '--peers', masterPorts
        ];
        if (propogateLog) {
            options.push('--log');
        }
        let child = child_process.spawn('node', options, {
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
            if (self.masters[i].masterSocketServerPort === master.masterSocketServerPort) {
                self.masters.splice(i, 1);
                delete master;
                break;
            }
        }

        if (master.masterSocketServerPort === self.primary.mmPort) {
            // primary master crashed
            self.primary = {
                id: null,
                mmPort: null,
                updated: Date.now()
            };
            setTimeout(function() {
                self.electPrimary();
            }, 100);
        } else if (self.isPrimary) {
            self.createMasterIfRequired(() => {
                // ok
            });
        }
    };
};

function createNewMasterServer(options, callback) {
    let master = new MasterServer();

    propogateLog = options.log;
    if (options.log) {
        let logStream = fs.createWriteStream(`./log/${master.id}.log`);

        let oStdoutWrite = process.stdout.write;
        let oStderrWrite = process.stderr.write;

        function nStdoutWrite () {
            oStdoutWrite.apply(process.stdout, arguments);
            logStream.write.apply(logStream, arguments);
        }
        function nStderrWrite () {
            oStderrWrite.apply(process.stderr, arguments);
            logStream.write.apply(logStream, arguments);
        }
        process.stdout.write = nStdoutWrite;
        process.stderr.write = nStderrWrite;
    }

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
