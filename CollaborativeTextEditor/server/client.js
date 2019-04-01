function Client(masterServer, socket) {
    let self = this;

    self.masterServer = masterServer;
    self.socket = socket;
    self.id = null;

    console.log(`Client created with ID: ${self.id}`);

    self.socket.on('message', function(message) {
        console.log(`[${self.id}] recv ${message}`);
    });
}

module.exports = {
    Client: Client
};
