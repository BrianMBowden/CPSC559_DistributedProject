/* =============================================================================
 * dsClient.java
 * =============================================================================
 * Author: Brian Bowden
 * Date: February 2019
 * =============================================================================
 * A simple Client program to be extended up opun later
 *
 * from the project directory "ServerCLient" compile with:
 * >javac -d ./bin/dsClient/ ./src/dsClient/Client.java
 *
 * from the project bin directory, run with:
 * >java dsClient.Client [debug mode]
 * 				to run with debugging enabled, debug mode is an integer
 * 				to run with debugging disabled, no integer needs to be provided
 *
 *
 * =============================================================================
 *
*/

package dsClient;

import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.UUID;

import editorGUI.EditorController;

public class Client {
	private Socket sock;
	private String userInput;
	private BufferedReader stdIn;
	private DataInputStream in;
	private DataOutputStream out;
	private boolean debug;
	private UUID clientUUID;
	private String password;
	private String clientName;
	
	private EditorController editC;

	private static String IP_ADDRESS = "127.0.0.1";
	private static int PORT = 6666;

	public Client(boolean d) throws IOException, UnknownHostException{
		debug = d;
		setStdIn(new BufferedReader(new InputStreamReader(System.in)));
		editC = new EditorController();
		editC.setClient(this);
		editC.setVisible(true);
	}
	
	public void setUUID(UUID clientUUID){this.clientUUID = clientUUID;}
	public void setPassword(String password){this.password = password;}
	public void setName(String name){this.clientName = name;}
	public String getName(){return this.clientName;}
	public String getPassword(){return this.password;}
	public EditorController getEditorController(){return this.editC;}
	public void setEditorController(EditorController editor){this.editC = editor;}

/*	public static void main (String[] args){

		Client client;
		boolean d = false;
		if (args.length == 1){
			d = true;
		}

		try {
			client = new Client(d);
			client.connect();
			client.run();
		} catch (IOException e) {
			return;
		}
	}*/

	public void connect() throws IOException, UnknownHostException {
		try {
			sock = new Socket(InetAddress.getByName(IP_ADDRESS), PORT);
		} catch (UnknownHostException e) {
			System.out.println("<Usage> Java Client");
			System.out.println("Invalid hostname");
			throw e;
		} catch (IOException i) {
			System.out.println("Could not connect to " + IP_ADDRESS);
			throw i;
		}
	}

	public void run(){

		if (debug){
			System.out.println("Connected to: " + sock.getInetAddress().getHostAddress() + " on Port " + sock.getPort() );
		}

		try {
			setOut(new DataOutputStream(sock.getOutputStream()));
		} catch (IOException e) {
			System.out.println("Could not create output stream. ");
			return;
		}

		try {
			setIn(new DataInputStream(sock.getInputStream()));
		} catch (UnknownHostException e) {
			System.out.println("Unknown host error. ");
			return;
		} catch (IOException e) {
			System.out.println("Could not create input stream. ");
			return;
		}

		try {
			System.out.println(in.readUTF());
		} catch (IOException e) {
			System.out.println("Could not perform read");
			return;
		}

		//TODO: sending messages to server from here in client
		while(true){
			try {
				setUserInput(stdIn.readLine());
				if (userInput.equals("quit")){
					try {
						out.writeInt(0);
						sock.close();
						break;
					} catch (IOException e) {
						System.out.println("Socket unable to close... exiting anyway");
						System.exit(0);
					}

				}
				else if (userInput.equals("kill")){
					try {
						out.writeInt(1);
						sock.close();
						break;
					} catch (IOException e) {
						System.out.println("Socket unable to close... exiting anyway");
						System.exit(0);
					}
				}
				else {
					setUserInput(null);
					continue;
				}
			} catch (IOException e) {
				System.out.println("Could not read from standard input");
				setUserInput(null);
				continue;
			}
		}

	}
	
	public void sentMssgToServer(String message){
		try {
			out.writeUTF(message);
		} catch (IOException e) {
			// TODO implement this with json Strings
			e.printStackTrace();
		}
	}

	private void setIn(DataInputStream dIn)    { this.in = dIn; }
	private void setOut(DataOutputStream dOut) { this.out = dOut; }
	private void setStdIn(BufferedReader bR)   { this.stdIn = bR; }
	private void setUserInput(String str)      { this.userInput = str; }

}
