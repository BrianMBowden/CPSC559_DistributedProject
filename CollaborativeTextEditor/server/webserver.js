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
    self.webServer.post('/crash', (req, res) => {
        res.end("ok");

        setTimeout(function() {
            throw new Error('requested crash');
        }, 1);
    });
    self.webServer.use(express.static('../client/'));
    self.webServer.listen(conf.primaryPort, function(err) {
        if (err) {
            throw err;
        }
        console.log(`Initial client connection point running on port: ${conf.primaryPort}`);
        callback();
    });
};

module.exports = {
    init: init
};
