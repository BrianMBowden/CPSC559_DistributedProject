package makingJSON;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;


public class JSONobjects {

	
	@SuppressWarnings("unchecked")
	public static JSONObject encodeIN_DEL(String ClientID, String DocumentID, int offset, int length, String Message, String Action){
		JSONObject payload = new JSONObject();
		JSONObject obj = new JSONObject();
		payload.put("data_type", "text");
		payload.put("offset", offset);
		payload.put("length", length);
		payload.put("data", Message);
		obj.put("payload", payload);
		obj.put("action", Action);
		obj.put("client_id", ClientID);
		obj.put("document_id", DocumentID);

		return obj;
	}
	
	@SuppressWarnings("unchecked")
	public static JSONObject encodeCaret(String ClientID, String DocumentID, int row, int col){
		JSONObject payload = new JSONObject();
		JSONObject obj = new JSONObject();
		payload.put("data_type", "caret");
		payload.put("row", row);
		payload.put("column", col);
		obj.put("payload", payload);
		obj.put("action", "insert");
		obj.put("client_id", ClientID);
		obj.put("document_id", DocumentID);
		return obj;
	}
	
	@SuppressWarnings("unchecked")
	public static JSONObject encodeJoin(String ClientID, String DocumentID){
		JSONObject obj = new JSONObject();
		obj.put("action", "join");
		obj.put("client_id", ClientID);
		obj.put("document_id", DocumentID);
		return obj;
	}
	
	@SuppressWarnings("unchecked")
	public static JSONObject encodeRename(String ClientID, String DocumentID, String newName){
		JSONObject obj = new JSONObject();
		obj.put("action", "rename");
		obj.put("client_id", ClientID);
		obj.put("document_id", DocumentID);
		obj.put("new_doc_name", newName);
		return obj;
	}
	
	@SuppressWarnings("unchecked")
	public static JSONObject encodeShowAll(String ClientID){
		JSONObject obj = new JSONObject();
		obj.put("action", "showall");
		obj.put("client_id", ClientID);
		return obj;
	}
}
