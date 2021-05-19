const webSocketsServerPort = process.env.PORT || 8000;
const webSocketServer = require('websocket').server;
const http = require('http');

// Spinning the http server and the websocket server
const server = http.createServer();
server.listen(webSocketsServerPort);
const wsServer = new webSocketServer({
    httpServer: server
});

// Generates uniqueID for every new connection
const getUniqueID = () => {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return s4() + s4() + '-' + s4()
};

// I am maintaining all active connections in this object.
const clients = {};
// I am maintaining all active users in this object
const users = {};
// The current State of the board is maininted here
let boardState = null;
// User activity history
let userActivity = [];

// Hold rooms below
const rooms = {}

//let currentUsers = null, userActivity = null , username = null, stateBoard = null, selectedPiece = null, turn = null, 
//    takenWhitePieces = null, takenBlackPieces = null, win = null, check = null, whiteHasMoved = null, blackHasMoved = null;

const sendMessage = (json, roomName) => {
    // We are sending the current data to all connected clients in a particular room
    if (json === '{"type":"userevent","data":{"error":"e"}}'){
        console.log('This ??') //This is where we take care of the problem when a third person tries to enter a fully occupied room
    }

    let list_of_clients = rooms[roomName];
    let i = 0;
    if(list_of_clients){
        for (i=0; i< list_of_clients.length; i++){
            clients[list_of_clients[i]].sendUTF(json)
        }
    }
}

const typesDef = {
    USER_EVENT: "userevent",
    CONTENT_CHANGE: "contentchange"
}

wsServer.on('request', function(request) {
    var userID = getUniqueID();
    console.log((new Date()) + ' Received a new connection from origin ' + request.origin + '.')

    /* This part of code can also be re-written to accept only the requests from allowed origins */
    // we accept a connection request
    const connection = request.accept(null, request.origin);
    clients[userID] = connection; // Assigning a userid to a connection

    console.log('connected: ' + userID + ' in ' + Object.getOwnPropertyNames(clients));

    connection.on('message', function(message){
        
        if (message.type === 'utf8'){
            const dataFromClient = JSON.parse(message.utf8Data);
            const json = { type: dataFromClient.type }
            
            // if the request from the client is a user event - received from the login information
            if (dataFromClient.type === typesDef.USER_EVENT){
                
                var test = true
                var color = "white" // a player will be initially assigned a color 'White'

                if (rooms[dataFromClient.username]){ // This if statement checks if there is a room already existing for a given username.
                    if (rooms[dataFromClient.username].length == 2){
                        test = false
                        // we allow no additional players
                        json.data = "e";
                        delete clients[userID];
                        connection.sendUTF(JSON.stringify(json));
                    }else{
                        // this should mean that the room was waiting for a second player and is now complete, the player coming second to the room should be assigned a "Black" color
                        color = "black"
                    }
                }
                if(test == true){

                    // Somewhere within this if statement
                    users[userID] = dataFromClient;
                    userActivity.push(`${dataFromClient.playername} joined ${dataFromClient.username}`);
                
                    // Put all the users in a room together
                    if (rooms[dataFromClient.username]){
                        console.log((rooms[dataFromClient.username]).type)
                        rooms[dataFromClient.username].push(userID)
                    
                    }else{
                        rooms[dataFromClient.username] = [userID];
                    }
                    console.log(rooms[dataFromClient.username])
                    
                    json.data = {users, userActivity, color}
                    console.log(json)
                    sendMessage(JSON.stringify(json), dataFromClient.username);
                }// end if test == True
            } 
            else if (dataFromClient.type === typesDef.CONTENT_CHANGE) {
                
                boardState = dataFromClient;
                boardState.userActivity = userActivity;
                json.data = {boardState};
                console.log(json)
                sendMessage(JSON.stringify(json), dataFromClient.username);
            }
        }
    });
    // user disconnected
    connection.on('close', function(connection){

        // lets start by checking if the userid is in our records:
        // if not no need to worry about it coz it was prolly a false alarm
        const json = { type: typesDef.USER_EVENT };

        if(users[userID]){
            
            console.log('I will be called only some times')       
            console.log((new Date()) + " Peer " + userID + " disconnected.");
            console.log(`${users[userID].username} left`)
            userActivity.push(`a player left ${users[userID].username}`);
            // userActivity.push(`${dataFromClient.playername} left ${dataFromClient.username}`);

            // Somewhere here - when both players leave a room - we can delete the room as a whole
            // This will help us reuse the rooms for other playes

            json.data = { users, userActivity };
            delete clients[userID];
            delete users[userID];

            sendMessage(JSON.stringify.json);
        }
    });
});