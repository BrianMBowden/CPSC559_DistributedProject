/* =============================================================================
 * dsServer.java
 * =============================================================================
 * Author: Brian Bowden
 * Date: February 2019
 * =============================================================================
 * A simple multi-threaded server designed for a distributed system
 *
 * from the project directory "ServerCLient" compile with:
 * >javac -d ./bin/dsServer/ ./src/dsServer/Server.java
 *
 * from the bin folder in the project directory, run with:
 * >java dsServer.Server [debug mode]
 * 					to run with debugging enabled, debug mode is an integer
  * 				to run with debugging disabled, no integer needs to be provided
 * =============================================================================
 *
*/


package dsServer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Vector;

public class Server{
	private ServerSocket serveSock;
	private Vector <DSServerThread> serverThreads;
	private boolean shutdown;
	private int clientCount;
	private boolean debug;

	private static int PORT = 6666;

	public Server(boolean db) throws IOException {

		this.debug = db;
		clientCount = 0;
		shutdown = false;

		try {
			serveSock = new ServerSocket(PORT);
			if (debug){
				System.out.println("Server started on port: " + PORT);
			}
		}
		catch (IOException e){
			System.out.println("Could not create Server socket");
			throw new IOException();
		}
		serverThreads = new Vector <DSServerThread> (0,1);
	}

	public static void main(String [] args){

		Server server;
		boolean db = false;
		File fp = new File("./../../testfile.txt");
		FileReader fReader;
		FileWriter fWriter;
		
		if (args.length != 0){
			System.out.println("<Usage> Debug Mode");
			db = true;
		}
		
		try {
			//TODO: implement file read/write from server thread
			fWriter = new FileWriter(fp);
			fReader = new FileReader(fp);
		} catch (IOException e1) {
			e1.printStackTrace();
		}

		try {
			// arg[0] is port number
			// arg[1] is debug mode
			server = new Server(db);
			server.listen();
		}
		catch (IOException e){
			System.out.println("Failed to create Socket");
			// wrap this in a loop later to ask for new sockets
			System.out.println("System will exit");
			return;
		}



	}

	private void listen(){
		@SuppressWarnings("resource")
		Socket client = new Socket();
		DSServerThread DSthread;

		while(!shutdown){
			try {
				client = serveSock.accept();
				if (debug){
					System.out.println("Client " + client.getInetAddress() + "has been accepted");
				}
				DSthread = new DSServerThread(client, this, clientCount++, debug);
				serverThreads.add(DSthread);
				DSthread.start();
			} catch (IOException e) {
				if (debug){
					System.out.println("Client " + client.getInetAddress() + " has closed connection");
				}
			}
		}
		while(true){
			try {
				client.close();
				break;
			} catch (IOException e) {
				System.out.println("Could not close Client Socket");
				continue;
			}
		}
		return;
	}

	public void kill (DSServerThread DSS){
		if (debug){
			System.out.println("Killing Client" + DSS.getID());
		}

		// find the thread in the vector and remove it
		for (int i = 0; i < serverThreads.size(); i++){
			if (serverThreads.elementAt(i) == DSS){
				serverThreads.remove(i);
			}
		}
	}

	public void killAll (){
		shutdown = true;
		System.out.println("server shutting down");
		// backup data in here somewhere
		for (int i = serverThreads.size() - 1; i >=0; i--){
			try {
				if (debug){
					System.out.println("Killing Client: " + serverThreads.elementAt(i).getID());
				}
				serverThreads.elementAt(i).getSocket().close();
			} catch (IOException e) {
				System.out.println("Could not close socket");
			}
			serverThreads.remove(i);
			}
		try {
			serveSock.close();
		} catch (IOException e) {
			System.out.println("Could not close Server socket");
		}
	}
}
