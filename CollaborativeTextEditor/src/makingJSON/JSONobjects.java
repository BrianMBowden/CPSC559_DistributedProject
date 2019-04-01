package makingJSON;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;


public class JSONobjects {

	
	@SuppressWarnings("unchecked")
	public static JSONObject encodeInsert(String ClientID, String DocumentID, int offset, int length, String Message){
		JSONObject payload = new JSONObject();
		JSONObject obj = new JSONObject();
		payload.put("data_type", "text");
		payload.put("offset", offset);
		payload.put("length", length);
		payload.put("data", Message);
		obj.put("payload", payload);
		obj.put("action", "insert");
		obj.put("client_id", ClientID);
		obj.put("document_id", DocumentID);

		return obj;
	}
}
