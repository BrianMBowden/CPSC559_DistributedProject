$(document).ready((e) => {
  window.typeit = window.typeit || {};

  (function() {
    let self = this;

    self.id = null;
    self.username = null;
    self.ownedDocuments = [];
    self.masterSocket = null;
    self.slaveSocket = null;

    self.init = function() {
      $('#login input[name="submit"]').click((e) => {
        window.typeit.login($('#login input[name="username"]').val(), $('#login input[name="password"]').val(), (err) => {
          if (err) {
            alert('invalid username/password');
          } else {
            $('#login').hide();
            $('#doc').show();
            var quill = new Quill('#editor', {
              theme: 'snow'
            });

            quill.on('text-change', function(delta, oldDelta, source) {
              if (source == 'api') {
                console.log("An API call triggered this change.");
              } else if (source == 'user') {
                console.log("src = user, entered[" + quill.getText() + "]");
              }
            });
          }
        });
      });

      $('#exit-button').click((e) => {
        location.reload();
      });

      $('#new-button').click((e) => {
        if (self.masterSocket) {
          self.masterSocket.close();
        }
        if (self.slaveSocket) {
          self.slaveSocket.close();
        }

        $.ajax({
          url: '/new_document',
          type: 'POST',
          data: {
            action: 'create',
            client_id: self.id
          },
          success: function(data) {
            self.ownedDocuments.push(data.payload.document);
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
                buttons: {
                    Open: function() {
                        dialog.dialog('close');
                        self.openFile(dialog.find('select').val());
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

          console.log('slave <<', incoming);

          clientConnection.handleMessage(self, message);
        };

        self.slaveSocket.onclose = function() {
          console.log('Disconnected from slave', port);
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


    }

    self.login = function(username, password, callback) {
      console.log('sending login request');
      $.ajax({
        url: '/login',
        type: 'POST',
        data: {
          username: username,
          password: password
        },
        success: function(data) {
          self.id = data.client_id;
          self.username = data.payload.username;
          self.ownedDocuments = data.payload.owned_documents;
          callback();
        },
        error: function(e) {
          callback(e);
        }
      });
    };

    self.openFile = function(document_id) {
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
    };
  }).apply(window.typeit);


  console.log("Starting client...");
  typeit.init();
});
