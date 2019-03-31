package editorGUI;

import javax.swing.JPanel;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;
import java.awt.Button;
import java.awt.Font;
import javax.swing.JSeparator;
import javax.swing.JTextField;
import javax.swing.JLabel;
import javax.swing.SwingConstants;
import javax.swing.ImageIcon;

public class LoginGUI extends JPanel
{
	private EditorController frame;
	private JTextField userNameField;
	private JTextField passwordField;
//	private JLabel userNameLabel;
//	private JLabel passwordLabel;
//	private JSeparator userNameSeparator;
//	private JSeparator passwordSeparator;
//	private JLabel monitorLabel;
//	private JLabel typeItLabel;

	/**
	 * Create the frame.
	 * 
	 * @param editorController
	 */
	public LoginGUI(EditorController editorController)
	{
		this.frame = editorController;
		createLogInGUI();
	}

	private void createLogInGUI()
	{
		setLayout(null);
		int width = 600;
		int height = 400;
		JPanel leftSidePanel = new JPanel();
		setPreferredSize(new Dimension(width, height));

		leftSidePanel.setBackground(new Color(42, 183, 202));
		leftSidePanel.setBounds(0, 0, 322, 400);
		add(leftSidePanel);
		leftSidePanel.setLayout(null);

		JLabel typeItLabel = new JLabel("TypeIt");
		typeItLabel.setBounds(83, 152, 137, 84);

		typeItLabel.setBackground(new Color(255, 255, 255));
		typeItLabel.setFont(new Font("Open Sans", Font.PLAIN, 25));
		typeItLabel.setHorizontalAlignment(SwingConstants.CENTER);
		typeItLabel.setForeground(new Color(42, 183, 202));
		leftSidePanel.add(typeItLabel);

		JLabel monitorLabel = new JLabel("");
		monitorLabel.setIcon(new ImageIcon("images\\monitor-img.png"));
		monitorLabel.setBounds(0, 0, 322, 400);
		leftSidePanel.add(monitorLabel);

		JPanel rightSidePanel = new JPanel();
		rightSidePanel.setBackground(new Color(32, 33, 35));
		rightSidePanel.setBounds(321, 0, 279, 400);
		add(rightSidePanel);
		rightSidePanel.setLayout(null);

		JSeparator userNameSeparator = new JSeparator();
		userNameSeparator.setBounds(44, 100, 207, 14);
		rightSidePanel.add(userNameSeparator);

		userNameField = new JTextField();
		userNameField.setForeground(new Color(42, 183, 202));
		userNameField.setBackground(new Color(32, 33, 35));
		userNameField.setBorder(null);
		userNameField.setBounds(44, 80, 207, 20);
		rightSidePanel.add(userNameField);
		userNameField.setColumns(10);

		passwordField = new JTextField();
		passwordField.setForeground(new Color(42, 183, 202));
		passwordField.setBackground(new Color(32, 33, 35));
		passwordField.setBorder(null);
		passwordField.setBounds(44, 191, 207, 20);
		rightSidePanel.add(passwordField);
		passwordField.setColumns(10);

		JLabel userNameLabel = new JLabel("User Name");
		userNameLabel.setFont(new Font("Tahoma", Font.PLAIN, 16));
		userNameLabel.setForeground(new Color(0, 255, 255));
		userNameLabel.setBounds(31, 38, 94, 20);
		rightSidePanel.add(userNameLabel);

		JLabel passwordLabel = new JLabel("Password");
		passwordLabel.setForeground(Color.CYAN);
		passwordLabel.setFont(new Font("Tahoma", Font.PLAIN, 16));
		passwordLabel.setBounds(31, 145, 94, 20);
		rightSidePanel.add(passwordLabel);

		JSeparator passwordSeparator = new JSeparator();
		passwordSeparator.setBounds(44, 211, 207, 14);
		rightSidePanel.add(passwordSeparator);

		Button signInButton = new Button("Sign In");
		signInButton.addActionListener(new LoginGUIListener());
		signInButton.setBackground(new Color(0, 0, 0));
		signInButton.setBounds(101, 295, 70, 31);
		signInButton.setBackground(new Color(32, 33, 35));
		signInButton.setForeground(new Color(42, 183, 202));
		rightSidePanel.add(signInButton);

	}

	private class LoginGUIListener implements ActionListener
	{

		@Override
		public void actionPerformed(ActionEvent e)
		{
			frame.setClientInfo(userNameField.getText(), passwordField.getText());
		}

	}

}
