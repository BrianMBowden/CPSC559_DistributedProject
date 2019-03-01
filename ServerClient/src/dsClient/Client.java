package dsClient;

import java.io.*;
import java.net.*;

public class Client {
	private Socket sock;
	private String ipAddress;
	private String userInput;
	private BufferedReader stdIn;
	private DataInputStream in;
	private DataOutputStream out;
	private boolean debug;
	
	public Client(String ip, int p, boolean d) throws IOException, UnknownHostException{
		debug = d;
		ipAddress = ip;
		try {
			sock = new Socket(InetAddress.getByName(ipAddress), p);
		} catch (UnknownHostException e) {
			System.out.println("<Usage> Java Client");
			System.out.println("Invalid hostname");
			throw e;
		} catch (IOException i) {
			System.out.println("Could not connect to " + ipAddress);
			throw i;
		}
		setStdIn(new BufferedReader(new InputStreamReader(System.in)));
		
	}
	
	public static void main (String[] args){
		
		Client client;
		
		if (args.length != 3){
			System.out.println("<Usage> Java Client Hostname Port Number");
			System.out.println("Hostname is a string Identifying your Server");
			System.out.println("Port is a Postive Integer Identifying the Port to Connect to the Server");
			System.out.println("<Usage> Debug Mode?");
			return;
		}
		
		try {
			// args[0]
			// args[1]
			// args[2]
			client = new Client(args[0], Integer.parseInt(args[1]), (Integer.parseInt(args[2]) != 0));
			client.run();
		} catch (IOException e) {
			return;
		}
	}
	
	private void run(){
		
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
	
	private void setIn(DataInputStream dIn)    { this.in = dIn; }
	private void setOut(DataOutputStream dOut) { this.out = dOut; }
	private void setStdIn(BufferedReader bR)   { this.stdIn = bR; }
	private void setUserInput(String str)      { this.userInput = str; }

}
