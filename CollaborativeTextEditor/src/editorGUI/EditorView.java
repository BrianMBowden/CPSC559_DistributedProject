package editorGUI;

import javax.swing.JPanel;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

import javax.swing.GroupLayout;
import javax.swing.ImageIcon;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.filechooser.FileFilter;
import javax.swing.filechooser.FileNameExtensionFilter;
import javax.swing.text.DefaultCaret;

import java.awt.Color;
import java.awt.Toolkit;
import java.awt.datatransfer.Clipboard;
import java.awt.datatransfer.StringSelection;

/**
 * This class updates its state based on client interaction with the editor 
 * 
 * @author arshdeep.dhillon1
 *
 */
@SuppressWarnings("serial")
public class EditorView extends JPanel {

	private JFrame frame;
	private JTextArea txtArea = new JTextArea();
	private JMenuBar menu;
	private JMenu file, collab;
	private JMenuItem open, export, exit, joinDoc, shareDoc;

	private JScrollPane scrollPane;
	private JFileChooser fChooser = new JFileChooser();
	private final String UUID;

	// setting up editor
	public EditorView(EditorController frame) {
		UUID = frame.getDocID();
		this.frame = frame;
		
		GroupLayout layout = new GroupLayout(this);
		
		setLayout(layout);

		// setting up side scrollpane to add scroll bars
		scrollPane = new JScrollPane(txtArea, JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED,
				JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);

		// FileFilter allows to filter out unwanted text files when user is viewing list
		// of files to open in the editor
		FileFilter txtFilter = new FileNameExtensionFilter("Text files", "txt");
		fChooser.setFileFilter(txtFilter);

		// add components to JPanel

		// create a menu bar and menu items
		menu = new JMenuBar();
		menu.setBackground(new Color(179, 205, 224));
		file = new JMenu("File");
		collab = new JMenu("Collaborate");

		// create sub-menu items add icon to sub-menu item
		export = new JMenuItem("Export", new ImageIcon("images/icon-save-doc-16.png"));
		open = new JMenuItem("Open File...", new ImageIcon("images/icon-open-doc-16.png"));
		joinDoc = new JMenuItem("Join...", new ImageIcon("images/icon-collab-doc-16.png"));
		shareDoc = new JMenuItem("Share", new ImageIcon("images/icon-share-doc-16.png"));
		exit = new JMenuItem("Exit");

		// add the sub-menu items into `File` menu
		file.add(open);
		file.addSeparator(); // this is to divide `File` sub items into sections but adding a horizontal line
		file.add(export);
		file.addSeparator();
		file.add(exit);
		collab.add(joinDoc);
		collab.add(shareDoc);

		// add the menu items into menu bar
		menu.add(file);
		menu.add(collab);
		this.frame.setJMenuBar(menu);

		// add event listener
		export.addActionListener(new ExportLisnr());
		open.addActionListener(new OpenLisnr());
		exit.addActionListener(new ExitLisnr());
		
		//TODO: add joinDoc event, not sure if view should be doing this
		
		shareDoc.addActionListener(new ShareLisnr());
		layout.setHorizontalGroup(layout.createParallelGroup().addComponent(scrollPane));
		layout.setVerticalGroup(layout.createSequentialGroup().addComponent(scrollPane));
	}

	private class ShareLisnr implements ActionListener {

		@Override
		public void actionPerformed(ActionEvent arg0) {
			StringSelection stringSelection = new StringSelection(UUID);
			Clipboard clipboard = Toolkit.getDefaultToolkit().getSystemClipboard();
			clipboard.setContents(stringSelection, null);
			JOptionPane.showMessageDialog(null, "Sharable Link Copied!", "", JOptionPane.PLAIN_MESSAGE);
		}

	}

	private class ExportLisnr implements ActionListener {

		@Override
		public void actionPerformed(ActionEvent e) {
			exportFile();
		}

		private void exportFile() {

			try {
				FileWriter fWriter = null;

				fWriter = new FileWriter(frame.getTitle() + ".txt");
				txtArea.write(fWriter);
				fWriter.close();
			} catch (IOException e) {
				System.out.println("ERROE: OPEN FILE" + e.getMessage());
			}
		}
	}

	private class OpenLisnr implements ActionListener {

		@Override
		public void actionPerformed(ActionEvent arg0) {
			if (fChooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION) {
				openFile(fChooser.getSelectedFile().getAbsolutePath());
			}

		}

		private void openFile(String absolutePath) {
			// TODO: show client's files that are on the server  

			try {
				FileReader fReader = null;
				fReader = new FileReader(absolutePath);
				txtArea.read(fReader, null);
				fReader.close();
				String fileName = new File(absolutePath).getName().split("\\.(?=[^\\.]+$)")[0];
				setTitleName(fileName);
			} catch (IOException e) {
//				e.printStackTrace();
				System.out.println("ERROE: OPEN FILE" + e.getMessage());
			}
		}

	}

	public void setTitleName(String title) {
		if (frame != null) {
			frame.setTitle(title);
		}
	}
}
