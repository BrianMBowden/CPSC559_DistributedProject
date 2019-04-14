# CPSC559_DistributedProject

### Applications Needed
* Node.js


### Node Setup  
* [Install Node](https://nodejs.org/en/download/)
* Open command prompt in directory of project
* cd into CPSC559_DistributedProject/CollaborativeTextEditor
* $npm i


### To launch the primary server
* cd into CPSC559_DistributedProject/CollaborativeTextEditor/server
* $node server.js --action startup

### To launch a non-primary master server
* $node server.js --action join --peers masterPort

### Login credentials
* We have three users:
* Username: user1 Password: user1
* Username: user2 Password: user2
* Username: user3 Password: user3
