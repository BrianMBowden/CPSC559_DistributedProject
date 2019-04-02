window.clientConnection = window.clientConnection || {};

clientConnection.handleMessage = function(self, incoming) {
    switch(incoming.action) {
        // SLAVE TO CLIENT
        case 'update_document':
            let range = self.quill.getSelection();
            self.quill.setText(incoming.content || '');
            self.quill.setSelection(range);
            break;
        case 'update_cursor':
            if (!self.cursors.hasOwnProperty(incoming.client_instance) && self._instance !== incoming.client_instance) {
                self.cursors[incoming.client_instance] = self.cursorsModule.createCursor(incoming.client_instance, incoming.client_username, randomColor());
            }

            self.cursorsModule.moveCursor(incoming.client_instance, incoming.cursor);
            break;
        case 'load_document':
            self.openDocument.id = incoming.document_id;
            self.openDocument.title = incoming.title;
            self.openDocument.shareId = incoming.document_share_id;
            self.quill.setText(incoming.content || '');

            if (incoming.owner == self.id) {
                $('#share-button').show();
            } else {
                $('#share-button').hide();
            }

            $('#export-button,#rename-button').show();
            $('#document-title').attr('data-document-id', incoming.document_id).text(incoming.title);
            self.quill.enable();
            break;
        case 'rename_document':
            for (let doc of self.ownedDocuments) {
                if (doc.id === incoming.document_id) {
                    doc.title = incoming.new_doc_name;
                    break;
                }
            }
            if (self.openDocument.id === incoming.document_id) {
                self.openDocument.title = incoming.new_doc_name;
            }
            $(`#document-title[data-document-id="${incoming.document_id}"]`).text(incoming.new_doc_name);
            break;
        case 'dialog':
            $(`<div>${incoming.content}</div>`).dialog({
                modal: true,
                title: incoming.title,
                buttons: {
                    Ok: function() {
                        $(this).dialog('close');
                    }
                }
            });
        case 'pong':
            break;
        default:
            console.warn('Unknown message in client-slave', incoming);
            break;
    }
};
