$(document).ready((e) => {
  window.typeit = window.typeit || {};

  (function() {
    let self = this;

      self.id = null;
      self.username = null;
      self.ownedDocuments = [];
      self.masterSocket = null;
      self.slaveSocket = null;
      self.currentDoc = null;
      
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

	      quill.on ('text-change', function (delta, oldDelta, source)
			{
			    var offset = null;
			    var data = null;
			    var insert = null;
			    console.log (delta); /* <<DBUG>> */

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
			    if (insert)
				self.sendSlave (JSON.parse (`{"action":"insert", "client_id":"${self.id}", "document_id":"${self.currentDoc}", "payload":{"data_type":"text", "offset":${offset}, "length":1, "data":"${data}"}}`));
			    else /* Send "remove" message */
				self.sendSlave (JSON.parse (`{"action":"delete", "client_id":"${self.id}", "document_id":"${self.currentDoc}", "payload":{"data_type":"text", "offset":${offset}, "length":1}}`));
			});
	  }
	});
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
		self.currentDoc = data.payload.document.DocID;
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

    self.handleError = function(error) {
      console.log(error);
    };
  }).apply(window.typeit);


  console.log("Starting client...");
  typeit.init();
});
