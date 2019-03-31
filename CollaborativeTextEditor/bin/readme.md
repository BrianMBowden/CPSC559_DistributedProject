### Server-Client Protocol 
#### Insert text 

```json
{
	"action": "insert",
	"client_id": "321F4",
	"document_id": "A1C4G4"
	"payload": 
	{
	    "data_type": "text",
	    "offset": 0,
	    "length": 4,
	    "data": "hello"
	}
}
```
#### Show all documents of the client 
* Client -> Server 

```json
{
	"action": "showall",
	"client_id": "321F4"
}

* Then Server -> Client 

{
	"action": "insert",
	"client_id": "321F4",
	"payload": 
	{
	    "data_type": "text",
	    "offset": 0,
	    "length": 4,
	    "data": "hello"
	}
}
```

#### Delete text
* i.e: delete 10 characters; start position = 0 and end position = length

```json
{
	"action": "delete",
	"client_id": "321F4",
	"document_id": "A1C4G4"
	"payload": 
	{
	    "type": "text",
	    "offset": 0,
	    "length": 10
	}
}
```

#### Update caret's position 
```json
{
	"action": "insert",
	"client_id": "321F4",
	"document_id": "A1C4G4"
	"payload": 
	{
	    "data_type": "caret",
	    "row": 0,
	    "column": 4
	}
}

```
