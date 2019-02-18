package editorGUI;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;

import javax.swing.JFrame;
import java.awt.Color;
import java.awt.Toolkit;
import java.awt.Window.Type;
import java.io.File;
import java.awt.Rectangle;

/**
 * @author arshdeep.dhillon1
 *
 */
public class EditorController extends JFrame {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	private EditorView gui;

	/**
	 * Create the frame.
	 */
	public EditorController() {
		super("TypeIt");
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
	 * 
	 */
	private void setDefaultDocName() {
		this.setTitle("Untitled document");
		// notify server
	}

	/**
	 *  
	 * @param title
	 * @param docID
	 */
	public void renameDocName(String title, String docID) {
		// notify the server so it can propagate the updated title to all clients that are connected to this doc
		
		// then change the title
		gui.setTitleName(title);

	}
}
