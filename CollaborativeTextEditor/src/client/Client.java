package client;

import java.util.UUID;

public class Client {

	private UUID clientUUID;

	public static void main(String[] args) {
	}

	public void setUUID(UUID clientUUID) {
		this.clientUUID = clientUUID;

	}

	public void sentMssgToServer(String message) {
		// TODO: Update this to use appropriate client-server protocol
		System.out.println("\"sentMssgToServer\" NOT IMPLEMENTED YET");
		System.out.println("\t message: " + message);
	}
}