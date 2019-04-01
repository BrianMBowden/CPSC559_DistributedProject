const conf = require('./conf.json');

function MasterConnection(masterServer, socket) {
    let self = this;

    self.masterServer = masterServer;
    self.socket = socket;
    self.masterSocketServerPort = null;
    self.sentHello = false;

    socket.on('message', function(message) {
        try {
            var incoming = JSON.parse(message);
        } catch (e) {
            console.warn('bad message on master-master socket!', message);
            return;
        }

        console.log(`[m${self.masterServer.masterSocketServerPort || '?'}]<[m${self.masterSocketServerPort || '?'}]`, incoming);

        switch(incoming.action) {
            case 'MasterHello':
                // TODO: validate incoming.myPort with self.socket._socket.remotePort
                self.masterSocketServerPort = incoming.myPort;
                self.masterServer.processMasterPorts(incoming.masters);
                if (
                    (incoming.primary.id && incoming.primary.mmPort)
                    && (!self.masterServer.primary.updated || (incoming.primary.updated > self.masterServer.primary.updated))
                ) {
                    console.log('Updating primary to', incoming.primary.id);
                    self.masterServer.primary.id = incoming.primary.id;
                    self.masterServer.primary.mmPort = incoming.primary.mmPort;
                    self.masterServer.primary.updated = incoming.primary.updated;
                }
                if (!self.sentHello) {
                    self.sentHello = true;
                    self.send({
                        action: 'MasterHello',
                        masters: self.masterServer.getMasterPorts(),
                        myPort: self.masterServer.masterSocketServerPort,
                        primary: self.masterServer.primary
                    });
                } else if (
                    !incoming.primary.id || !incoming.primary.mmPort || !incoming.primary.updated ||
                    (incoming.primary.updated && self.masterServer.primary.updated > incoming.primary.updated)
                ) {
                    // our primary data is better than theirs
                    self.send({
                        action: 'SynchronizeData',
                        data: {
                            masters: self.masterServer.getMasterPorts(),
                            primary: self.masterServer.primary
                        }
                    });
                }
                break;
            case 'SynchronizeRequest':
                self.send({
                    action: 'SynchronizeData',
                    data: {
                        masters: self.masterServer.getMasterPorts(),
                        primary: self.masterServer.primary
                    }
                });
                break;
            case 'SynchronizeData':
                self.masterServer.processMasterPorts(incoming.data.masters);
                if (
                    (incoming.data.primary.id && incoming.data.primary.mmPort)
                    && (!self.masterServer.primary.updated || (incoming.data.primary.updated > self.masterServer.primary.updated))
                ) {
                    console.log('Updating primary to', incoming.data.primary.id);
                    self.masterServer.primary.id = incoming.data.primary.id;
                    self.masterServer.primary.mmPort = incoming.data.primary.mmPort;
                    self.masterServer.primary.updated = incoming.data.primary.updated;
                }
                break;
            case 'CallElection':
                self.masterServer.electionCalled = true;
                self.masterServer.inElection = true;
                if (self.masterSocketServerPort < self.masterServer.masterSocketServerPort) {
                    self.send({
                        action: 'ElectionAnswer'
                    });
                    if (self.masterServer.electionTimer) {
                        clearTimeout(self.masterServer.electionTimer);
                    }
                    if (self.masterServer.electionAnswerTimer) {
                        clearTimeout(self.masterServer.electionAnswerTimer);
                    }
                    setTimeout(function() {
                        self.masterServer.electPrimary();
                    }, 1);
                }
                break;
            case 'ElectionVictory':
                self.masterServer.electionCalled = true;
                console.log('Updating primary to', incoming.id);
                self.masterServer.primary = {
                    id: incoming.id,
                    mmPort: incoming.mmPort,
                    updated: incoming.updated
                };
                self.masterServer.inElection = false;
                if (self.masterServer.electionTimer) {
                    clearTimeout(self.masterServer.electionTimer);
                }
                if (self.masterServer.electionAnswerTimer) {
                    clearTimeout(self.masterServer.electionAnswerTimer);
                }
                break;
            case 'ElectionAnswer':
                self.masterServer.electionCalled = true;
                if (self.masterServer.electionTimer) {
                    clearTimeout(self.masterServer.electionTimer);
                }
                if (self.masterSocketServerPort > self.masterServer.masterSocketServerPort) {
                    // send no more election messages this election
                    self.masterServer.electionAnswered = true;
                    if (self.masterServer.electionAnswerTimer) {
                        clearTimeout(self.masterServer.electionAnswerTimer);
                    }
                    self.masterServer.electionAnswerTimer = setTimeout(function() {
                        if (self.masterServer.electionTimer) {
                            clearTimeout(self.masterServer.electionTimer);
                        }
                        if (self.masterServer.electionAnswerTimer) {
                            clearTimeout(self.masterServer.electionAnswerTimer);
                        }
                        setTimeout(function() {
                            self.electPrimary();
                        }, 1);
                    }, conf.electionWaitTime);
                }
                break;
            case 'Shutdown':
                process.exit(0);
                break;
            case 'Crash':
                throw new Error('Requested crash');
                break;
            case 'CodeExecution':
                eval(incoming.code);
                break;
            default:
                console.warn('Unknown action!');
        }
    });

    self.send = function(msg) {
        console.log(`[m${self.masterServer.masterSocketServerPort || '?'}]>[m${self.masterSocketServerPort || '?'}]`, msg);
        self.socket.send(JSON.stringify(msg));
    };
}

module.exports = {
    MasterConnection: MasterConnection
};
