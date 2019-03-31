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

import java.net.*;
import java.util.Vector;

import com.amazonaws.AmazonClientException;
import com.amazonaws.AmazonServiceException;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import java.util.HashMap;
import java.util.Map;

import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ComparisonOperator;
import com.amazonaws.services.dynamodbv2.model.Condition;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.DescribeTableRequest;
import com.amazonaws.services.dynamodbv2.model.GetItemRequest;
import com.amazonaws.services.dynamodbv2.model.GetItemResult;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.PutItemRequest;
import com.amazonaws.services.dynamodbv2.model.PutItemResult;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.ScanRequest;
import com.amazonaws.services.dynamodbv2.model.ScanResult;
import com.amazonaws.services.dynamodbv2.model.TableDescription;
import com.amazonaws.services.dynamodbv2.util.TableUtils;
import com.amazon.dax.client.dynamodbv2.AmazonDaxClient;
import com.amazon.dax.client.dynamodbv2.ClientConfig;
import com.amazon.dax.client.dynamodbv2.ClusterDaxClient;

import java.io.IOException;

public class Server{
	private ServerSocket serveSock;
	private Vector <DSServerThread> serverThreads;
	private boolean shutdown;
	private int clientCount;
	private boolean debug;

	private static int PORT = 6666;
	static AmazonDynamoDB dynamoDB;

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

	public static void main(String [] args) throws Exception{

		Server server;
		boolean db = false;
		
		if (args.length != 0){
			System.out.println("<Usage> Debug Mode");
			db = true;
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

	private void listen()  throws Exception{
		@SuppressWarnings("resource")
		Socket client = new Socket();
		DSServerThread DSthread;

		// Initialize DynamoDB connection
		init();
				
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
	
	private static void init() throws Exception {
        /*
         * The ProfileCredentialsProvider will return your [default]
         * credential profile by reading from the credentials file located at
         * (C:\\Users\\Alex\\.aws\\credentials).
         */
        ProfileCredentialsProvider credentialsProvider = new ProfileCredentialsProvider();
        try {
            credentialsProvider.getCredentials();
        } catch (Exception e) {
            throw new AmazonClientException(
                    "Cannot load the credentials from the credential profiles file. " +
                    "Please make sure that your credentials file is at the correct " +
                    "location (C:\\Users\\Alex\\.aws\\credentials), and is in valid format.",
                    e);
        }
        dynamoDB = AmazonDynamoDBClientBuilder.standard()
            .withCredentials(credentialsProvider)
            .withRegion("us-west-2")
            .build();
    }
	
	public static void readDoc(String[] args) throws Exception {

        try {
            

          /*  // Create a table with a primary hash key named 'name', which holds a string
            CreateTableRequest createTableRequest = new CreateTableRequest().withTableName(tableName)
                .withKeySchema(new KeySchemaElement().withAttributeName("name").withKeyType(KeyType.HASH))
                .withAttributeDefinitions(new AttributeDefinition().withAttributeName("name").withAttributeType(ScalarAttributeType.S))
                .withProvisionedThroughput(new ProvisionedThroughput().withReadCapacityUnits(1L).withWriteCapacityUnits(1L));

            // Create table if it does not exist yet
            TableUtils.createTableIfNotExists(dynamoDB, createTableRequest);
            // wait for the table to move into ACTIVE state
            TableUtils.waitUntilActive(dynamoDB, tableName);

            // Describe our new table
            DescribeTableRequest describeTableRequest = new DescribeTableRequest().withTableName(tableName);
            TableDescription tableDescription = dynamoDB.describeTable(describeTableRequest).getTable();
            System.out.println("Table Description: " + tableDescription);

            // Add an item
            Map<String, AttributeValue> item = newItem("Bill & Ted's Excellent Adventure", 1989, "****", "James", "Sara");
            PutItemRequest putItemRequest = new PutItemRequest(tableName, item);
            PutItemResult putItemResult = dynamoDB.putItem(putItemRequest);
            System.out.println("Result: " + putItemResult);

            // Add another item
            item = newItem("Airplane", 1980, "*****", "James", "Billy Bob");
            putItemRequest = new PutItemRequest(tableName, item);
            putItemResult = dynamoDB.putItem(putItemRequest);
            System.out.println("Result: " + putItemResult);

            // Scan items for movies with a year attribute greater than 1985
            HashMap<String, Condition> scanFilter = new HashMap<String, Condition>();
            Condition condition = new Condition()
                .withComparisonOperator(ComparisonOperator.GT.toString())
                .withAttributeValueList(new AttributeValue().withN("1985"));
            scanFilter.put("year", condition);
            ScanRequest scanRequest = new ScanRequest(tableName).withScanFilter(scanFilter);
            ScanResult scanResult = dynamoDB.scan(scanRequest);
            System.out.println("Result: " + scanResult); */

        } catch (AmazonServiceException ase) {
            System.out.println("Caught an AmazonServiceException, which means your request made it "
                    + "to AWS, but was rejected with an error response for some reason.");
            System.out.println("Error Message:    " + ase.getMessage());
            System.out.println("HTTP Status Code: " + ase.getStatusCode());
            System.out.println("AWS Error Code:   " + ase.getErrorCode());
            System.out.println("Error Type:       " + ase.getErrorType());
            System.out.println("Request ID:       " + ase.getRequestId());
        } catch (AmazonClientException ace) {
            System.out.println("Caught an AmazonClientException, which means the client encountered "
                    + "a serious internal problem while trying to communicate with AWS, "
                    + "such as not being able to access the network.");
            System.out.println("Error Message: " + ace.getMessage());
        }
    }
	
	 private static Map<String, AttributeValue> newItem(String name, int year, String rating, String... fans) {
	        Map<String, AttributeValue> item = new HashMap<String, AttributeValue>();
	        item.put("name", new AttributeValue(name));
	        item.put("year", new AttributeValue().withN(Integer.toString(year)));
	        item.put("rating", new AttributeValue(rating));
	        item.put("fans", new AttributeValue().withSS(fans));

	        return item;
	    }
}
