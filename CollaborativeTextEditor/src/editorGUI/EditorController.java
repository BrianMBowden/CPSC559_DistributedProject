package editorGUI;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;

import javax.swing.JFrame;
import javax.swing.JOptionPane;

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

	final UUID uuid;

	private Client client;

	/**
	 * For testing
	 */
	public EditorController() {
		super("TypeIt");
		uuid = UUID.randomUUID();
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
		uuid = UUID.randomUUID();
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
		return uuid.toString();
	}

	public void setUUID() {
		client.setUUID(uuid);
	}	
}
