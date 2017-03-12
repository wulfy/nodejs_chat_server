
const TYPE_MESSAGE = 'message';
const TYPE_SERVER = 'server';
const TYPE_ERROR = 'error';
const TYPE_COMMAND = 'command';
const COMMAND_UPDATE_USR_LIST = 'update_user_list';
const COMMAND_LISTUSER = 'list_users';
const COMMAND_DISPLAY_MSG = 'display';
const SERVER_SENDER = -1;


var http = require('http');
var fs = require('fs');




function valueExists(arrayOfData,check){
    console.log("check");
    var exists = false;
    for(var i=0; i<arrayOfData.length; i++)
    {
        var element = arrayOfData[i].login;
        console.log(element + " " + check);
        if(element.localeCompare(check) === 0)
        {console.log("true");
            exists = true;
            break;
        }
    };

    return exists;
}


var connections = [];
var canvasCommands = [];
var clientData = [];
var historique = [];
var channels = [];
var currentUser = null;

function setCurrentUser(connection)
{
    console.log("setCurrentUser");
    var currentUserId = connections.indexOf(connection);
    var currentUserData = (currentUserId>=0 && (currentUserId< clientData.length)) ?clientData[currentUserId]:null;

    currentUser = currentUserId>=0?{id:currentUserId,data:currentUserData}:null;
}




function sendMessageInChannel(connections,targetChannel,message,sender,type,cmd)
{
    console.log("message " + message + " Channel " + targetChannel +" type "+type + " cmd " + cmd + " sender " + sender);
console.log(channels);
    channels[targetChannel].forEach(function(connectionId) {
        
            sendMessage(connections[connectionId.id],message,sender,type,cmd);

        if(!cmd)
            putMessageInHistory(historique,targetChannel,constructMessage(message,sender,type,cmd));

    });

    

}


/***** MESSAGE AND COMMAND HELPERS **************/
function userSendMessageToUser(targetUserId,message)
{
    var targetConnection = connections[targetUserId];

    if(targetConnection)
        sendMessage(targetConnection,message,currentUser.id);
}

function userSendMessageInChannel(connection,targetChannel,message)
{
    console.log("userSendMessageInChannel");
    var connectionId = connections.indexOf(connection);
    sendMessageInChannel(connections,targetChannel,message,connectionId);
}

function serverSendMessageInChannel(targetChannel,message,type)
{
    sendMessageInChannel(connections,targetChannel,message,SERVER_SENDER,type);
}

function serverSendMessageToUser(connection,message,type)
{
    sendMessage(connection,message,SERVER_SENDER,type);
}

function serverSendCommandToUser(connection,message,cmd)
{
    sendMessage(connection,message,SERVER_SENDER,TYPE_COMMAND,cmd);
}

function sendCommandInChannel(targetChannel,data,cmd)
{
    sendMessageInChannel(connections,targetChannel,data,SERVER_SENDER,TYPE_COMMAND,cmd);
}


/***** ADD / REMOVE USER *****/

function removeUser()
{

    if (currentUser.id !== -1) {
        // remove the connection from the pool
        if(currentUser.data)
        {
            removeUserFromChannel(currentUser.data.channel,currentUser.id);
            clientData.splice(currentUser.id, 1);
        }
        connections.splice(currentUser.id, 1);
    }
}

function setCurrentUserData(login,channel){
    console.log("add user");
    if(!currentUser)
        throw "add user called without user created. Check createuser";

    clientData[currentUser.id] = {login:login,channel:channel};
    console.log(currentUser);
    if(currentUser.data === null)
        currentUser.data = clientData[currentUser.id];
    /*connection["login"] = login;
    connection["channel"] = channel;*/
}

function removeUserFromChannel(clientChannel,clientId)
{
        var login = currentUser.data?currentUser.data.login :"unknown user";
        var message = login + " deconnecté";
        console.log("remove user " + clientId + " chan " + clientChannel);
        console.log(channels[clientChannel]);
        if(clientId >= 0)
            channels[clientChannel].splice(clientId,1);

        serverSendMessageInChannel(clientChannel,message,TYPE_MESSAGE);
        sendCommandInChannel(clientChannel,getConnectedUsers(clientChannel),COMMAND_UPDATE_USR_LIST);
}


function getConnectedUsers(channel)
{
    console.log("get connected " + channel);
    console.log(channels[channel]);
    var userList = [];

    if(channel)
        channels[channel].forEach(function(connectionId) {
            userList.push(clientData[connectionId.id]);
        });
    else
        userList = channels.reduceRight((currentUserList,currentChannel) => { 
            channels[currentChannel].reduceRight((currentUserList,currentUserId)=>{
                currentUserList.push(clientData[connectionId.id]);
            },[])  
        },[]);

    return userList;
}


