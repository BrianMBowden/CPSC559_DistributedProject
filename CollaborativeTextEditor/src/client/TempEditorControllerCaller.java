package client;

import javax.swing.SwingUtilities;

import editorGUI.EditorController;

/**
 * Client stub
 * 
 * @author arshdeep.dhillon1
 *
 */
public class TempEditorControllerCaller
{
	public static void main(String[] args)
	{
		SwingUtilities.invokeLater(new Runnable()
		{

			@Override
			public void run()
			{
				new EditorController();
			}
		});
	}
}
