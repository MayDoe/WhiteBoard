//include modules we're using in our app
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/Db';
var coll = 'paths';
var coll2='chats';
var paths = [];
var chats = [];
var rooms =[];
var req_id="newroom";

var express=require('express');

app.get('/', function(req, res){
    app.use(express.static(path.join(__dirname),'/assets'));
  // if user requests new room 
   req_id="newroom";
    res.sendFile(path.join(__dirname, '/index.html'));

});

app.get('/room/:roomid', function(req, res){
    app.use(express.static(path.join(__dirname),'/assets'));
//if user request eqxisting room , get its id from the url
    req_id=req.params.roomid;
    var x= false;
    for(i=0; i<rooms.length; i++){
        if(rooms[i]===req_id){
            x=true;
            break;
        }
    }
    if(x){
        res.sendFile(path.join(__dirname, '/index.html'));
    }else{
        res.send("the requested room doesn't exist");
    }


});


// Register events on socket connection
io.on('connection', function(socket){
    var room_id

    if(req_id !== "newroom"){
        room_id=req_id //existing room
  	//Getting the room data for the new connecting client from the database
        MongoClient.connect(url, function(err, db) {
	//Getting the drawing data
            console.log("getting data of room " +room_id);
            var cursorDraw = db.collection(coll).find({room:room_id});
            cursorDraw.forEach(function(path,err){
                paths.push(path.path);
            }, function(){
                for (var i in paths) {
                    socket.emit('savedPaths',paths[i]);
                }
                paths=[];
            });
	//Getting the chat data
            var cursorChat = db.collection(coll2).find({room:room_id});
            cursorChat.forEach(function(myDoc,err){
                chats.push(myDoc);

            }, function(){
                db.close();
	//Sending the chat data
                for (var i in chats) {
                    socket.emit('chatMessage',chats[i].from, chats[i].msg);
                }
                chats=[];
            });

        });
    }else{
        room_id=generateId() //new room
        console.log('generated id for new room is ' + room_id)
        rooms.push(room_id)
    }
	//sen room id to client and join room
    socket.emit('room',room_id)
    socket.join(room_id)
    socket.room=room_id;


//client sent a Chat message
    socket.on('chatMessage', function(from, msg,room){
        io.sockets.in(socket.room).emit('chatMessage', from, msg); //send message to other clients in the same room
        MongoClient.connect(url, function(err, db) { //Insert Chat message into the database
            if(err) { return console.dir(err); }

            var collection = db.collection(coll2);

            collection.insert({'from':from, 'msg':msg, 'room':socket.room});

        });

    });
  
//client sent a Drawing message

    socket.on('StartingPoint',function(data){                                             // First point in a path
        socket.in(socket.room).broadcast.emit('newDrawing', data);                        // broadcast the message to other clients in the same room
    });
	
    socket.on('Continue',function(data){                                                  // Other points in a path
        socket.in(socket.room).broadcast.emit('ContinueDrawing', data);                   // broadcast the message to other clients in the same room
    });
    socket.on('EndPoint',function(data){                                                  // Last point in a path
        socket.in(socket.room).broadcast.emit('StopDrawing', data);                       // broadcast the message to other clients in the same room

        console.log('received end point');
		
		//Insert drawn path into the database
        MongoClient.connect(url, function(err, db) {
            if(err) { return console.dir(err); }
            var collection = db.collection(coll);
            collection.insert({'path':data.path,'room':socket.room});
        });
    });
});

// Listen to application request on port 3000
http.listen(3000, function(){
    console.log('listening on *:3000');
});

//generate id for the room
function generateId(){
    var id = "id" + Math.random().toString(16).slice(2);
    return id;

}
