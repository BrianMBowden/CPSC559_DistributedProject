package editorGUI;

import javax.swing.JPanel;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
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
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.event.MenuEvent;
import javax.swing.event.MenuListener;
import javax.swing.filechooser.FileFilter;
import javax.swing.filechooser.FileNameExtensionFilter;
import javax.swing.text.DefaultCaret;

import java.awt.Color;

/**
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
//	private boolean isSave = false;

	// setting up editor
	public EditorView(EditorController frame) {
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
		shareDoc = new JMenuItem("Share...", new ImageIcon("images/icon-share-doc-16.png"));
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
//		exit.addMenuListener(new ExitLisnr());
		exit.addActionListener(new ExitLisnr());

		layout.setHorizontalGroup(layout.createParallelGroup().addComponent(scrollPane));
		layout.setVerticalGroup(layout.createSequentialGroup().addComponent(scrollPane));
	}

	/**
	 * @author arshdeep.dhillon1
	 *
	 */
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
//						isSave = true;
			} catch (IOException e) {
				System.out.println("ERROE: OPEN FILE" + e.getMessage());
			}
		}
	}

	/**
	 * @author arshdeep.dhillon1
	 *
	 */
	private class OpenLisnr implements ActionListener {

		@Override
		public void actionPerformed(ActionEvent arg0) {
			if (fChooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION) {
				openFile(fChooser.getSelectedFile().getAbsolutePath());
			}

		}

		private void openFile(String absolutePath) {
			try {
				FileReader fReader = null;
				fReader = new FileReader(absolutePath);
				txtArea.read(fReader, null);
				fReader.close();
//				isSave = true;

			} catch (IOException e) {
//				e.printStackTrace();
				System.out.println("ERROE: OPEN FILE" + e.getMessage());
			}
		}

	}

	public void setTitleName(String title) {
		frame.setTitle(title);
	}

	/*
	// add action to sub items of `File`
	Action Open = new AbstractAction("Open File") {

		@Override
		public void actionPerformed(ActionEvent e) {
			if (fChooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION) {
				openFile(fChooser.getSelectedFile().getAbsolutePath());
			}
		}
	};
	Action Save = new AbstractAction("Save File") {

		@Override
		public void actionPerformed(ActionEvent e) {
			saveFile();
		}
	};

	Action Exit = new AbstractAction("Exit") {

		@Override
		public void actionPerformed(ActionEvent e) {
			// use this when you can
			// frame.setDefacultCloseOperation(JFrame.EXIT_ON_CLOSE);
			System.exit(0);
		}
	};

	// methods of actions
	public void openFile(String fullFilePath) {

		try {

			FileReader fReader = null;
			fReader = new FileReader(fullFilePath);
			txtArea.read(fReader, null);
			fReader.close();
			isSave = true;
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public void saveFile() {
		if (!isSave) {
			System.out.println("IN saveFile()");
			if (fChooser.showSaveDialog(null) == JFileChooser.APPROVE_OPTION) {

				try {
					FileWriter fWriter = null;
					fWriter = new FileWriter(fChooser.getSelectedFile().getAbsoluteFile() + ".txt");
					txtArea.write(fWriter);
					fWriter.close();
					isSave = true;
				} catch (IOException e) {
					e.printStackTrace();
				}

			}
		} else {
			updateSavedFile();
		}
	}

	private void updateSavedFile() {

		try {
			FileWriter fWriter = null;
			fWriter = new FileWriter(fChooser.getSelectedFile().getAbsoluteFile() + ".txt");
			txtArea.write(fWriter);
			fWriter.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}

*/

/*
@SuppressWarnings("serial")
public class EditorView extends JPanel {

	private JFileChooser fChooser = new JFileChooser();
	private JTextArea txtArea = new JTextArea();
	private boolean isSave = false;
	JFrame jFrame;

	// setting up document
	public EditorView(EditorController frame) {
		this.jFrame = frame;

		// setting up side scrollpane to add scroll bars
		JScrollPane scrollPane = new JScrollPane(txtArea, JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED,
				JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);

		// FileFilter allows to filter out unwanted text files when user is viewing list
		// of files to open in the editor
		FileFilter txtFilter = new FileNameExtensionFilter("Text files", "txt");

		fChooser.setFileFilter(txtFilter);

		// add components here

		// add menu bar and menu items to that bar
		JMenuBar menuBar = new JMenuBar();
		this.frame.setJMenuBar(menuBar);

		// create menu item `File`
		JMenu file = new JMenu("File");

		// add `File` to menu bar
		menuBar.add(file);

		// add `Save` and `Open` `Exit` into `File`
		file.add(Save);
		file.add(Open);

		// this is to divide `File` sub items into sections but adding a horizontal line
		file.addSeparator();

		file.add(Exit);

		add(scrollPane);

//		setVisible(true);
	}

	// add action to sub items of `File`
	Action Open = new AbstractAction("Open File") {

		@Override
		public void actionPerformed(ActionEvent e) {
			if (fChooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION) {
				openFile(fChooser.getSelectedFile().getAbsolutePath());
			}
		}
	};
	Action Save = new AbstractAction("Save File") {

		@Override
		public void actionPerformed(ActionEvent e) {
			saveFile();
		}
	};

	Action Exit = new AbstractAction("Exit") {

		@Override
		public void actionPerformed(ActionEvent e) {
			// use this when you can
			// frame.setDefacultCloseOperation(JFrame.EXIT_ON_CLOSE);
			System.exit(0);
		}
	};

	// methods of actions
	public void openFile(String fullFilePath) {

		try {

			FileReader fReader = null;
			fReader = new FileReader(fullFilePath);
			txtArea.read(fReader, null);
			fReader.close();
			isSave = true;
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public void saveFile() {
		if (!isSave) {
			System.out.println("IN saveFile()");
			if (fChooser.showSaveDialog(null) == JFileChooser.APPROVE_OPTION) {

				try {
					FileWriter fWriter = null;
					fWriter = new FileWriter(fChooser.getSelectedFile().getAbsoluteFile() + ".txt");
					txtArea.write(fWriter);
					fWriter.close();
					isSave = true;
				} catch (IOException e) {
					e.printStackTrace();
				}

			}
		} else {
			updateSavedFile();
		}
	}

	private void updateSavedFile() {

		try {
			FileWriter fWriter = null;
			fWriter = new FileWriter(fChooser.getSelectedFile().getAbsoluteFile() + ".txt");
			txtArea.write(fWriter);
			fWriter.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
	*/
}


