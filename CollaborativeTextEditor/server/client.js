const ws = require('ws');
const portfinder = require('ws');
const child_process = require('child_process');

const conf = require('./conf.json');

let Client = function(masterServer, socket) {
    let self = this;

    self.masterServer = masterServer;
    self.socket = socket;
    self.id = null;

    console.log(`Client connected to master`);

    self.slave = child_process.fork('./slave.js');

    self.slave.on('message', function(incoming) {
        console.log('[slave<<]', incoming);

	var DocId = null;
	var Offset = null;
	var Data = null;
	
	
        switch (incoming.action) {
            // SLAVE TO MASTER MESSAGES
            case 'SlaveReady':
                self.socket.send(JSON.stringify({
                    action: 'ClientHello',
                    port: incoming.port
                }));
                self.socket.close();
            break;
	case "insert":
	    DocId = incoming.document_id;
	    data = incoming.payload.data;
	    offset = incoming.payload.offset;
	    
	    /* Add the data to the database */
	    
	    console.log ("Will add character :" + data + " at offset :" + offset); /* <<DBUG>> */
	    break;
	case "delete":
	    DocId = incoming.document_id;
	    offset = incoming.payload.offset;

	    /* Remove data from the database */
	    
	    console.log ("Will delete 1 character at :" + offset); /* <<DBUG>> */
	    break;
	default:
                console.log('unknown slave message');
                break;
        }
    });

    self.slave.on('close', () => {
        console.log('Client detached');
    });
};

module.exports = {
    Client: Client
};
