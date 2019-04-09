/**
 * @file webserver.js
 * @overview logic for the primary master's webserver
 */

const express = require("express");
const bodyParser = require("body-parser");
const uuid = require("uuid/v4");
const Automerge = require("automerge");

const conf = require('./conf.json');


/**
 * Initialize the webserver
 * @function init
 * @memberof webserver
 * @param {masterServer.MasterServer} self - the server hosting this webserver
 * @callback callback - a callback taking nothing
 */
function init(self, callback) {
    // initialize the webserver
    self.webServer = express();

    // use POST body middleware
    self.webServer.use(bodyParser.json());
    self.webServer.use(bodyParser.urlencoded({
        extended: true
    }));

    // for the demo console, broadcast a message to all masters
    self.webServer.post('/broadcast', (req, res) => {
        self.broadcastToMasters(req.body.payload);
        res.end("ok");
    });

    // for the demo console, send a message to a specific master
    self.webServer.post('/send', (req, res) => {
        let port = parseInt(req.body.master, 10);
        for (let master of self.masters) {
            if (master.masterSocketServerPort === port) {
                master.send(req.body.payload);
                break;
            }
        }
    });

    // for the demo console, crash this master
    self.webServer.post('/crash', (req, res) => {
        res.end("ok");

        setTimeout(function() {
            throw new Error('requested crash');
        }, 1);
    });

    // log a user in
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

                            // the user is valid, get all documents
                            self.docClient.scan({
                                TableName: 'documents'
                            }, (err, documents) => {
                                if (err) {
                                    res.status(500).end();
                                }
                                let docs = [];

                                // for every document, if the user owns it, send them the metadata
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

    // create a new document
    self.webServer.post('/new_document', (req, res) => {
        // create the document text
        let content = Automerge.change(Automerge.init(), doc => {
            doc.text = new Automerge.Text();
        });

        // document creation
        let doc = {
            DocID: uuid(),
            DocShareID: uuid(),
            title: 'Untitled Document',
            ownr: req.body.client_id,
            content: Automerge.save(content)
        };

        // put the document into the database
        self.docClient.put({
            TableName: 'documents',
            Item: doc
        }, (err) => {
            if (err) {
                res.status(500).end();
                throw err;
            } else {
                // get a master that can handle this new document and then send it's information to the
                // client
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

    // open an existing document
    self.webServer.post('/open_document', (req, res) => {
        let mmPort = null;
        // check if the document has been opened in a master before
        for (let port in self.masterDocuments) {
            if (self.masterDocuments[port].indexOf(req.body.document_id) !== -1) {
                console.log('Master exists to handle doc', port);
                mmPort = port;
                break;
            }
        }

        // no master has this document yet - get the lowest load one
        if (mmPort === null) {
            mmPort = self.getBalancedMaster();
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

    // server static files through the client directory
    self.webServer.use(express.static('../client/'));

    // attempt to start listening on the webserver client port
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

/**
 * @namespace webserver
 */
module.exports = {
    init: init
};
