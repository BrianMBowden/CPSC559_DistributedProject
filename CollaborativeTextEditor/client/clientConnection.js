window.clientConnection = window.clientConnection || {};

clientConnection.handleMessage = function(self, incoming) {
    switch(incoming.action) {
        default:
            console.warn('Unknown message in client-slave', incoming);
            break;
    }
};
