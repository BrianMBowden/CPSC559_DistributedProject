package editorGUI;

import javax.swing.SwingUtilities;

/**
 * Client stub 
 * @author arshdeep.dhillon1
 *
 */
public class TempEditorControllerCaller {
	public static void main(String[] args) {
		SwingUtilities.invokeLater(new Runnable() {
			
			@Override
			public void run() {
				new EditorController();
			}
		});
	}
}
