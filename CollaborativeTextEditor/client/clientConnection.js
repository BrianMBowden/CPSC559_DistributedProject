/**
 * @file clientConnection.js
 * @overview slave -> client message protocol
 */

/**
 * @namespace clientConnection
 */
window.clientConnection = window.clientConnection || {};

/**
 * Handle a message from a slave server
 * @function handleMessage
 * @memberof clientConnection
 * @param {typeit} self - the client instance
 * @param {object} incoming - the data (parsed into an object) from the slave
 */
clientConnection.handleMessage = function(self, incoming) {
    switch(incoming.action) {
        // SLAVE TO CLIENT
        case 'update_document':
            /*  Sent when the client should update their document
                {
                    "action": "update_document",
                    "content" "string with the document's new content"
                }
            */

            // our cursor will shoot to the end when we set the text of the document, so save it and then restore it
            let range = self.quill.getSelection();
            self.quill.setText(incoming.content || '');
            self.quill.setSelection(range);
            break;
        case 'update_cursor':
            /* Sent when a client (not this client) had a cursor update
                {
                    "action": "update_cursor",
                    "client_instance": "typeit._instance of the client that sent the update",
                    "client_username": "the username of the client that updated their cursor"
                    "cursor": Quill.Range
                }
            */

            // if we don't have a cursor for this client, create one
            if (!self.cursors.hasOwnProperty(incoming.client_instance) && self._instance !== incoming.client_instance) {
                self.cursors[incoming.client_instance] = self.cursorsModule.createCursor(incoming.client_instance, incoming.client_username, randomColor());
            }

            self.cursorsModule.moveCursor(incoming.client_instance, incoming.cursor);
            break;
        case 'load_document':
            /* Sent when the client should load the document into their editor
                {
                    "action": "load_document",
                    "document_id": "the id of the document",
                    "title": "the title of the document",
                    "document_share_id": "the ShareID of this document",
                    "content": "the content of the document"
                }
            */

            // save document metadata
            self.openDocument.id = incoming.document_id;
            self.openDocument.title = incoming.title;
            self.openDocument.shareId = incoming.document_share_id;

            // load the editor
            self.quill.setText(incoming.content || '');

            // if we own the document, we get the share button
            if (incoming.owner == self.id) {
                $('#share-button').show();
            } else {
                $('#share-button').hide();
            }

            // in case buttons were hidden because we didn't have an open document, show them
            $('#export-button,#rename-button').show();
            $('#document-title').attr('data-document-id', incoming.document_id).text(incoming.title);

            // we're ready, enable the editor
            self.quill.enable();
            break;
        case 'rename_document':
            /*  Sent when someone (maybe us) renamed the document
                {
                    "action": "rename_document",
                    "document_id": "the id of the document that got renamed",
                    "new_doc_name": "the new title of the document"
                }
            */

            // update this change in our list of owned documents
            for (let doc of self.ownedDocuments) {
                if (doc.id === incoming.document_id) {
                    doc.title = incoming.new_doc_name;
                    break;
                }
            }

            // if this document is open, make the change there too
            if (self.openDocument.id === incoming.document_id) {
                self.openDocument.title = incoming.new_doc_name;
            }

            // update the document title if it's currently open
            $(`#document-title[data-document-id="${incoming.document_id}"]`).text(incoming.new_doc_name);
            break;
        case 'dialog':
            /*  Sent when the slave wants to tell the client something arbitrary
                {
                    "action": "dialog",
                    "content": "dialog content",
                    "title": "dialog title"
                }
            */

            // open a dialog with the content and title
            $(`<div>${incoming.content}</div>`).dialog({
                modal: true,
                title: incoming.title,
                buttons: {
                    Ok: function() {
                        $(this).dialog('close');
                    }
                }
            });
            break;
        case 'pong':
            // disregard these messages - we'll get a close event if something went wrong
            break;
        default:
            console.warn('Unknown message in client-slave', incoming);
            break;
    }
};
