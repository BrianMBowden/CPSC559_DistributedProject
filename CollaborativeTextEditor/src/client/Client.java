package client;

import java.util.UUID;

import editorGUI.EditorController;

public class Client
{

	private UUID clientUUID;
	private String password;
	private String clientName;
	private EditorController editorController;

//	public static void main(String[] args) {
//	}

	public void setUUID(UUID clientUUID)
	{
		this.clientUUID = clientUUID;

	}

	public void sentMssgToServer(String message)
	{
		// TODO: Update this to use appropriate client-server protocol
		System.out.println("\"sentMssgToServer\" NOT IMPLEMENTED YET");
		System.out.println("\t message: " + message);
	}

	public void setPassword(String password)
	{
		this.password = password;

	}

	public void setName(String name)
	{
		this.clientName = name;
	}

	public String getPassword()
	{
		return (this.password);

	}

	public String getClientName()
	{
		return (this.clientName);
	}

	public EditorController getEditorController()
	{
		return (this.editorController);
	}

	public void setEditorController(EditorController editorController)
	{
		this.editorController = editorController;
	}

}