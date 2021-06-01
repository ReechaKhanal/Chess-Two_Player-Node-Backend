const webSocketsServerPort = process.env.PORT || 8000; // defining a port where our server will be listening to
const webSocketServer = require('websocket').server; // use websockets
const http = require('http'); // using http

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
  
const clients = {}; // client maintains all active connections 
const users = {}; // contains all active users in this object

let boardState = null; // store the current state of the board 
let userActivity = []; // User activity history

const rooms = {}; // store all the rooms and room information here [users in the room - username and userID]

// We are sending the current data to all connected clients in a particular room
const sendMessage = (json, roomName) => {

    let list_of_clients = rooms[roomName]; // get all the clients or users under a particular room
    let i = 0; // initialize a variable, this variable will be later used to go through clients in the room

    if(list_of_clients){
        // code will reach this point only if there are clients associated with a room
        for (i=0; i< list_of_clients.length; i++){
            clients[list_of_clients[i][0]].sendUTF(json) // send all connected clients/users the updated date
        }
    }
}

// defining types of message or request that can be received from a client
const typesDef = {
    // userevent is a login request
    // content change is after login and when the game is being played
    USER_EVENT: "userevent",
    CONTENT_CHANGE: "contentchange"
}

wsServer.on('request', function(request) {

    // a connection request came in an we accept the connection request
    const connection = request.accept(null, request.origin);
    console.log((new Date()) + ' A new connection established with a client from origin: ' + request.origin + '.')
    
    // as soon as a connection comes in and gets accepted we generate a uniqueID for that particular user or connection.
    var userID = getUniqueID();

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

                if (rooms[dataFromClient.roomname]){ // This if statement checks if there is a room already existing for a given roomname.
                    if (rooms[dataFromClient.roomname].length == 2){
                        test = false
                        // we allow no additional players
                        console.log("The specified room is Full, please select a new room")
                        json.data = "e";
                        // Not sure if we should do this
                        delete clients[userID]; // the userID and the connection will be removed from our list
                        connection.sendUTF(JSON.stringify(json));
                    }else{
                        // this should mean that the room was waiting for a second player and is now complete, the player coming second to the room should be assigned a "Black" color
                        color = "black"
                    }
                }
                if(test == true){
                    // Somewhere within this if statement
                    users[userID] = dataFromClient;
                    userActivity.push(`${dataFromClient.playername} joined ${dataFromClient.roomname}`);
                
                    // Put all the users in a room together
                    if (rooms[dataFromClient.roomname]){
                        console.log((rooms[dataFromClient.roomname]).type)
                        rooms[dataFromClient.roomname].push([userID, dataFromClient.playername])
                    }else{
                        console.log('Here');
                        rooms[dataFromClient.roomname] = [[userID, dataFromClient.playername]];
                        console.log(rooms)
                    }
                    console.log(rooms[dataFromClient.roomname])
                    
                    json.data = {users, userActivity, color}
                    console.log(json)
                    sendMessage(JSON.stringify(json), dataFromClient.roomname);
                }// end if test == True
            } 
            else if (dataFromClient.type === typesDef.CONTENT_CHANGE) {
                
                boardState = dataFromClient;
                boardState.userActivity = userActivity;
                json.data = {boardState};
                console.log(json)
                console.log(rooms)
                sendMessage(JSON.stringify(json), dataFromClient.roomname);
            }
        }
    });
    // user disconnected
    connection.on('close', function(connection){

        // lets start by checking if the userid is in our records:
        // if not no need to worry about it coz it was prolly a false alarm
        const json = { type: typesDef.USER_EVENT };

        if(users[userID]){ // only if the userID id in our records      
            console.log((new Date()) + " Peer " + userID + " disconnected.");
            console.log(`${users[userID].playername} left ${users[userID].roomname}`)
            userActivity.push(`${users[userID].playername} left ${users[userID].roomname}`);
            
            // We will delete the user from our room information now
            let room_name = users[userID].roomname; // the room name the user belongs to
            let room_info = rooms[room_name]; // the room information of the user's room
            
            console.log(rooms);

            // userID and username of the person
            let user_who_just_left = [userID, users[userID].playername];
            //var index = room_info.indexOf(user_who_just_left)
            
            var i; 
            new_room_info = [];
            for (i=0; i<room_info.length; i++){
                console.log(room_info[i]);
                if((room_info[i][0] == user_who_just_left[0]) && (room_info[i][1] == user_who_just_left[1])){
                    // do nothing
                }else{
                    new_room_info.push(room_info[i]);
                }
            }
            
            room_info = new_room_info;

            // delete and update the rooms folder to contain only the users that are in that particular room
            //room_info = room_info.splice(index, 1);
            rooms[room_name] = new_room_info;

            // delete a room from our records complety when no users are left in the room
            console.log(rooms)
            console.log(rooms[room_name].length)
            if(rooms[room_name].length == 0){
                console.log("Deleting this Room, no user left here !!");
                delete rooms[room_name];
                userActivity = [];
            }
            
            json.data = { users, userActivity };
            delete clients[userID];
            delete users[userID];
            sendMessage(JSON.stringify.json);
        }
    });
});