package dsServer;

import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.*;
import java.net.*;


public class DSThreadData {
	private BufferedReader stdIn; // = new BufferedReader(new InputStreamReader(System.in));
	private DataInputStream in;
	private DataOutputStream out;
	private String incoming;
	private File clientFile;
	
	public DSThreadData(Socket sock) throws IOException{
		try {
			in = new DataInputStream(sock.getInputStream());
		} catch (UnknownHostException e) {
			throw new UnknownHostException("Host not verified on socket " + sock);
		}
		catch (IOException i){
			throw new IOException("input stream not verified");
		}
		
		try {
			out = new DataOutputStream(sock.getOutputStream());
		}
		catch (IOException o) {
			throw new IOException("output stream not verified");
		}
	}
	
	public String getIncoming(){ return incoming; }
	public void setIncoming(String string){ incoming = string; }
	public DataInputStream getIn(){ return in; }
	public DataOutputStream getOut(){ return out; }
}

