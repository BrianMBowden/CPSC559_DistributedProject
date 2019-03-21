package editorGUI;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;

import javax.swing.JEditorPane;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
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
public class EditorController extends JFrame
{
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	private EditorView gui;

	final UUID CLIENT_UUID;
	final UUID DOC_UUID;
	private Client client;
	LoginGUI logInGUI;

	private JPanel parentPanel;

	public EditorController()
	{
		super("TypeIt");
		CLIENT_UUID = UUID.randomUUID();
		DOC_UUID = UUID.randomUUID();

		setIconImage(Toolkit.getDefaultToolkit().getImage("images/icon-logo-16.png"));
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setPreferredSize(new Dimension(600, 400));
		setResizable(false);

		// setup the root panel
		parentPanel = new JPanel();
		parentPanel.setBorder(null);
		parentPanel.setLayout(new BorderLayout(0, 0));

		// setup the login panel
		logInGUI = new LoginGUI(this);
		logInGUI.setBorder(null);
		logInGUI.setBounds(0, 0, 594, 571);
		logInGUI.setLayout(new BorderLayout(0, 0));

		// add the login panel to the root panel
		parentPanel.add(logInGUI);
		getContentPane().add(parentPanel);
		pack();
		
		setLocationRelativeTo(null);
		setVisible(true);
	}

	/**
	 * Create the frame.
	 * 
	 * @param client
	 */

//	public EditorController(Client client)
//	{
//		super("TypeIt");
//		CLIENT_UUID = UUID.randomUUID();
//		DOC_UUID = UUID.randomUUID();
//		setIconImage(Toolkit.getDefaultToolkit().getImage("images/icon-logo-16.png"));
//		setBackground(Color.WHITE);
//		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
//		setPreferredSize(new Dimension(600, 600));
//		gui = new EditorView(this);
//		getparentPanel().add(gui, BorderLayout.CENTER);
//		getContentPane().validate();
//		pack();
//		this.setLocationRelativeTo(null);
//		this.setBackground(new Color(100, 151, 177));
//		setDefaultDocName();
//		this.client = client;
//		setVisible(true);
//	}

	/**
	 * To set a default name of a text document.
	 */
	private void setDefaultDocName()
	{
		this.setTitle("Untitled document");
	}

	/**
	 * Renames the client's current viewing document title to the specified string.
	 * 
	 * @param title
	 * @param docID
	 */
	public void renameDocName(String title, String docID)
	{
		// then change the title
		gui.setTitleName(title);
	}

	public String getDocID()
	{
		return DOC_UUID.toString();
	}

	public void setClientUUID()
	{
		client.setUUID(CLIENT_UUID);
	}

	/**
	 * Updates the document's name based on what client inputs.
	 */
	public void RenameDoc()
	{
		String title = JOptionPane.showInputDialog(null, "New Name", "Not Valid Name", JOptionPane.PLAIN_MESSAGE);
		if (title != null)
		{
			while (title.trim().length() < 1)
			{
				title = JOptionPane.showInputDialog(null, "New Name", "Not Valid Name", JOptionPane.ERROR_MESSAGE);
			}
			gui.setTitleName(title);
			// TODO: notify server about this change
		}
	}

	/**
	 * Gets the document's ID from the client then sends a request to the server on
	 * behalf of the client.
	 */
	public void getJoinDocID()
	{
		// TODO: send a `get document` (or some type of get doc protocol) request to the
		// server, which should then send the text that contains within that document to
		// that client.

		String collabDocID = null;

		boolean forEver = true;
		while (forEver)
		{
			collabDocID = JOptionPane.showInputDialog(null, "Document ID", "Must Enter A Document ID",
					JOptionPane.PLAIN_MESSAGE);

			// if client didnt close the dialog window
			if (collabDocID != null)
			{

				if (collabDocID.trim().length() < 1)
				{
					JOptionPane.showMessageDialog(null, "Empty Document ID", "Error", JOptionPane.ERROR_MESSAGE);
				}

				// TODO: Update this call when client-server protocol is finalized

				// Example call to the server
				// if a client entered an invalid link
				// else if (!client.checkDocExist(collabDocID)) {
				// JOptionPane.showMessageDialog(null, "Document ID Does Not Exist",
				// "Error",JOptionPane.ERROR_MESSAGE);
				// }

				else
				{
					// otherwise join document
					JoinDoc(collabDocID);
					forEver = false;
				}
			} else
			{
				// dialog window closed by client
				forEver = false;
			}
		}
	}

	/**
	 * Given an ID of the document to join, JoinDoc send a `JOIN` action to the
	 * server.
	 * 
	 * @param docIDToJoin - ID of the document you wish to join.
	 */
	private void JoinDoc(String docIDToJoin)
	{
		// TODO: Update this when client-server is finalized

		String action = String.format("{\"action\": \"JOIN\",\"file_id\": \"%s\"}", docIDToJoin);
		if (client != null)
		{
			client.sentMssgToServer(action);
		} else
		{
			System.out.println("IN " + this.getClass().getName() + ": client null");
			System.out.println("\t action: " + action);
		}
	}

	public void setClientInfo(String name, String password)
	{
		// TODO: make client send a message to the server, asking if `name` is valid or
		// not.
		// then the client will set its name based on if the sever send a `ok` (or some
		// type of valid message back)
		// client.setName(name);
		// client.setPassword(password);

		// for now i will just switch to editor view

		setVisible(false);
		
		//remove the login panel
		parentPanel.remove(logInGUI);

		//setup the editor gui panel
		gui = new EditorView(this);
		
		//add the editor gui panel to the root panel
		parentPanel.add(gui, BorderLayout.CENTER);
		parentPanel.revalidate();
		parentPanel.repaint();
		pack();

		setLocationRelativeTo(null);
		setResizable(true);
		setBackground(new Color(100, 151, 177));
		setDefaultDocName();
		setVisible(true);
	}

}
