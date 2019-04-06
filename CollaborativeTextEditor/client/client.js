/**
 * @file client.js
 * @overview TypeIt client-side logic
 */

$(document).ready((e) => {

    /**
     * @namespace typeit
     */
    window.typeit = window.typeit || {};

    (function() {
        // capture context
        let self = this;

        self.id = null; // the id of the client logged in
        self.username = null; // the username of the client logged in
        self.ownedDocuments = []; // all of the documents this client owns
        self.masterSocket = null; // a reference to the socket connected to the master server assigned to this client
        self.slaveSocket = null; // a reference to the socket connected to the slave server assigned to this client
        self.quill = null; // the editor
        self.requestedClose = false; // keep track of unrequested socket close events
        self._instance = uuid(); // an identifier unique to this page (if a client is logged in on multiple devices)
        self.cursors = {}; // all of the cursors in the editor
        self.cursorsModule = null; // editor cursor control

        // metadata about the document that is currently open
        self.openDocument = {
            id: null,
            title: null,
            shareId: null
        };

        /**
         * Initialize the client
         * @function init
         * @memberof typeit
         */
        self.init = function() {
            // every uncaught error in the client will be directed here. Use to check for client faults
            window.onerror = function(errmsg, url, lineNumber) {
                $('<div>Uh oh :(<br />Your client has experienced an error and needs to restart</div>').dialog({
                    modal: true,
                    dialogClass: 'no-close',
                    title: 'Error',
                    buttons: {
                        'Fine, I Guess...': function() {
                            $(this).dialog('close');
                            window.location.reload();
                        }
                    }
                });
                return false;
            };

            // PING the slave socket every second if it is open to keep-alive the connection
            setInterval(function() {
                if (self.slaveSocket && self.slaveSocket.readyState === self.slaveSocket.OPEN) {
                    self.slaveSocket.send(JSON.stringify({
                        action: 'ping'
                    }));
                }
            }, 1000);


            // listen for when the user clicks the login button
            $('#login input[name="submit"]').click((e) => {
                // clear the "invalid login" text if it was there
                $('#login_fail').text('');

                let username = $('#login input[name="username"]').val();
                let password = $('#login input[name="password"]').val();
                window.typeit.login(username, password, (err, ok) => {
                    if (err) {
                        // there was an error logging in
                        throw err;
                    } else {
                        if (!ok) {
                            // the user's login credentials aren't valid
                            $('#login_fail').text('Invalid Credentials');
                            return;
                        }

                        // hide the login page and show the editor
                        $('#login').hide();
                        $('#doc').show();

                        // boot up the editor
                        Quill.register('modules/cursors', QuillCursors);
                        self.quill = new Quill('#editor', {
                            theme: 'snow',
                            modules: {
                                cursors: true
                            }
                        });
                        self.cursorsModule = self.quill.getModule('cursors');

                        // the user hasn't opened a document yet. Clear the editor and disable it until they do
                        self.quill.setText('');
                        self.quill.disable();

                        // listen for text changes on the editor
                        self.quill.on('text-change', function(delta, oldDelta, source) {
                            // only respond to changes originated by the user, not this code
                            if (source === 'user') {
                                var offset = null;
                                var data = null;
                                var insert = null;

                                if (delta.ops[0].hasOwnProperty ('insert')) {
                                    // insert does not have any characters to retain
                                    offset = 0;
                                    data = delta.ops[0].insert;
                                    insert = true;
                                } else if (delta.ops[0].hasOwnProperty ('delete')) {
                                    // delete does not have any characters to retain
                                    offset = 0;
                                    insert = false;
                                } else if (delta.ops[1].hasOwnProperty ('insert')) {
                                    // insert has characters to retain
                                    offset = delta.ops[0].retain;
                                    data = delta.ops[1].insert;
                                    insert = true;
                                } else {
                                    // delete has characters to retain
                                    offset = delta.ops[0].retain;
                                    insert = false;
                                }

                                if (insert) {
                                    // send "insert" message
                                    self.sendSlave({
                                        action: 'insert',
                                        client_id: self.id,
                                        document_id: self.openDocument.id,
                                        payload: {
                                            data_type: 'text',
                                            offset: offset,
                                            length: 1,
                                            data: data
                                        }
                                    });
                                } else {
                                    // send "delete" message
                                    self.sendSlave({
                                        action: 'delete',
                                        client_id: self.id,
                                        document_id: self.currentDoc,
                                        payload: {
                                            data_type: 'text',
                                            offset: offset,
                                            length: 1,
                                            data: data
                                        }
                                    });
                                }
                            }
                        });

                        // propogate cursor changes to the slave so other clients can recieve them
                        self.quill.on('selection-change', (e) => {
                            self.sendSlave({
                                action: 'cursor_change',
                                client_id: self.id,
                                client_username: self.username,
                                client_instance: self._instance,
                                cursor: e
                            });
                        });
                    }
                });
            });

            // listener for 'Logout' button
            $('#exit-button').click((e) => {
                location.reload();
            });

            // listener for 'Share' button
            $('#share-button').click((e) => {
                $(`<div>Share Code: <br/><span class="code">${self.openDocument.id}</span></div>`)
                    .dialog({
                        modal: true,
                        title: 'Share Code',
                        buttons: {
                            'Thanks!': function() {
                                $(this).dialog('close');
                            }
                        }
                    });
            });

            // listener for the 'Join' button
            $('#join-button').click((e) => {
                $(`<div><input type="text" placeholder="Share Code" class="code"></div>`)
                    .dialog({
                        modal: true,
                        title: 'Join Document',
                        buttons: {
                            Join: function() {
                                $(this).dialog('close');
                                self.openFile($(this).find('input').val());
                            },
                            Cancel: function() {
                                $(this).dialog('close');
                            }
                        }
                    });
            });

            // listener for the 'export' button
            $('#export-button').click((e) => {
                let file = new Blob([self.quill.getText()], {type: 'text/plain'});
                let a = document.createElement('a');
                a.href = URL.createObjectURL(file);
                a.download = `${self.openDocument.title}.txt`;
                a.click();
            });

            // listener for the 'New File' button
            $('#new-button').click((e) => {
                // if we're currently connected to a master or slave, disconnect them
                if (self.masterSocket) {
                    self.masterSocket.close();
                    self.masterSocket = null;
                }
                if (self.slaveSocket) {
                    self.requestedClose = true;
                    self.slaveSocket.close();
                    self.slaveSocket = null;
                }

                // clear the editor while we're waiting
                self.quill.setText('');
                self.quill.disable();

                // ask the primary master for a master to connect to for the new document
                $.ajax({
                    url: '/new_document',
                    type: 'POST',
                    data: {
                        action: 'create',
                        client_id: self.id
                    },
                    success: function(data) {
                        // we just created this document, so we own it
                        self.ownedDocuments.push({
                            id: data.payload.document.DocID,
                            DocShareID: data.payload.document.DocShareID,
                            title: data.payload.document.title
                        });

                        // connect to the master that will handle our new document
                        self.connectToMaster(data.payload.port, (err) => {
                            if (err) {
                                self.handleError(err);
                                return;
                            }

                            // grab the document from the slave
                            // we'll get an open_file event back from the slave
                            self.sendSlave({
                                action: 'open_document',
                                client_id: self.id,
                                document_id: data.payload.document.DocID
                            });
                        });
                    },
                    error: self.handleError
                });
            });

            // listener for 'open file' button
            $('#open-button').click((e) => {
                // change dialog shown based on if we have documents to own
                if (self.ownedDocuments.length) {
                    // generate dialog with all the currently owned documents
                    let dialog = $(`
                        <div>
                            Choose a Document:
                            <select name="opendoc">
                                <option disabled selected>Please pick a document</option>
                            </select>
                        </div>
                    `);
                    for (let document of self.ownedDocuments) {
                        dialog.find('select').append($(`<option value="${document.id}">${document.title}</option>`));
                    }
                    dialog.find('select').selectmenu();

                    // open the dialog
                    dialog.dialog({
                        modal: true,
                        width: 600,
                        title: 'Open Document',
                        buttons: {
                            Open: function() {
                                let doc = dialog.find('select').val();
                                if (!doc) {
                                    alert('you gotta pick one');
                                } else {
                                    dialog.dialog('close');
                                    self.openFile(doc);
                                }
                            },
                            Cancel: function() {
                                dialog.dialog('close');
                            }
                        }
                    });
                } else {
                    $('<div>You have no documents to open.</div>').dialog({
                        modal: true,
                        width: 600,
                        buttons: {
                            Ok: function() {
                                $(this).dialog('close');
                            }
                        }
                    });
                }
            });

            // listener for 'rename' button
            $('#rename-button').click((e) => {
                let input = $(`<div style="text-align: center">Document Title: <input type="text"><div>`);
                input.find('input').val(self.openDocument.title);
                input.dialog({
                    modal: true,
                    width: 600,
                    title: 'Rename Document',
                    buttons: {
                        Ok: function() {
                            input.dialog('close');
                            // send the rename request to the slave. We'll get a message back if it was successful
                            self.slaveSocket.send(JSON.stringify({
                                action: 'rename',
                                client_id: self.id,
                                document_id: self.openDocument.id,
                                new_doc_name: input.find('input').val()
                            }));
                        },
                        Cancel: function() {
                            input.dialog('close');
                        }
                    }
                });
            });
        };

        /**
         * Connect to a master server (and subsequently connect to the slave)
         * @function connectToMaster
         * @memberof typeit
         * @param {int} port - the port of the client socket on the master to connect to
         * @callback callback - a callback taking nothing
         */
        self.connectToMaster = function(port, callback) {
            // get our current location
            let loc = location.origin.substr(7);
            loc = loc.substr(0, loc.indexOf(':'));

            // connect to the master socket
            self.masterSocket = new WebSocket(`ws://${loc}:${port}`);

            // fires when the master socket opens
            self.masterSocket.onopen = function() {
                console.log('Connected to master', port);

                // fires when we get a message from the master
                self.masterSocket.onmessage = function(message) {
                    try {
                        var incoming = JSON.parse(message.data);
                    } catch (e) {
                        console.warn('bad message on client-master socket!', message);
                        return;
                    }

                    console.log('master <<', incoming);

                    // handle different messages from the master
                    switch(incoming.action) {
                        case 'ClientHello':
                            /*
                            {
                                "action": "ClientHello",
                                "port": 1234 - the port of the slave to connect to
                            }
                            */
                            // this is all we need the master for, so close that socket and connect to the slave
                            self.masterSocket.close();
                            self.masterSocket = null;
                            self.connectToSlave(incoming.port, callback);
                            // if we're adding more things to master-client, we need to change this
                            break;
                        default:
                            console.warn('unknown message on client-master socket');
                            break;
                    }
                };

                // fires when the master socket closes
                self.masterSocket.onclose = function() {
                    console.log('Disconnected from master', port);
                };
            };
        };

        /**
         * Connect to a slave server
         * @function connectToSlave
         * @memberof typeit
         * @param {int} port - the port of socket on the slave
         * @callback callback - a callback taking nothing
         */
        self.connectToSlave = function(port, callback) {
            // get our current location
            let loc = location.origin.substr(7);
            loc = loc.substr(0, loc.indexOf(':'));

            // connect to the slave socket
            self.slaveSocket = new WebSocket(`ws://${loc}:${port}`);

            // fires when the socket is established
            self.slaveSocket.onopen = function() {
                console.log('Connected to slave', port);

                // send out information about us
                self.sendSlave({
                    action: 'ClientInformation',
                    client_id: self.id
                });

                // fires when we get a message from the slave - handled in clientConnection.js
                self.slaveSocket.onmessage = function(message) {
                    try {
                        var incoming = JSON.parse(message.data);
                    } catch (e) {
                        console.warn('bad message on client-slave socket!', message);
                        return;
                    }

                    if (incoming.action !== 'pong') {
                        console.log('slave <<', incoming);
                    }

                    // handle this in clientConnection
                    clientConnection.handleMessage(self, incoming);
                };

                // fires when the socket closes
                self.slaveSocket.onclose = function() {
                    console.log('Disconnected from slave', port);

                    self.slaveSocket = null;
                    if (self.requestedClose) {
                        self.requestedClose = false;
                    } else {
                        // if we didn't initiate this close, then we should notify the client
                        $('<div>We could not connect to the live service. You may want to export this document when it is done, as new changes may not be saved</div>').dialog({
                            modal: true,
                            title: 'Lost Connection',
                            width: 600,
                            buttons: {
                                'Attempt to Reconnect': function() {
                                    window.location.reload();
                                },
                                'Ok': function() {
                                    $(this).dialog('close');
                                }
                            }
                        });
                    }
                };

                callback();
            };

            // fires when the socket has an error
            self.slaveSocket.onerror = self.handleError;
        };


        /**
         * Send data to the master
         * @function sendMaster
         * @memberof typeit
         * @param {object} data - the message to send. Will be serialized first
         */
        self.sendMaster = function(data) {
            if (self.masterSocket) {
                console.log('master >>', data);
                self.masterSocket.send(JSON.stringify(data));
            } else {
                console.warn('master connection is not open');
            }
        };

        /**
         * Send data to the slave
         * @function sendMaster
         * @memberof typeit
         * @param {object} data - the message to send. Will be serialized first
         */
        self.sendSlave = function(data) {
            if (self.slaveSocket) {
                console.log('slave >>', data);
                self.slaveSocket.send(JSON.stringify(data));
            } else {
                console.warn('slave connection is not open');
            }
        };

        /**
         * Attempt to log the user in
         * @function login
         * @memberof typeit
         * @param {string} username
         * @param {string} password
         * @callback callback - a callback taking (error, success).
         * Success will be true and error will be falsy if the login request succeeded.
         */
        self.login = function(username, password, callback) {
            // only send the request if there are creds filled in the form
            if (username && password) {
                $.ajax({
                    url: '/login',
                    type: 'POST',
                    data: {
                        username: username,
                        password: password
                    },
                    success: function(data) {
                        $('body').css('background', 'none');
                        self.id = data.client_id;
                        self.username = data.payload.username;
                        self.ownedDocuments = data.payload.owned_documents;
                        callback(null, true);
                    },
                    error: function(e) {
                        if (e.status === 403) {
                            callback(null, false);
                        } else {
                            callback(e, false);
                        }
                    }
                });
            } else {
                callback(null, false);
            }
        };

        /**
         * Open a file
         * @function openFile
         * @memberof typeit
         * @param {string} document_id - the id of the document to open
         */
        self.openFile = function(document_id) {
            // if we have a connection open to anyone, close it
            if (self.masterSocket) {
                self.masterSocket.close();
                self.masterSocket = null;
            }
            if (self.slaveSocket) {
                self.requestedClose = true;
                self.slaveSocket.close();
                self.slaveSocket = null;
            }

            // clear the editor
            self.quill.setText('');
            self.quill.disable();

            // send a request to the primary master for the master responsible for the document we want to open
            $.ajax({
                url: '/open_document',
                type: 'POST',
                data: {
                    action: 'join',
                    client_id: self.id,
                    document_id: document_id
                },
                success: function(data) {
                    // connect to the responsible master
                    self.connectToMaster(data.payload.port, (err) => {
                        if (err) {
                            self.handleError(err);
                            return;
                        }

                        // the slave socket is now ready, ask for the document
                        self.sendSlave({
                            action: 'open_document',
                            client_id: self.id,
                            document_id: document_id
                        });
                    });
                },
                error: self.handleError
            });
        };

        /**
         * Generic error handler for all uncaught errors on the page
         * @function handleError
         * @memberof typeit
         * @param {*} error - the error to handle
         */
        self.handleError = function(error) {
            console.log(error);
            throw error;
        };
    }).apply(window.typeit);

    // start it up
    console.log("Starting client...");
    typeit.init();
});