function switchChannel(connections, connection, newChannel)
{
    var currentChannel = currentUser.data.channel;
    console.log("switching channel");
    //create channel if not exists
    if(!channels[newChannel] || channels[newChannel] === 'undefined')
        channels[newChannel] = [];


    if(currentUser.data && 'channel' in currentUser.data && currentUser.data.channel != newChannel)
    {
        removeUserFromChannel(currentUser.data.channel,currentUser.id);
    }


    currentUser.data.channel = newChannel;
    console.log("push");
    channels[newChannel].push({id:currentUser.id});
console.log("push done");
    if(!historique[newChannel])
    {console.log("new channel " + newChannel);
        historique[newChannel] = [];
    }

    sendCommandInChannel(currentChannel,getConnectedUsers(newChannel),COMMAND_UPDATE_USR_LIST);
}

function sendHistorique(connection, historique, channel)
{

    console.log("historique " + channel);
    console.log(historique);
    historique[channel].forEach(function(message) {

        console.log(message);
        sendDirectMessage(connection,message);
    });
}

function putMessageInHistory(historyDB,channel,message)
{
    console.log("push message in history " + channel + message);

    if(Array.isArray(historyDB) &&
       channel && channel.length > 1 &&
        message && message.length > 1)
    historique[channel].push(message);
}


function constructMessage(data,sender,type,command)
{
    var messageType = TYPE_MESSAGE;
    var commandMsg = false;
    var loginSender = 'unknown';

    if(type && type != 'undefined')
        messageType = type;

    if(command && command != 'undefined')
        commandMsg = command;

    if(clientData[sender])
        loginSender = clientData[sender].login;
    else if(sender === SERVER_SENDER)
        loginSender = 'server';

    console.log("sender " + sender);
    return JSON.stringify({type:messageType,command:commandMsg,login:loginSender,data:data});
}

function sendMessage(connection,data,sender,type,command)
{
    console.log("send message1 ");
    sendDirectMessage(connection,constructMessage(data,sender,type,command));
}

function sendDirectMessage(connection,message)
{
    console.log("send message ");
    console.log(message);
    connection.sendUTF(message);
}

// Chargement du fichier index.html affiché au client
var server = http.createServer(function(req, res) {
    fs.readFile('./index.html', 'utf-8', function(error, content) {
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(content);
    });
});




var socketsList = [];
// Chargement de socket.io
var io = require('socket.io')(server);
io.sockets.on('connection', function(socket){
    console.log("connected");
  socket.auth = false;
  socket.emit('requestInit');
  console.log("requestInit");
  socket.on('init', function(data){
    //check the auth data sent by the client
    var jsonData = JSON.parse(data);
    var login = jsonData.text;
    var room = jsonData.channel;
    socket.login = login;

    console.log(login);
    if(!valueExists(socketsList,login))
    {
        socket.login = login;
        socket.join(room);
    }
    else
        throw "User exists";
  });

  socket.on('message', function (message) {
        console.log(socket.login + " " + message);
        io.sockets.in('c1').emit('message', JSON.stringify({data:'what is going on, party people?'}));
  });
});



/*io.sockets.on('connection', function (socket) {
   socket.emit('message', 'Vous êtes bien connecté !');

    connections.push(connection);
    console.log(connection.remoteAddress + " connected - Protocol Version " + connection.webSocketVersion);
    //console.log(connections);
    setCurrentUser(socket.);

    console.log('Un client est connecté !');
    socket.broadcast.emit('message', 'Un autre client vient de se connecter !');

    // Quand le serveur reçoit un signal de type "message" du client    
    socket.on('message', function (message) {
        var messageData = message.utf8Data;
        var clientId = connections.indexOf(connection);
        var init = false;
        try{
            var messageObject = JSON.parse(messageData);

            if(messageObject.type === "init")
            {
                init = true;
                    if(valueExists(clientData,messageObject.text))
                    {
                        serverSendMessageToUser(connection,"ERROR LE NOM EXISTE",TYPE_ERROR);
                        this.close();
                        return;
                    }else if (messageObject.text == 'server') 
                    {
                        serverSendMessageToUser(connection,"ERROR server est réservé",TYPE_ERROR);
                        this.close();
                        return;
                    }else
                {
                    setCurrentUserData(messageObject.text,messageObject.channel);
                }
            }

            if(messageObject.type === "init" || messageObject.type === "switchchannel")
            {
                switchChannel(connections,connection,messageObject.channel);     
                console.log("ok");
                serverSendMessageToUser(connection,"bonjour " + messageObject.text + " " + connection.remoteAddress,TYPE_MESSAGE);
                sendHistorique(connection,historique,messageObject.channel);
                console.log("ok");
            }


            if(!init)
                userSendMessageInChannel(connection,currentUser.data.channel,messageObject.text);


            console.log(connection.remoteAddress);
        }
        catch (e) {
            console.log("erreur : " + e );
        }
    }); 

    socket.on('close', function() {
        console.log(connection.remoteAddress + " disconnected");
        removeUser();
    });
});*/

server.listen(8100);
