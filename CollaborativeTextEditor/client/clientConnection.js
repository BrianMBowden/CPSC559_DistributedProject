window.clientConnection = window.clientConnection || {};

clientConnection.handleMessage = function(self, incoming) {
    switch(incoming.action) {
        // SLAVE TO CLIENT
        default:
            console.warn('Unknown message in client-slave', incoming);
            break;
    }
};
