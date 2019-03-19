package editorGUI;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;

import javax.swing.JEditorPane;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.text.Element;

import client.Client;

import java.awt.Color;
import java.awt.Toolkit;
import java.awt.Window.Type;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.UUID;
import java.awt.Rectangle;

/**
 * This class handles input from the client and renders the appropriate view by
 * updating the Model.
 * 
 * @author arshdeep.dhillon1
 *
 */
public class EditorController extends JFrame {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	private EditorView gui;

	final UUID CLIENT_UUID;
	final UUID DOC_UUID;
	private Client client;

	/**
	 * For testing
	 */
	public EditorController() {
		super("TypeIt");
		CLIENT_UUID = UUID.randomUUID();
		DOC_UUID = UUID.randomUUID();
		setIconImage(Toolkit.getDefaultToolkit().getImage("images/icon-logo-16.png"));
		setBackground(Color.WHITE);
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setPreferredSize(new Dimension(600, 600));
		gui = new EditorView(this);
		getContentPane().add(gui, BorderLayout.CENTER);
		getContentPane().validate();
		pack();
		this.setLocationRelativeTo(null);
		this.setBackground(new Color(100, 151, 177));
		setDefaultDocName();

		setVisible(true);
	}

	/**
	 * Create the frame.
	 * 
	 * @param client
	 */

	public EditorController(Client client) {
		super("TypeIt");
		CLIENT_UUID = UUID.randomUUID();
		DOC_UUID = UUID.randomUUID();
		setIconImage(Toolkit.getDefaultToolkit().getImage("images/icon-logo-16.png"));
		setBackground(Color.WHITE);
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setPreferredSize(new Dimension(600, 600));
		gui = new EditorView(this);
		getContentPane().add(gui, BorderLayout.CENTER);
		getContentPane().validate();
		pack();
		this.setLocationRelativeTo(null);
		this.setBackground(new Color(100, 151, 177));
		setDefaultDocName();

		this.client = client;
		setVisible(true);
	}

	/**
	 * 
	 */
	private void setDefaultDocName() {
		this.setTitle("Untitled document");
	}

	/**
	 * Renames the client's current viewing document title to the specified string.
	 * 
	 * @param title
	 * @param docID
	 */
	public void renameDocName(String title, String docID) {
		// then change the title
		gui.setTitleName(title);
	}

	public String getDocID() {
		return DOC_UUID.toString();
	}

	public void setClientUUID() {
		client.setUUID(CLIENT_UUID);
	}

	public void RenameDoc() {
		String title = JOptionPane.showInputDialog(null, "New Name", "Not Valid Name", JOptionPane.PLAIN_MESSAGE);
		if (title != null) {
			while (title.trim().length() < 1) {
				title = JOptionPane.showInputDialog(null, "New Name", "Not Valid Name", JOptionPane.ERROR_MESSAGE);
			}
			gui.setTitleName(title);
			// TODO: notify server about this change
		}
	}



	/**
	 * This is to get the Document ID from the client. Which then sends a request to
	 * the server on behalf of the client.
	 */
	public void getJoinDocID() {
		// TODO: send a `get document` (or some type of get doc protocol) request to the
		// server, which should then send the text that contains within that document to
		// that client.

		String collabDocID = null;

		boolean forEver = true;
		while (forEver) {
			collabDocID = JOptionPane.showInputDialog(null, "Document ID", "Must Enter A Document ID",JOptionPane.PLAIN_MESSAGE);

			// if client didnt close the dialog window
			if (collabDocID != null) {

				if (collabDocID.trim().length() < 1) {
					JOptionPane.showMessageDialog(null, "Empty Document ID", "Error", JOptionPane.ERROR_MESSAGE);
				}

				// TODO: Update this call when client-server protocol is finalized

				// Example call to the server
				// if a client entered an invalid link
				//else if (!client.checkDocExist(collabDocID)) {
					//JOptionPane.showMessageDialog(null, "Document ID Does Not Exist", "Error",JOptionPane.ERROR_MESSAGE);
				//} 
				
				else {
					// otherwise join document
					JoinDoc(collabDocID);
					forEver = false;
				}
			} else {
				// dialog window closed by client
				forEver = false;
			}
		}
	}

	/**
	 * Given an ID of the document to join, JoinDoc send a `JOIN` action to the server. 
	 * @param docIDToJoin - ID of the document you wish to join. 
	 */
	private void JoinDoc(String docIDToJoin) {
		// TODO: Update this when client-server is finalized

		String action = String.format("{\"action\": \"JOIN\",\"file_id\": \"%s\"}", docIDToJoin);
		if (client != null) {
			client.sentMssgToServer(action);
		} else {
			System.out.println("IN " + this.getClass().getName() + ": client null");
			System.out.println("\t action: " + action);
		}
	}
	
}
