var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var fs= require('fs');

//Authors Felix (741591), Anna Rosa(742506)
//Node.js-Server working with Socket.io to create a real-time-communication-chat

/*content of the index.html loaded on start of the server so that asynchronous
  can use it in registration*/
var index = (fs.readFileSync(__dirname+ '/index.html')).toString();

//Send login-HTML
app.get('/', function(req, res){
  res.sendFile(__dirname + '/login.html');
});

//Array of all online users, they are saved as objects with the chosen name and their socketID.
var users = [];

//When Client connects to server
io.on('connection', function(socket){
	console.log('new User came online');

  //When client starts registration, it calles the function with the chosen username. If the users array contains the name
  // already, it is not accepted (-> registration fail), if not, registraton succeeds and user name and socketID are saved in users-array
	socket.on('registration', function(chosenname){
        var accepted=true;
        for(var i= 0; i<users.length; i++){
          if(users[i].name===chosenname){
            accepted=false;
          }
        }

			if(accepted==true ){
				users.push({'id': socket.id, 'name': chosenname});
        socket.emit('registration success',index);
        io.emit('user update', chosenname + ' entered the chat');
			}
      else{
        socket.emit('registration fail', 'Registration failed: Name already in use! Please try again using another name!');
      }
	});

  // When Socket sends new Chat-Message
  socket.on('chat message', function(msg){
    var messageObject= JSON.parse(msg);

	//Create Timestamp
    var date=  new Date();
    var hours= date.getHours();
    if(hours <10){
      hours  = '0'+ hours;
    }
    var minutes = date.getMinutes();
    if(minutes <10){
      minutes= '0' + minutes;
    }
    var day= date.getDate();
    if(day <10){
      day= '0'+day;
    }
    var month= date.getMonth()+1;
    if(month <10){
      month= '0'+month;
    }
    var year= date.getFullYear();
    messageObject['date']= '[' + hours + ':'+ minutes + '  ' + day + '.'+ month + '.'+ year+ ']';

    //If message is private
    if(messageObject.mode.m==='private'){
      //Check if the user is online, if so sends private message to user and sender, otherwise sends  failure-message to sender
      var found = false;
      for(var i = 0; i < users.length;i++){
        if(users[i].name===messageObject.mode.name){
          found=true;
          //sends message only to socket with users[i].id
          socket.broadcast.to(users[i].id).emit('chat message', JSON.stringify(messageObject));
          //sends message to sender
          socket.emit('chat message', JSON.stringify(messageObject));
        }
        else{
          if(i==(users.length-1) && found==false){
            socket.emit('chat message failure', ('Chosen user '+messageObject.mode.name+' is not online or name is spelled wrong. Please try again.'));
}
        }
      }
    }else{
      //Sends message to all sockets
      io.emit('chat message',JSON.stringify(messageObject));
    }
  });

  //If user-list is requested, sends the list of all online users to sender of the request
  socket.on('user list', function(msg){
    var userlist = "Users online:   " + "<br>";
    for(var i=0; i<users.length; i++){
      userlist = userlist + "<a id=listlink  onclick=typehelper('"+users[i].name+"') href='#'>" +users[i].name + "</a>" + "<br>";
    }
    //sends response only to requesting sender
    socket.emit('user list', userlist);
  });

  //Once a Socket disconnects, its data is deleted from the server (User-Name and -ID deleted from users-array) and all other sockets
  // are informed that the user left.
  socket.on('disconnect', function(){
    for(var i=0; i<users.length; i++){
      if(users[i].id===socket.id){
        var name = users[i].name;
        users.splice(i,1);
        io.emit('user update', 'User '+ name + ' left the chat.');
      }
    }
  });

});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
