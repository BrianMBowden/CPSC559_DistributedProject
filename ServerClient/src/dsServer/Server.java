package dsServer;

import java.net.*;
import java.util.Vector;
import java.io.IOException;

public class Server{
	private ServerSocket serveSock;
	private Vector <DSServerThread> serverThreads;
	private boolean shutdown;
	private int clientCount;
	private boolean debug;
	
	public Server(int port, boolean db) throws IOException {
		
		this.debug = db;
		clientCount = 0;
		shutdown = false;
		
		try {
			serveSock = new ServerSocket(port);
			if (debug){
				System.out.println("Server started on port: " + port);
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
		
		if (args.length != 2){
			System.out.println("<Usage> Java Server Port Number");
			System.out.println("<Usage> Debug Mode");
		}
		
		try {
			// arg[0] is port number
			// arg[1] is debug mode
			server = new Server(Integer.parseInt(args[0]), (Integer.parseInt(args[1]) != 0));			
			server.listen();
		} 
		catch (ArrayIndexOutOfBoundsException e){
			System.out.println("<Usage> Java Server Port Number");
			System.out.println("<Usage> Argument does not provide a port number");
		}
		catch (NumberFormatException e) {
			System.out.println("<Usage> Java Server Port Number");
			System.out.println("<Usage> Argument does not provide a port number");
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
