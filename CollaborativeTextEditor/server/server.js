/**
 * @file server.js
 * @overview Entry point for starting up a master server
 */

const commandLineArgs = require("command-line-args");
const commandLineUsage = require('command-line-usage');

const masterServer = require('./masterServer.js');
const conf = require('./conf.json');

// command line options
const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Display this usage guide.'
    },
    {
        name: 'action',
        type: String,
        description: 'The input files to process',
        typeLabel: '<startup|join>'
    },
    {
        name: 'peers',
        type: String,
        description: 'The known masters (comma-delimited ports)',
        typeLabel: '<port,port,port,...>'
    },
    {
        name: 'log',
        type: Boolean,
        description: 'Have all processes write their output to log/uuid.log'
    }
];

// when --help is passed
const usage = commandLineUsage([
    {
      header: 'Distributed TypeIt Server',
      content: 'Launch the distributed TypeIt Server'
    },
    {
      header: 'Options',
      optionList: optionDefinitions
    }
]);

 /**
  * Server entry point
  * @function main
  * @private
  */
function main() {
    // parse options
    let options = commandLineArgs(optionDefinitions);
    if (options.help) {
        console.log(usage);
        process.exit(1);
    }

    // require either --startup or --join to be passed
    if (['startup', 'join'].indexOf(options.action) === -1) {
        console.log(usage);
        process.exit(1);
    }

    if (options.action === 'startup') {
        // there are no servers running. This is the first primary master
        console.log('Initializing distributed TypeIt system...');
        masterServer.createNewMasterServer({
            primary: true,
            masterPorts: [],
            log: options.log
        }, (primary) => {
            console.log('Done.');
        });
    } else {
        // create slave master and join primary pool
        console.log('Creating Master...');

        // ensure all the ports are whole numbers
        let masterPorts = options.peers.split(',');
        for (let i = 0; i < masterPorts.length; i++) {
            masterPorts[i] = parseInt(masterPorts[i], 10);
            if (isNaN(masterPorts[i])) {
                console.warn('Port must be an integer!');
                process.exit(0);
            }
        }

        // create the master
        masterServer.createNewMasterServer({
            primary: false,
            masterPorts: masterPorts,
            log: options.log
        }, (master) => {
            global.master = master;
            console.log('Done.');
        });
    }
}

main();
