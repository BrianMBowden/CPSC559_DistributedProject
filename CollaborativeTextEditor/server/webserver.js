const express = require("express");
const bodyParser = require("body-parser");
const uuid = require("uuid/v4");
const Automerge = require("automerge");

const conf = require('./conf.json');


function init(self, callback) {
    self.webServer = express();
    self.webServer.use(bodyParser.json());
    self.webServer.use(bodyParser.urlencoded({
        extended: true
    }));
    self.webServer.post('/broadcast', (req, res) => {
        self.broadcastToMasters(req.body.payload);
        res.end("ok");
    });
    self.webServer.post('/send', (req, res) => {
        let port = parseInt(req.body.master, 10);
        for (let master of self.masters) {
            if (master.masterSocketServerPort === port) {
                master.send(req.body.payload);
                break;
            }
        }
    });
    self.webServer.post('/crash', (req, res) => {
        res.end("ok");

        setTimeout(function() {
            throw new Error('requested crash');
        }, 1);
    });
    self.webServer.post('/login', (req, res) => {
        if (!req.body.username || !req.body.password) {
            res.status(400).end();
        } else {
            console.log('Logging in user...');
            self.docClient.query({
                TableName: 'users',
                KeyConditionExpression: 'username = :usr',
                ExpressionAttributeValues: {
                    ':usr': req.body.username
                }
            }, (err, data) => {
                if (err) {
                    res.status(500).end();
                    console.error(err);
                } else {
                    if (data.Items.length) {
                        if (data.Items[0].password === req.body.password) {
                            self.docClient.scan({
                                TableName: 'documents'
                            }, (err, documents) => {
                                if (err) {
                                    res.status(500).end();
                                }
                                let docs = [];
                                for (let item of documents.Items) {
                                    if (item.ownr === data.Items[0].id) {
                                        docs.push({
                                            id: item.DocID,
                                            title: item.title,
                                            DocShareID: item.DocShareID
                                        });
                                    }
                                }
                                res.setHeader('Content-Type', 'application/json');
                                res.status(200).end(JSON.stringify({
                                    action: "login",
                                    client_id: data.Items[0].id,
                                    payload: {
                                        username: data.Items[0].username,
                                        owned_documents: docs
                                    }
                                }));
                            });
                        } else {
                            res.status(403).end();
                        }
                    } else {
                        res.status(403).end();
                    }
                }
            });
        }
    });
    self.webServer.post('/new_document', (req, res) => {
        // create a new document, assign a master to it, give the client back the slave port
        let content = Automerge.change(Automerge.init(), doc => {
            doc.text = new Automerge.Text();
        });

        let doc = {
            DocID: uuid(),
            DocShareID: uuid(),
            title: 'Untitled Document',
            ownr: req.body.client_id,
            content: Automerge.save(content)
        };
        self.docClient.put({
            TableName: 'documents',
            Item: doc
        }, (err) => {
            if (err) {
                res.status(500).end();
                throw err;
            } else {
                let mmPort = self.getBalancedMaster();
                self.masterDocuments[mmPort] = self.masterDocuments[mmPort] || [];
                self.masterDocuments[mmPort].push(doc.DocID);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    payload: {
                        port: self.masterClientPorts[mmPort],
                        document: doc
                    }
                }));
            }
        });
    });
    self.webServer.post('/open_document', (req, res) => {
        let mmPort = null;
        for (let port in self.masterDocuments) {
            if (self.masterDocuments[port].indexOf(req.body.document_id) !== -1) {
                console.log('Master exists to handle doc', port);
                mmPort = port;
                break;
            }
        }

        if (mmPort === null) {
            mmPort = self.getBalancedMaster();
            console.log('Balanced master', mmPort, self.masterClientPorts);
            self.masterDocuments[mmPort] = self.masterDocuments[mmPort] || [];
            self.masterDocuments[mmPort].push(req.body.document_id);
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            payload: {
                port: self.masterClientPorts[mmPort],
                document_id: req.body.document_id
            }
        }));
    });
    self.webServer.use(express.static('../client/'));

    let attempts = 0;
    function tryListen() {
        self.webServer.listen({
            port: conf.primaryPort
        }, function() {
            console.log(`Initial client connection point running on port: ${conf.primaryPort}`);
            callback();
        }).on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.warn('Can not start client connection point. EADDRINUSE');
                attempts++;
                if (attempts >= conf.maxWebServerAttempts) {
                    throw e;
                }
                setTimeout(function() {
                    tryListen();
                }, 1000);
            } else {
                throw e;
            }
        });
    }
    tryListen();
};

module.exports = {
    init: init
};
