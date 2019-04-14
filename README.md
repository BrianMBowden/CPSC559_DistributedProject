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

### Change number of required master servers at startup
* Open conf.json in some text editor
* Change "minMasters": to desired value


### To launch a non-primary master server
* cd into CPSC559_DistributedProject/CollaborativeTextEditor/server
* $node server.js --action join --peers masterPort,masterPort


### Site URL
* http://35.175.192.161:8888/


### Login credentials
* We have three users:
* Username: user1 Password: user1
* Username: user2 Password: user2
* Username: user3 Password: user3
