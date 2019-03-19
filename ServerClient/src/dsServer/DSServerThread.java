
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

		while (true){
			try {
				int expected;
				expected = data.getIn().readInt();
				if (expected == 0){
					parent.kill(this);
					break;
				}
				else if (expected == 1){
					parent.killAll();
					break;
				}
				else {
					continue;
				}
			} catch (IOException e) {
				// TODO I hate this, change it
				System.out.println("Something Fucked up");
				parent.kill(this);
				break;
			}
		}

	}

}
