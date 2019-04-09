/**
 * @file masterConnection.js
 * @overview handle messages between different masters on the master-master socket graph
 */

const conf = require('./conf.json');

/**
 * @class MasterConnection
 * @memberof masterConnection
 * @param {masterServer.MasterServer} masterServer - the server that owns this connection
 * @param {WebSocket} WebSocket - a websocket connection to another master
 */
function MasterConnection(masterServer, socket) {
    // capture context
    let self = this;

    self.masterServer = masterServer; // the MasterServer that owns this connection
    self.socket = socket; // the socket to the other master
    self.masterSocketServerPort = null; // the port that the other master's master-master socket server is listening on
    self.sentHello = false; // whether we have sent a MasterHello message to the other master yet

    // fires every time we get a message from the other master
    socket.on('message', function(message) {
        // the data should be serialized JSON. If it's not, discard this message and print a warning
        try {
            var incoming = JSON.parse(message);
        } catch (e) {
            console.warn('bad message on master-master socket!', message);
            return;
        }

        console.log(`[m${self.masterServer.masterSocketServerPort || '?'}]<[m${self.masterSocketServerPort || '?'}]`, incoming);

        switch(incoming.action) {
            case 'MasterHello':
                /*  Sent when a MasterConnection is being established
                    {
                        "action": "MasterHello",
                        "masters": [all the master-master socket ports this master knows about],
                        "myPort": the master-master socket port this master is using,
                        "primary": {
                            id: the UUID of the current primary master
                            mmPort: the master-master port of the current primary
                            update: the unix epoch of when this data was last changed
                        },
                        "mcPort": the master-client socket port this master is using
                    }
                */

                self.masterSocketServerPort = incoming.myPort;
                self.masterServer.processMasterPorts(incoming.masters);

                // use the other master's primary metadata if it is more recent than ours
                if (
                    (incoming.primary.id && incoming.primary.mmPort)
                    && (!self.masterServer.primary.updated || (incoming.primary.updated > self.masterServer.primary.updated))
                ) {
                    console.log('Updating primary to', incoming.primary.id);
                    self.masterServer.primary.id = incoming.primary.id;
                    self.masterServer.primary.mmPort = incoming.primary.mmPort;
                    self.masterServer.primary.updated = incoming.primary.updated;
                }

                // if we haven't sent a MasterHello to this master yet, do so
                if (!self.sentHello) {
                    self.sentHello = true;
                    self.send({
                        action: 'MasterHello',
                        masters: self.masterServer.getMasterPorts(),
                        myPort: self.masterServer.masterSocketServerPort,
                        primary: self.masterServer.primary,
                        mcPort: self.masterServer.clientSocketServerPort
                    });
                } else if (
                    !incoming.primary.id || !incoming.primary.mmPort || !incoming.primary.updated ||
                    (incoming.primary.updated && self.masterServer.primary.updated > incoming.primary.updated)
                ) {
                    // our primary data is more recent than theirs, so send them it
                    self.send({
                        action: 'SynchronizeData',
                        data: {
                            masters: self.masterServer.getMasterPorts(),
                            primary: self.masterServer.primary,
                            documents: self.masterServer.documents,
                            mcPort: self.masterServer.clientSocketServerPort
                        }
                    });
                }

                // if we're the primary, we need to know about their client port
                if (self.masterServer.isPrimary) {
                    self.masterServer.masterClientPorts[self.masterSocketServerPort] = incoming.mcPort;
                }
                break;
            case 'SynchronizeRequest':
                /* Sent when a master wants to know about our data
                    {
                        "action": "SynchronizeRequest"
                    }
                */

                // send a SynchronizeData message in response
                self.send({
                    action: 'SynchronizeData',
                    data: {
                        masters: self.masterServer.getMasterPorts(),
                        primary: self.masterServer.primary,
                        documents: self.masterServer.documents,
                        mcPort: self.masterServer.clientSocketServerPort
                    }
                });
                break;
            case 'SynchronizeData':
                /* Sent when a master wants us to know their current state
                    {
                        "action": "SynchronizeData",
                        "data": {
                            "masters": [all master-master socket ports],
                            "primary": {
                                id: the UUID of the current primary master
                                mmPort: the master-master port of the current primary
                                update: the unix epoch of when this data was last changed
                            },
                            "documents": [all document DocIDs this master is responsible for],
                            "mcPort": this master's master-client socket server port
                        }
                    }
                */

                // ensure our master list is consistent with theirs
                self.masterServer.processMasterPorts(incoming.data.masters);

                // if their primary data is newer, then update ours
                if (
                    (incoming.data.primary.id && incoming.data.primary.mmPort)
                    && (!self.masterServer.primary.updated || (incoming.data.primary.updated > self.masterServer.primary.updated))
                ) {
                    console.log('Updating primary to', incoming.data.primary.id);
                    self.masterServer.primary.id = incoming.data.primary.id;
                    self.masterServer.primary.mmPort = incoming.data.primary.mmPort;
                    self.masterServer.primary.updated = incoming.data.primary.updated;
                }

                // if we are the primary, save their document list and client port
                if (self.masterServer.isPrimary) {
                    self.masterServer.masterDocuments[self.masterSocketServerPort] = incoming.data.documents;
                    self.masterServer.masterClientPorts[self.masterSocketServerPort] = incoming.data.mcPort;
                }
                break;
            case 'CallElection':
                /*  Sent when a master would like to call an election
                    {
                        "action": "CallElection"
                    }
                */

                self.masterServer.electionCalled = true;
                self.masterServer.inElection = true;

                // if the master that called the election has a lower port than us, send an ElectionAnswer and
                // re-call the election
                if (self.masterSocketServerPort < self.masterServer.masterSocketServerPort) {
                    self.send({
                        action: 'ElectionAnswer'
                    });

                    // reset the election state variables
                    if (self.masterServer.electionTimer) {
                        clearTimeout(self.masterServer.electionTimer);
                    }
                    if (self.masterServer.electionAnswerTimer) {
                        clearTimeout(self.masterServer.electionAnswerTimer);
                    }

                    // call a new election
                    setTimeout(function() {
                        self.masterServer.electPrimary();
                    }, 1);
                }
                break;
            case 'ElectionVictory':
                /* Sent when a master has declared that they are the new primary
                    {
                        "action": "ElectionVictory"
                    }
                 */

                // stop any timers
                self.masterServer.electionCalled = true;

                console.log('Updating primary to', incoming.id);

                // set the new primary meta-data
                self.masterServer.primary = {
                    id: incoming.id,
                    mmPort: incoming.mmPort,
                    updated: incoming.updated
                };

                self.masterServer.inElection = false;

                // if there are any pending election timeouts, clear them
                if (self.masterServer.electionTimer) {
                    clearTimeout(self.masterServer.electionTimer);
                }
                if (self.masterServer.electionAnswerTimer) {
                    clearTimeout(self.masterServer.electionAnswerTimer);
                }
                break;
            case 'ElectionAnswer':
                /* Sent as part of the bully election algorithm
                    {
                        "action": "ElectionAnswer"
                    }
                */

                self.masterServer.electionCalled = true;

                // clear the electionTimer if it has been set
                if (self.masterServer.electionTimer) {
                    clearTimeout(self.masterServer.electionTimer);
                }

                // if the master we are talking to has a bigger port than us, stop talking in this election
                if (self.masterSocketServerPort > self.masterServer.masterSocketServerPort) {
                    // send no more election messages this election
                    self.masterServer.electionAnswered = true;

                    // clear the timer and make a new one
                    if (self.masterServer.electionAnswerTimer) {
                        clearTimeout(self.masterServer.electionAnswerTimer);
                    }

                    // after a set time, re-call the election as it should have been resolved by now
                    // this handles masters crashing during an election
                    self.masterServer.electionAnswerTimer = setTimeout(function() {
                        // clear the election state
                        if (self.masterServer.electionTimer) {
                            clearTimeout(self.masterServer.electionTimer);
                        }
                        if (self.masterServer.electionAnswerTimer) {
                            clearTimeout(self.masterServer.electionAnswerTimer);
                        }

                        // restart the election
                        setTimeout(function() {
                            self.electPrimary();
                        }, 1);
                    }, conf.electionWaitTime);
                }
                break;
            case 'Shutdown':
                /*  Sent when the debug console has told us to shut down
                    {
                        "action": "Shutdown"
                    }
                */
                process.exit(0);
                break;
            case 'Crash':
                /*  Sent when the debug console has told us to crash
                    {
                        "action": "Crash"
                    }
                */
                throw new Error('Requested crash');
                break;
            case 'CodeExecution':
                /*  Sent when the debug console wants us to execute arbitrary code
                    {
                        "action": "CodeExecution",
                        "code": "the code to execute"
                    }
                */
                eval(incoming.code);
                break;
            default:
                console.warn('Unknown action!', incoming);
        }
    });

    /**
     * Send data to the other master
     * @function send
     * @memberof masterConnection.MasterConnection
     * @param {*} msg - the data to send, as a non-serialized JSON object
     */
    self.send = function(msg) {
        console.log(`[m${self.masterServer.masterSocketServerPort || '?'}]>[m${self.masterSocketServerPort || '?'}]`, msg);
        self.socket.send(JSON.stringify(msg));
    };
}

/**
 * @namespace masterConnection
 */
module.exports = {
    MasterConnection: MasterConnection
};
