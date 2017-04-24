var app = require('express')();
var http = require('http').Server(app);
var port = (process.env.PORT || process.env.VCAP_APP_PORT || 3000);
var fs= require('fs');
var sha512= require('sha512');

var server = app.listen(port, function() {
        console.log('Listening on port %d', server.address().port);
});                        

var io = require('socket.io')(http).listen(server);

app.enable('trust proxy');

app.use (function (req, res, next) {
        if (req.secure) {
                // request was via https, so do no special handling
                next();
        } else {
			
                // request was via http, so redirect to https
                res.redirect('https://' + req.headers.host + req.url);
        }
});



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
var salt1="k3?"
var salt2="_341as3!Xx";
var regexp=/[()<>{}:;*%//\\'",$\s]/g;

//ab hier

var cloudant = {
                 url : "https://bfce9a9d-6565-4e6b-a730-f2be0c2aaac4-bluemix:34768a45ca1a845b537fbdd7b611cf51fcbf94998ee3e72c0ab02be2add93957@bfce9a9d-6565-4e6b-a730-f2be0c2aaac4-bluemix.cloudant.com" // TODO: Update
};
if (process.env.hasOwnProperty("VCAP_SERVICES")) {
  // Running on Bluemix. Parse out the port and host that we've been assigned.
  var env = JSON.parse(process.env.VCAP_SERVICES);
  var host = process.env.VCAP_APP_HOST;
  var port = process.env.VCAP_APP_PORT;

  // Also parse out Cloudant settings.
  cloudant = env['cloudantNoSQLDB'][0].credentials;
}
var nano = require('nano')(cloudant.url);
var db = nano.db.use('login_data');
console.log('db success');
// bis hier

function userisonline(username){
	for(var i=0; i<users.length; i++){
		if(users[i].name===username){
			return true;
		}
	}

	return false;

}

//When Client connects to server
io.on('connection', function(socket){
	console.log('new User came online');

  //When client starts registration, it calles the function with the chosen username. If the users array contains the name
  // already, it is not accepted (-> registration fail), if not, registraton succeeds and user name and socketID are saved in users-array
	socket.on('registration', function(logindata){
		var loginobj= JSON.parse(logindata);

  	if(loginobj.name.includes(' ')){
  		  socket.emit('registration fail','Registration failed: Name must not contain blank spaces!');
  	}else if(regexp.test(loginobj.name)){
  		socket.emit('registration fail', 'Entered name contains invalid character');
  	}
  	else if(loginobj.name.length==0){
  	  socket.emit('registration fail', 'Registration failed: Name must not be empty!');
  	}else if(loginobj.password<8){
  		  socket.emit('registration fail', 'Registration failed: Password too short');
  	}else{
          var hashedpw= sha512(loginobj.name+salt1+loginobj.pw+salt2);
      		logindata= {'_id':loginobj.name, 'password': hashedpw.toString('hex')};
      		db.get(loginobj.name, function(err, body){
      			if(err){
      				db.insert(logindata, function(err, body, header) {
      					if (!err) {
      						if(!userisonline(loginobj.name)){
      								users.push({'id': socket.id, 'name': loginobj.name});
                      socket.emit('registration success', index);
      								io.emit('user update', loginobj.name + ' entered the chat');
      							}

      					}else{
      						socket.emit('registration fail', 'Registration failed');
      					}
      				});
      			}else{
      				socket.emit('registration fail', 'Registration failed');
      			}
      		});
        }
	});

	socket.on('login', function(logindata){
		
        var loginobj= JSON.parse(logindata);
		logindata= {'_id':loginobj.name, 'password': loginobj.pw};
    if(loginobj.name.includes(' ')){
  		  socket.emit('login fail','Login failed');
  	}else if(regexp.test(loginobj.name)){
  		socket.emit('login fail', 'Entered name contains invalid character');
  	}
  	else if(loginobj.name.length==0){
  	  socket.emit('login fail', 'Login failed: Name must not be empty!');
  	}else if(loginobj.password<8){
  		  socket.emit('login fail', 'Login failed: Wrong password');
  	}	else{
			
    		db.get(loginobj.name, function(err, body){
				
    			if(!err){
              var hashedpw=sha512(loginobj.name+salt1+loginobj.pw+salt2);
    					if(loginobj.name==body._id&&hashedpw.toString('hex')==body.password){
    						if(!userisonline(loginobj.name)){
                  users.push({'id': socket.id, 'name': loginobj.name});
                  socket.emit('login success', index);
    							io.emit('user update', loginobj.name + ' entered the chat');
    						}
                else{
                  socket.emit('login fail','User is already online!');
                }


    					}
    					else{
    						socket.emit('login fail', 'Login did not succeed: Wrong password!');
    					}
    			}else{
    				socket.emit('login fail', 'Login did not succeed: User does not exist');
    			}
    		});
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

