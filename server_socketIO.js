
const TYPE_MESSAGE = 'message';
const TYPE_SERVER = 'server';
const TYPE_ERROR = 'message_error';
const TYPE_COMMAND = 'command';
const COMMAND_UPDATE_USR_LIST = 'update_user_list';
const SERVER_SENDER = 'server';


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


var historique = [];
var channels = [];


/***** MESSAGE AND COMMAND HELPERS **************/
function sendToAllInChannel(channel,data,type,curSender){
    console.log("sendToAllInChannel " + data);
    var sender = curSender?curSender:SERVER_SENDER;
    var message = constructMessage(data,sender);
    console.log("debug");
    console.log(type);
    console.log(JSON.parse(message));
    io.sockets.in(channel).emit(type,message);
}

function sendToSocketChannel(socket,data,type,curSender){
    console.log("sendToSocketChannel " + data + " " + type);
    var sender = curSender?curSender:SERVER_SENDER;
    var message = constructMessage(data,sender);
    socket.broadcast.emit(type,message);
}

function sendToUser(socket,data,type,curSender){
    console.log("sendToUser " + data);
    var sender = curSender?curSender:SERVER_SENDER;
    var message = constructMessage(data,sender);
    socket.emit(type,message);
}




/***** ADD / REMOVE USER *****/

function disconnectUser(socket)
{
    if(socket.userData && socket.userData.channel)
    {
        var userChannel = socket.userData.channel;
        removeUserFromChannel(socket,userChannel);
        sendToAllInChannel(userChannel,"disconnected",TYPE_MESSAGE);
    }
    socket.disconnect() ;
}


function removeUserFromChannel(socket,channel)
{
        socket.leave(channel);
        var message = socket.userData.login + " deconnecté";
        sendToAllInChannel(channel,message,TYPE_MESSAGE,SERVER_SENDER);
        getConnectedUsers(channel)
}

function getConnectedUsers(channel)
{
    var logins = [];
    var clients = null;
     console.log("getConnectedUsers1");

    clients = io.sockets.in(channel).clients(function(error, clients){
      if (error) console.log(error);//throw error;
      //console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]

      for(var i=0; i< clients.length; i++)
      {
        logins.push({login:io.sockets.sockets[clients[i]].login,id:clients[i]});
      
    }
      
       sendToAllInChannel(channel,logins,COMMAND_UPDATE_USR_LIST,SERVER_SENDER);
    });
}


function switchChannel(socket,newChannel)
{
    console.log("switching channel");
    //create channel if not exists
    if(!channels[newChannel] || channels[newChannel] === 'undefined')
        channels[newChannel] = [];


    if(socket.userData && 'channel' in socket.userData && socket.userData.channel != newChannel)
    { 
        removeUserFromChannel(socket,socket.userData.channel);
    }


    socket.join(newChannel);
    socket.userData.channel = newChannel;
    channels.push(newChannel);

    if(!historique[newChannel])
    {console.log("new channel " + newChannel);
        historique[newChannel] = [];
    }
    console.log("after");
    getConnectedUsers(newChannel)
}

function sendHistorique(socket, historique, channel)
{

    console.log("historique " + channel);
    console.log(historique);
    historique[channel].forEach(function(message) {

        console.log(message);
        sendToUser(socket,message,TYPE_MESSAGE);
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


function constructMessage(cdata,sender)
{
    console.log("cdata");
    console.log(cdata);

    return JSON.stringify({login:sender,data:cdata});
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
    console.log("init");

    var jsonData = data;
    console.log("jsonData");
    console.log(jsonData);
    var login = jsonData.text;
    var room = jsonData.channel;
    socket.login = login;
    socket.auth = true;

    console.log(login);
    if(!socket.login.length)
    {
        sendToUser(socket,"Login is mandatory",TYPE_ERROR);
        disconnectUser(socket);
    }

    if(!valueExists(socketsList,login))
    {
        socket.userData = {login:login,channel:room};
        switchChannel(socket,room);
    }
    else{
        sendToUser(socket,"UserExists",TYPE_ERROR);
        disconnectUser(socket);
    }
  });

  socket.on('message', function (message) {
        console.log(socket.login + " " + message);
        if(socket.auth && socket.login.length)
            sendToAllInChannel(socket.userData.channel,message,TYPE_MESSAGE,socket.userData.login);
        else
            sendToUser(socket,"Erreur vous n'êtes pas connecté",TYPE_ERROR);
  });

  socket.on('disconnect', function() {
        console.log(socket.login + " disconnected");
        disconnectUser(socket);
    });

});



server.listen(8100);
