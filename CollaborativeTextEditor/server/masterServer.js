const ws = require("ws");
const portfinder = require("portfinder");
const uuid = require("uuid/v4");
const child_process = require("child_process");
const killPort = require('kill-port');
const fs = require('fs');
const AWS = require('aws-sdk');

const conf = require('./conf.json');
const awsConf = require('./aws.json');
const masterConnection = require('./masterConnection.js');
const client = require('./client.js');
const webserver = require('./webserver.js');

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

    self.masterSocketServer = null;
    self.clientSocketServer = null;

    self.masters = [];

    self.documents = [];

    self.masterDocuments = {};
    self.masterClientPorts = {};

    self.inElection = false;
    self.electionTimer = null;
    self.primaryDied = false;

    self.docClient = null;

    self.outgoingConnections = {};

    self.init = function(cb) {
        console.log('Initializing master with id', self.id, "pid:", process.pid);

        AWS.config.update(awsConf.aws);
        self.docClient = new AWS.DynamoDB.DocumentClient();

        let readyCount = 0;

        // accept connections from clients
        portfinder.getPort((err, port) => {
            if (err) {
                throw err;
            }

            self.clientSocketServerPort = port;
            if (self.masterSocketServerPort) {
                self.masterClientPorts[self.masterSocketServerPort] = self.clientSocketServerPort;
            }

            self.clientSocketServer = new ws.Server({
                port: port
            });

            self.clientSocketServer.on('connection', function connection(ws) {
                let cli = new client.Client(self, ws);
                ws.__client = cli;

                ws.on('close', function() {
                    console.log('Client has disconnected');
                });
            });

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
            if (self.clientSocketServerPort) {
                self.masterClientPorts[self.masterSocketServerPort] = self.clientSocketServerPort;
            }

            self.masterSocketServer = new ws.Server({
                port: port
            });

            self.masterSocketServer.on('connection', function connection(ws) {
                let master = new masterConnection.MasterConnection(self, ws);
                ws.__master = master;

                self.masters.push(master);

                ws.on('close', function() {
                    self.deadMaster(master);
                });
            });

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

    self.electPrimary = function(deadPrimary) {
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
            function cont() {
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

            if (self.deadPrimary) {
                // if the primary died, wait 50ms for someone to announce their victory before calling an election
                self.electionCalled = false;
                setTimeout(function() {
                    if (!self.electionCalled) {
                        cont();
                    }
                }, 50);
            } else {
                cont();
            }
        }
    };

    self.connectToMaster = function(port) {
        if (self.getMasterPorts().indexOf(port) === -1 && !self.outgoingConnections.hasOwnProperty(port)) {
            self.outgoingConnections[port] = true;
            setTimeout(function() {
                delete self.outgoingConnections[port];
            }, 100);
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
                    primary: self.primary,
                    mcPort: self.clientSocketServerPort
                });

                socket.on('close', function() {
                    self.deadMaster(master);
                });
            });
        } else {
            console.warn('Already connected/connecting to master', port);
        }
    };

    self.getBalancedMaster = function() {
        if (self.masters.length === 0) {
            return self.masterSocketServerPort;
        } else {
            for (let master of self.masters) {
                if (!self.documents.hasOwnProperty(master.masterSocketServerPort)) {
                    return master.masterSocketServerPort;
                }
            }

            // all masters have documents
            let min = 0;
            let mmPort = null;
            for (let port in self.documents) {
                if (self.documents[port].length < min) {
                    min = self.documents[port].length;
                    mmPort = port;
                }
            }

            return mmPort;
        }
    }

    self.becomePrimary = function(callback) {
        if (!self.isPrimary) {
            console.log(`Master ${self.id} is becoming primary`);
            self.isPrimary = true;
            self.primary.id = self.id;
            self.primary.mmPort = self.masterSocketServerPort;
            self.primary.updated = Date.now();
            self.broadcastToMasters({
                action: 'SynchronizeRequest'
            });
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
            callback();
        } else {
            let newMastersToCreate = conf.minMasters - self.masters.length - 1;
            console.log('New masters required:', newMastersToCreate);
            // TODO: LOAD BALANCING?
            if (newMastersToCreate > 0) {
                (function trySpawn(i) {
                    if (i < newMastersToCreate) {
                        setTimeout(function() {
                            trySpawn(++i);
                        }, 100);
                        self.spawnMaster();
                    } else {
                        callback();
                    }
                })(0);
            }
        }
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

        if (self.isPrimary) {
            delete self.masterClientPorts[master.masterSocketServerPort];
            delete self.masterDocuments[master.masterSocketServerPort];
        }

        if (master.masterSocketServerPort === self.primary.mmPort) {
            // primary master crashed
            self.primary = {
                id: null,
                mmPort: null,
                updated: Date.now()
            };
            self.electPrimary(true);
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
