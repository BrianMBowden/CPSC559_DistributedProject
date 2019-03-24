package clientToGUI;

import java.io.IOException;

import dsClient.Client;
import editorGUI.EditorController;

public class ClientToGUI {

	public static void main(String[] args) {
		
		try {
			Client client = new Client(true);
			client.connect();
			client.run();
		} catch (IOException e) {
			e.printStackTrace();
		}
		
	}

}
