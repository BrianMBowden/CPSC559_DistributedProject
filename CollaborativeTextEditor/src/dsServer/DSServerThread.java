
package dsServer;

import java.io.IOException;
import java.net.*;

public class DSServerThread extends Thread {
	private Socket sock;
	private Server parent;
	private DSThreadData data;
	private int idNum;
	private boolean debug;

	public DSServerThread (Socket s, Server p, int i, boolean d){
		sock = s;
		parent = p;
		idNum = i;
		debug = d;
		data = null;
	}

	public int getID() { return idNum; }
	public Socket getSocket(){ return sock; }

	public void run(){
		//this is where we do stuff
		try {
			data = new DSThreadData(sock);
		} catch (IOException e) {
			System.out.println("Data Stream not verified");
			parent.kill(this);
		}

		try {
			data.getOut().writeUTF("Hello Client");
		} catch (IOException e) {
			e.printStackTrace();
		}

		if (debug){
			System.out.println("Waiting for user...");
		}
		
		//TODO: listen for input from client (json packets)
		while (true){
			try {
				System.out.println("in the loop on the server side");
				String input = data.getIn().readUTF();
				System.out.println(input);	
			} catch (IOException e) {
				// Client disconnected
				System.out.println("Client " + idNum + " closed connection");
				parent.kill(this);
				break;
			}
		}

	}

}
