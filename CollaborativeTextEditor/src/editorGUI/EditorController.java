package editorGUI;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;

import javax.swing.JFrame;
import java.awt.Color;
import java.awt.Toolkit;
import java.awt.Window.Type;
import java.awt.Rectangle;

public class EditorController extends JFrame {
	private EditorView edtr;

	/**
	 * Create the frame.
	 * 
	 * @param appTitle
	 */
	public EditorController() {
		super("TypeIt");
		setIconImage(Toolkit.getDefaultToolkit().getImage("images/icon-logo.png"));
		setBackground(Color.WHITE);
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setPreferredSize(new Dimension(600, 600));
		getContentPane().add(new EditorView(this), BorderLayout.CENTER);
		getContentPane().validate();
		pack();		
		this.setLocationRelativeTo(null);
		this.setBackground(new Color(100, 151, 177));
		setVisible(true);
	}
}
