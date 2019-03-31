package editorGUI;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

/**
 * @author arshdeep.dhillon1
 *
 */
public class ExitLisnr implements ActionListener {

	/* (non-Javadoc)
	 * @see java.awt.event.ActionListener#actionPerformed(java.awt.event.ActionEvent)
	 */
	@Override
	public void actionPerformed(ActionEvent e) {
		//before existing notify server so it can propagate message to other connected clients		
		
		// then exit
		System.exit(0);
	}

}
