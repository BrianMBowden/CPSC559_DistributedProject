/**
 * @file masterServer.js
 * @overview Logic for running a master server
 */
const ws = require("ws");
const getPort = require("get-port");
const uuid = require("uuid/v4");
const child_process = require("child_process");
const killPort = require('kill-port');
const fs = require('fs');
const AWS = require('aws-sdk');
const Automerge = require('automerge');

const conf = require('./conf.json');
const awsConf = require('./aws.json');
const masterConnection = require('./masterConnection.js');
const client = require('./client.js');
const webserver = require('./webserver.js');

// if this master was supposed to --log, any masters created when this master
// is a primary should also --log
let propogateLog;

/**
 * logic for encapsulating and running a master server
 * @class MasterServer
 * @memberof masterServer
 */
let MasterServer = function() {
    // capture context
    let self = this;

    self.id = uuid(); // unique identifier for this master server
    self.isPrimary = null; // whether or not this master is a primary master
    self.webServer = null; // in the primary master, this is a reference to the client connection point

    // metadata about the current primary
    self.primary = {
        id: null,
        mmPort: null,
        updated: Date.now()
    };

    self.clientSocketServerPort = null; // port that the client socket is running on
    self.masterSocketServerPort = null; // port that the master socket is running on

    self.masterSocketServer = null; // master socket
    self.clientSocketServer = null; // client socket

    self.masters = []; // all masters we know about -- each is an instance of MasterConnection
    self.clients = []; // all clients we are handling -- each is an instance of Client

    self.documents = []; // all documents we are handling, each is the document's DocID

    // in the primary master, this is a map of master socket ports to arrays of DocIDs handled by that master
    // if a master with a master socket running on port 8001 is responsible for document '57a87985-6178-4460-9e96-d78be21d6710',
    // {
    //     8001: ['57a87985-6178-4460-9e96-d78be21d6710', ...],
    //     ...
    // }
    self.masterDocuments = {};

    // in the primary master, this is a map of master socket ports to client socket ports
    // if a master with a master socket running on port 8001 has a client socket running on 8002,
    // {
    //     8001: 8002
    // }
    self.masterClientPorts = {};

    self.inElection = false; // if there is currently an election going on
    self.electionCalled = false; // if another master has called an election
    self.electionTimer = null; // the setTimeout for sending a CallElection message and delcaring the victor
    self.primaryDied = false; // if the primary has died

    self.docClient = null; // the database connection

    // a map of ports of masters that are being connected to/connecting, to prevent connecting to a master twice
    // if we are currently connecting to port 8001, but have yet to put that connection in self.masters
    // {
    //      8001: true
    // }
    self.outgoingConnections = {};

    /**
     * Master initialization
     * @function init
     * @memberof masterServer.MasterServer
     * @callback cb - a callback taking nothing
     */
    self.init = function(cb) {
        console.log('Initializing master with id', self.id, "pid:", process.pid);

        // initialize database
        AWS.config.update(awsConf.aws);
        self.docClient = new AWS.DynamoDB.DocumentClient();

        // we're going to spawn the master and client sockets simultaneously for speed, so this will let us know when
        // all the asynchronous operations are done
        let readyCount = 0;

        // accept connections from clients
        getPort().then(function(port) {
            self.clientSocketServerPort = port;

            // if the master socket spawned first, then populate the client port
            if (self.masterSocketServerPort) {
                self.masterClientPorts[self.masterSocketServerPort] = self.clientSocketServerPort;
            }

            self.clientSocketServer = new ws.Server({
                port: port
            });

            // fires on every new connection on the socket
            self.clientSocketServer.on('connection', function connection(ws) {
                let cli = new client.Client(self, ws);
                ws.__client = cli;

                self.clients.push(cli);

                // fires when the client goes away
                ws.on('close', function() {
                    console.log('Client has disconnected');
                });
            });

            console.log(`Client socket server running on ${port}`);
            readyCount++;
            if (readyCount == 2) {
                // all async operations are done and we can continue
                cb();
            }
        });

        // accept connections from masters
        getPort().then(function(port) {
            self.masterSocketServerPort = port;

            // if the client socket spawned first, populate the client port
            if (self.clientSocketServerPort) {
                self.masterClientPorts[self.masterSocketServerPort] = self.clientSocketServerPort;
            }

            self.masterSocketServer = new ws.Server({
                port: port
            });

            // fires on every new connection
            self.masterSocketServer.on('connection', function connection(ws) {
                let master = new masterConnection.MasterConnection(self, ws);
                ws.__master = master;

                self.masters.push(master);

                // fires when a master goes away
                ws.on('close', function() {
                    self.deadMaster(master);
                });
            });

            console.log(`Master socket server running on ${port}`);
            readyCount++;
            if (readyCount == 2) {
                // all async operations are done and we can continue
                cb();
            }
        });

        setTimeout(function() {
            // if we don't know who the primary is within 1s, call an election
            if (!self.primary.id) {
                self.electPrimary();
            }
        }, 1000);

        // save all open documents every once in a while if they have been edited
        setInterval(function() {
            let savedDocuments = [];

            for (let client of self.clients) {
                if (client.pendingChanges) {
                    // check if we've already saved this document
                    if (savedDocuments.indexOf(client.document) === -1) {
                        savedDocuments.push(client.document);
                        self.saveDocument(client.document, client.crdt, (err) => {
                            if (err) {
                                console.log(err);
                            } else {
                                client.pendingChanges = false;
                            }
                        });
                    } else {
                        // another client already saved/is saving
                        client.pendingChanges = false;
                    }
                }
            }
        }, conf.documentWriteInterval);
    };

    /**
     * Save a document to the db
     * @function saveDocument
     * @memberof masterServer.MasterServer
     * @param {string} document - the DocID to save
     * @param {Automerge.init} - the CRDT representation of the document
     * @callback callback - a callback taking (err)
     */
    self.saveDocument = function(document, crdt, callback) {
        console.log('Saving document', document);
        self.docClient.update({
            TableName: 'documents',
            Key: {
                'DocID': document
            },
            UpdateExpression: 'set content = :c',
            ExpressionAttributeValues: {
                ':c': Automerge.save(crdt)
            }
        }, (err) => {
            callback(err);
        });
    };

    /**
     * Go through a list of ports and decide whether or not to connect to the new master
     * @function processMasterPorts
     * @memberof masterServer.MasterServer
     * @param {[int]} ports - an array of port numbers
     */
    self.processMasterPorts = function(ports) {
        for (let port of ports) {
            if (port === self.masterSocketServerPort) {
                // don't connect to ourself
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

    /**
     * Start an election for a new primary
     * @function electPrimary
     * @memberof masterServer.MasterServer
     * @param {bool} [deadPrimary=false] - true if this election is as a result of the last primary dying
     */
    self.electPrimary = function(deadPrimary) {
        self.inElection = true;
        let ports = self.getMasterPorts();
        ports.sort();

        // the master with the highest master socket port becomes the new primary
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

                // call an election to every master with a higher port
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
                } else {
                    // sanity check: there should be masters with higher ports if we got here
                    throw new Error('Unreachable code');
                }
            }

            if (self.deadPrimary) {
                // if the primary died, wait 50ms for someone to announce their victory before calling an election
                // this prevents every master from calling an election at the same time
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

    /**
     * Establish a master-master socket connection with another master
     * @function connectToMaster
     * @memberof masterServer.MasterServer
     * @param {int} port - the port of the master to connect to
     */
    self.connectToMaster = function(port) {
        // don't connect to a master if we're already connecting to it or if it is already connecting to us
        if (self.getMasterPorts().indexOf(port) === -1 && !self.outgoingConnections.hasOwnProperty(port)) {
            self.outgoingConnections[port] = true;
            setTimeout(function() {
                // after 100ms, the connection should be established. If it isn't, then allow new connections
                delete self.outgoingConnections[port];
            }, 100);

            // establish connection
            let socket = new ws(`ws://localhost:${port}`);

            // fires when the connection is ready
            socket.on('open', function() {
                // add this master to our list of masters
                let master = new masterConnection.MasterConnection(self, socket);
                master.masterSocketServerPort = port;
                socket.__master = master;
                self.masters.push(master);
                master.sentHello = true;

                // send this master our information
                master.send({
                    action: 'MasterHello',
                    masters: self.getMasterPorts(),
                    myPort: self.masterSocketServerPort,
                    primary: self.primary,
                    mcPort: self.clientSocketServerPort
                });

                // fires when the other master goes away
                socket.on('close', function() {
                    self.deadMaster(master);
                });
            });
        } else {
            console.warn('Already connected/connecting to master', port);
        }
    };

    /**
     * On the primary master, get the master with the least load
     * @function getBalancedMaster
     * @memberof masterServer.MasterServer
     * @returns {int} the port of the master with the master-master socket with the least load
     */
    self.getBalancedMaster = function() {
        if (self.masters.length === 0) {
            // only offer ourselves (the primary master) as an option when there are no other options
            return self.masterSocketServerPort;
        } else {
            // check that each master has a document
            for (let master of self.masters) {
                if (!self.masterDocuments.hasOwnProperty(master.masterSocketServerPort)) {
                    if (self.masterClientPorts[master.masterSocketServerPort]) {
                        // this master doesn't have any documents - it is valid
                        return master.masterSocketServerPort;
                    }
                }
            }

            // all masters have documents - find the master with the least amount
            let min = 1000000;
            let mmPort = null;
            for (let port in self.masterDocuments) {
                if (self.masterDocuments[port].length < min && self.masterClientPorts[port]) {
                    min = self.masterDocuments[port].length;
                    mmPort = port;
                }
            }

            return mmPort;
        }
    }

    /**
     * Make this master server the primary
     * @function becomePrimary
     * @memberof masterServer.MasterServer
     * @callback callback - a ballback taking nothing
     */
    self.becomePrimary = function(callback) {
        // only continue if we're not already the primary
        if (!self.isPrimary) {
            console.log(`Master ${self.id} is becoming primary`);
            self.isPrimary = true;
            self.primary.id = self.id;
            self.primary.mmPort = self.masterSocketServerPort;
            self.primary.updated = Date.now();
            // get all masters to send us their data
            self.broadcastToMasters({
                action: 'SynchronizeRequest'
            });

            // ensure that the webserver got killed (if the previous primary went down) and then create our own
            killPort(conf.primaryPort).then(() => {
                self.launchWebServer(() => {
                    self.createMasterIfRequired(callback);
                });
            });

            // every 30s, ask all masters for their data
            // strictly speaking this shouldn't be required, but we're not anywhere close to the bandwidth limit and it
            // doesn't hurt
            setInterval(function() {
                self.broadcastToMasters({
                    action: 'SynchronizeRequest'
                });
            }, 30000);
        } else {
            console.log('Already the primary');
        }
    };

    /**
     * Launch a webserver for clients to connect to
     * @function launchWebServer
     * @memberof masterServer.MasterServer
     * @callback callback - a callback taking nothing
     */
    self.launchWebServer = function(callback) {
        webserver.init(self, callback);
    };

    /**
     * Send a message to every other master in the network
     * @function broadcastToMasters
     * @memberof masterServer.MasterServer
     * @param {string} msg - a JSON.stringified message to send
     */
    self.broadcastToMasters = function(msg) {
        for (let master of self.masters) {
            master.send(msg);
        }
    };

    /**
     * Create a new master if the conditions are not met. Only applicable for the primary master
     * @function createMasterIfRequired
     * @memberof masterServer.MasterServer
     * @callback callback - a callback taking nothing
     */
    self.createMasterIfRequired = function(callback) {
        if (!self.isPrimary) {
            console.warn('Cannot spawn new masters if I am not the primary!');
            callback();
        } else {
            // spawn masters until we have enough
            let newMastersToCreate = conf.minMasters - self.masters.length - 1;
            console.log('New masters required:', newMastersToCreate);
            if (newMastersToCreate > 0) {
                (function trySpawn(i) {
                    if (i < newMastersToCreate) {
                        // try this again in 1ms - if spawning masters concurrently is causing issues we can
                        // separate them a little here
                        setTimeout(function() {
                            trySpawn(++i);
                        }, 1);
                        self.spawnMaster();
                    } else {
                        callback();
                    }
                })(0);
            }
        }
    };

    /**
     * Spawn a new master
     * @function spawnMaster
     * @memberof masterServer.MasterServer
     */
    self.spawnMaster = function() {
        // get all the masters we know about
        masterPorts = self.getMasterPorts().join(',');
        console.log('Sharing master ports with new master: ' + masterPorts);

        let options = [
            'server.js',
            '--action', 'join',
            '--peers', masterPorts
        ];


        if (propogateLog) {
            // if we're logging to a file, tell the new master to as well
            options.push('--log');
        }

        // spawn the master as a child process, and then unref it so it stays up if we go down
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

    /**
     * Get an array of all the master-master socket ports we know about
     * @function getMasterPorts
     * @memberof masterServer.MasterServer
     * @returns {[int]} an array of port numbers
     */
    self.getMasterPorts = function() {
        // make it a set to remove duplicates
        let masterPorts = new Set();
        masterPorts.add(self.masterSocketServerPort);

        for (let master of self.masters) {
            // master.masterSocketServerPort will be null if the connection is still initializing
            if (master.masterSocketServerPort) {
                masterPorts.add(master.masterSocketServerPort);
            } else {
                console.warn('cannot share master port!', master.masterSocketServerPort);
            }
        }

        // transform the set into an array so we get the array methods
        return Array.from(masterPorts);
    }

    /**
     * Handle a master going down
     * @function deadMaster
     * @memberof masterServer.MasterServer
     * @param {masterConnection.MasterConnection} master - the master that went down
     */
    self.deadMaster = function(master) {
        console.log(`master ${master.masterSocketServerPort} has died`);

        // ensure the socket gets cleaned up
        master.socket.terminate();

        // remove the master from our list of masters
        for (let i = 0; i < self.masters.length; i++) {
            if (self.masters[i].masterSocketServerPort === master.masterSocketServerPort) {
                self.masters.splice(i, 1);
                delete master;
                break;
            }
        }

        // if we're the primary, remove it from our mappings
        if (self.isPrimary) {
            delete self.masterClientPorts[master.masterSocketServerPort];
            delete self.masterDocuments[master.masterSocketServerPort];

            // re-create the masters as required
            self.createMasterIfRequired(() => {
                // ok
            });
        }

        // if it was the primary that died, hold an election
        if (master.masterSocketServerPort === self.primary.mmPort) {
            // primary master crashed
            self.primary = {
                id: null,
                mmPort: null,
                updated: Date.now()
            };
            self.electPrimary(true);
        }
    };

    /**
     * Handle a client going down
     * @function deadClient
     * @memberof masterServer.MasterServer
     * @param {string} client_id - the instance ID of the client
     */
    self.deadClient = function(client_id) {
        console.log(`client ${client_id} has died`);

        // remove the client from our list of clients
        for (let i = 0; i < self.clients.length; i++) {
            if (self.clients[i]._thisClient === client_id) {
                let client = self.clients.splice(i, 1);
                delete client;
                break;
            }
        }
    };
};

/**
 * Create a master server
 * @function createNewMasterServer
 * @memberof masterServer
 * @param {bool} options.log - true if this master should write it's stdout and stderr to a log file
 * @param {[int]} options.masterPorts - an array of all the existing master's master-master socket server ports
 * @param {bool} options.primary - true if this is the first primary in the system
 * @callback callback - a callback receiving the MasterServer instance that was created
 */
function createNewMasterServer(options, callback) {
    let master = new MasterServer();

    propogateLog = options.log;
    if (options.log) {
        // create a writestream to write to, and overwrite the native stdout and stderr streams to write to both
        // the writestream as well as stdout and stderr
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

    // initialize the master
    master.init(function() {
        if (options.primary) {
            master.becomePrimary(() => {
                callback(master);
            });
        } else {
            // connect to peers if we're not the primary
            for (let port of options.masterPorts) {
                master.connectToMaster(port);
            }
            callback(master);
        }
    });
};

/**
 * @namespace masterServer
 */
module.exports = {
    MasterServer: MasterServer,
    createNewMasterServer: createNewMasterServer
};
