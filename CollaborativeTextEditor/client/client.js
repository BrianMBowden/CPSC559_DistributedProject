$(document).ready((e) => {
  window.typeit = window.typeit || {};

  (function() {
    let self = this;

    self.id = null;
    self.username = null;
    self.ownedDocuments = [];
    self.masterSocket = null;
    self.slaveSocket = null;
    self.quill = null;
    self.requestedClose = false;

    self.openDocument = {
        id: null,
        title: null,
        shareId: null
    };

    self.init = function() {
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

        setInterval(function() {
            if (self.slaveSocket) {
                self.slaveSocket.send(JSON.stringify({
                    action: 'ping'
                }));
            }
        }, 1000);


      $('#login input[name="submit"]').click((e) => {
          $('#login_fail').text('');
        window.typeit.login($('#login input[name="username"]').val(), $('#login input[name="password"]').val(), (err, ok) => {
          if (err) {
            throw err;
          } else {
              if (!ok) {
                  $('#login_fail').text('invalid credentials');
                  return;
              }
            $('#login').hide();
            $('#doc').show();
            self.quill = new Quill('#editor', {
              theme: 'snow'
            });

            self.quill.setText('');
            self.quill.disable();

            self.quill.on('text-change', function(delta, oldDelta, source) {
              if (source == 'api') {
                console.log("An API call triggered this change.");
              } else if (source == 'user') {
                var offset = null;
                var data = null;
                var insert = null;

                /* Insert does not have any characters to retain */
                if (delta.ops[0].hasOwnProperty ('insert'))
                {
                offset = 0;
                data = delta.ops[0].insert;
                insert = true;
                }
                /* Delete does not have any characters to retain */
                else if (delta.ops[0].hasOwnProperty ('delete'))
                {
                offset = 0;
                insert = false;
                }
                /* Insert has characters to retain */
                else if (delta.ops[1].hasOwnProperty ('insert'))
                {
                offset = delta.ops[0].retain;
                data = delta.ops[1].insert;
                insert = true;
                }
                /* Delete has characters to retain */
                else
                {
                offset = delta.ops[0].retain;
                insert = false;
                }

                /* Send "insert" message */
                if (insert) {
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
                    // remove
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
          }
        });
      });

      $('#exit-button').click((e) => {
        location.reload();
      });

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

      $('#export-button').click((e) => {
          let file = new Blob([self.quill.getText()], {type: 'text/plain'});
          let a = document.createElement('a');
          a.href = URL.createObjectURL(file);
          a.download = `${self.openDocument.title}.txt`;
          a.click();
      });

      $('#new-button').click((e) => {
        if (self.masterSocket) {
          self.masterSocket.close();
        }
        if (self.slaveSocket) {
            self.requestedClose = true;
          self.slaveSocket.close();
        }
        self.quill.setText('');
        self.quill.disable();

        $.ajax({
          url: '/new_document',
          type: 'POST',
          data: {
            action: 'create',
            client_id: self.id
          },
          success: function(data) {
            self.ownedDocuments.push({
                id: data.payload.document.DocID,
                DocShareID: data.payload.document.DocShareID,
                title: data.payload.document.title
            });
            self.connectToMaster(data.payload.port, (err) => {
              if (err) {
                self.handleError(err);
                return;
              }

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

      $('#open-button').click((e) => {
          if (self.ownedDocuments.length) {
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

    self.connectToMaster = function(port, callback) {
      // connect to the master, then connect to the slave
      self.masterSocket = new WebSocket(`ws://localhost:${port}`);
      self.masterSocket.onopen = function() {
        console.log('Connected to master', port);

        self.masterSocket.onmessage = function(message) {
          try {
            var incoming = JSON.parse(message.data);
          } catch (e) {
            console.warn('bad message on client-master socket!', message);
            return;
          }

          console.log('master <<', incoming);

          switch(incoming.action) {
            case 'ClientHello':
                self.masterSocket.close();
                self.masterSocket = null;
                self.connectToSlave(incoming.port, callback);
                // if we're adding more things to master-client we need to change this
                break;
            default:
            console.warn('unknown message on client-master socket');
            break;
          }
        };

        self.masterSocket.onclose = function() {
          console.log('Disconnected from master', port);
        };
      };
    };

    self.connectToSlave = function(port, callback) {
      self.slaveSocket = new WebSocket(`ws://localhost:${port}`);
      self.slaveSocket.onopen = function() {
        console.log('Connected to slave', port);
        self.slaveSocket.send(JSON.stringify({
            action: 'ClientInformation',
            client_id: self.id
        }));
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

          clientConnection.handleMessage(self, incoming);
        };

        self.slaveSocket.onclose = function() {
            console.log('Disconnected from slave', port);
            self.slaveSocket = null;
            if (self.requestedClose) {
                self.requestedClose = false;
            } else {
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
      self.slaveSocket.onerror = self.handleError;
    };

    self.sendMaster = function(data) {
      if (self.masterSocket) {
        console.log('master >>', data);
        self.masterSocket.send(JSON.stringify(data));
      } else {
        console.warn('master connection is not open');
      }
    };

    self.sendSlave = function(data) {
      if (self.slaveSocket) {
        console.log('slave >>', data);
        self.slaveSocket.send(JSON.stringify(data));
      } else {
        console.warn('slave connection is not open');
      }
    };

    self.Exit = function(){
      console.log('sending logout request');
      $('body').css('background', '#498e96');

    }

    self.login = function(username, password, callback) {
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
      }
    };

    self.openFile = function(document_id) {
        if (self.masterSocket) {
            self.masterSocket.close();
        }
        if (self.slaveSocket) {
            self.requestedClose = true;
            self.slaveSocket.close();
        }
        self.quill.setText('');
        self.quill.disable();
        $.ajax({
          url: '/open_document',
          type: 'POST',
          data: {
            action: 'join',
            client_id: self.id,
            document_id: document_id
          },
          success: function(data) {
            self.connectToMaster(data.payload.port, (err) => {
              if (err) {
                self.handleError(err);
                return;
              }

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

    self.handleError = function(error) {
      console.log(error);
      throw error;
    };
  }).apply(window.typeit);


  console.log("Starting client...");
  typeit.init();
});
