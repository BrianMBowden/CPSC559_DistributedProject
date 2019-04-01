const express = require("express");
const bodyParser = require("body-parser");

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
                    throw err;
                } else {
                    if (data.Items.length) {
                        if (data.Items[0].password === req.body.password) {
                            res.status(200).end('ok');
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
