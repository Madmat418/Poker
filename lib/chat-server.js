var socketio = require('socket.io');
var _ = require('lodash');
var poker = require('../public/javascripts/poker.js');
var guestnumber = 1;
var nicknames = {};
var namesUsed = [];
var currentRooms = {};
var players = {};
var playerRooms = {};
var playerSockets = {};

var assignGuestName = function(socket, io) {
  var guestName = 'Guest' + guestnumber;
  guestnumber += 1;
  nicknames[socket.id] = guestName;
  players[guestName] = new Poker.Player(guestName);
  playerSockets[guestName] = socket;
}

var joinRoom = function(socket, io, room) {
  console.log('JOINING ROOM ', room);
  socket.join(room);
  currentRooms[socket.id] = room
  var name = nicknames[socket.id];
  io.sockets.in(room).emit('message', {
    text: (name + ' has joined ' + room + '.'),
	room: room
  });
  players[name].room = room;
  if (playerRooms[room]) {
    playerRooms[room].push(players[name]);
  } else {
    playerRooms[room] = [players[name]];
  }
  console.log(playerRooms);
}


var handleMessages = function(socket, io) {
  socket.on('message', function (data) {
    io.sockets.in(data.room).emit('message', {
	  text: (nicknames[socket.id] + ': ' + data.text),
	  room: data.room
	})
  })
}

var currentPlayers = function(room) {
  var current = [];
  for (var name in players) {
    if (players[name].room === room) {
	  current.push(players[name]);
	}
  }
  return current;
}


var playPoker = function(socket, io){
  socket.on('poker', function (data) {
    var tablePlayers = playerRooms[data.room];
    var newHand = new Poker.Game(tablePlayers);
	nextPhase(socket, newHand, data.room, io);
  })
}

var testHand = function(socket, io) {

  socket.on('testPlay', function (data) {
  for (var i = 1; i <= 100; i++) {
    var tablePlayers = playerRooms[data.room];
    var newHand = new Poker.Game(tablePlayers);
    newHand.players.forEach(function(player) {
	  playerSockets[player.name].emit('revealPocket', {
	    cards: player.hand
	  })
	})
	io.sockets.in(data.room).emit('renderFlop', {
	  cards: newHand.flop,
	  room: data.room
	})
	io.sockets.in(data.room).emit('renderTurn', {
	  card: newHand.turn,
	  room: data.room
	})
	io.sockets.in(data.room).emit('renderRiver', {
	  card: newHand.river,
	  room: data.room
	})
	
	
    
	newHand.phase = 4;
	nextPhase(socket, newHand, data.room, io);
	delete newHand;
	}
	
  })
}
var checkPhase = function(socket, io) {
  socket.on('check', function(data) {
    data.game.numCalled += 1;
	data.game.currentPlayer += 1;
	checkCalls(socket, data.game, data.room, io);
  })
}
  
var raisePhase = function(socket, io) {
  socket.on('raise', function(data) {
    var toCall = data.game.currentBet - data.game.players[data.game.currentPlayer].currentBet
    var toBet = toCall + 50;
    data.game.currentBet += 50;
    bet(toCall, data.game, data.game.players[data.game.currentPlayer]);
	data.game.numCalled = 1;
	data.game.currentPlayer += 1;
	checkCalls(socket, data.game, data.room, io);
  })
}
var callPhase = function(socket, io) {
  socket.on('call', function(data) {
    var toCall = data.game.currentBet - data.game.players[data.game.currentPlayer].currentBet
    bet(toCall, data.game, data.game.players[data.game.currentPlayer]);
	data.game.numCalled += 1;
	data.game.currentPlayer += 1;
	checkCalls(socket, data.game, data.room, io);
  })
}
  
var foldPhase = function(socket, io) {
  socket.on('fold', function(data) {
    data.game.players.splice(data.game.currentPlayer, 1);
	data.game.numPlayers -= 1;
	checkCalls(socket, data.game, data.room, io);
  })
}

var bet = function(amt, game, player) {
  player.currentBet += amt;
  player.stack -= amt;
  game.pot += amt;
}

var cyclePlayer = function(game) {
  if (game.currentPlayer === game.numPlayers) {
    game.currentPlayer = 0;
  }
  return game;
}

var nextPhase = function(socket, game, room, io) {
  switch (game.PHASES[game.phase]) {
  case 'Preflop':
    io.sockets.in(room).emit('clearBoard');
	  game.players.forEach(function(player) {
	    playerSockets[player.name].emit('revealPocket', {
	      cards: player.hand
	    })
	  })

      bet(25, game, game.players[game.currentPlayer]);
	  game.currentPlayer += 1;
	  
      bet(50, game, game.players[game.currentPlayer]);
	  game.currentPlayer += 1;
	  game = cyclePlayer(game);
	  game.currentBet += 50;
	  checkBet(game.players[game.currentPlayer], game)
	  break;
	
  case 'Flop':
      io.sockets.in(room).emit('message', {
	    text: 'Flop',
	    room: room
	  })
	  io.sockets.in(room).emit('renderFlop', {
	    cards: game.flop,
	    room: room
	  })
	  checkBet(game.players[game.currentPlayer], game)
	  break;
  case 'Turn':
	  io.sockets.in(room).emit('message', {
	    text: 'Turn',
	    room: room
	  })
	  io.sockets.in(room).emit('renderTurn', {
	    card: game.turn,
	    room: room
	  })
	  checkBet(game.players[game.currentPlayer], game)
	  break;
	
  case 'River':
	  io.sockets.in(room).emit('message', {
	    text: 'River',
	    room: room
	  })
	  io.sockets.in(room).emit('renderRiver', {
	    card: game.river,
	    room: room
	  })
	  checkBet(game.players[game.currentPlayer], game)
	  break;
  case 'Resolve':
    var highHand = {'value': 11};
	game.players.forEach(function(player) {
	  var evaluation = Poker.evaluateHand(player.hand, game.board);
	  evaluation['player'] = [player];
      if (evaluation['value'] < highHand['value']) {
		highHand = evaluation;
      } else if (evaluation['value'] === highHand['value']) {
	    highHand = comparison(highHand, evaluation);
	  }
	  io.sockets.in(room).emit('message', {
	    text: player.name + ': ' + evaluation['string'],
		room: room
	  })
	  console.log(highHand);
	})
	console.log(highHand);
	var winner = new Object();
	if (highHand['player'].length > 1) {
	  var winnerArray = [];
	  winner['winningPlayer'] = [];
	  highHand['player'].forEach(function(player) {
	    winnerArray.push(player.name);
	  })
	  winner['string'] = winnerArray.join(', ') + ' are the winners with ' + highHand['string'];
	  
	} else {
	  winner['string'] = highHand['player'][0].name + ' is the winner with ' + highHand['string'];		  
	}
	  
	io.sockets.in(room).emit('message', {
	  text: winner['string'],
      room: room	  
	})
	var prize = (game.pot / highHand['player'].length)

	highHand['player'].forEach(function(player) {
	  player.stack += prize;
	  io.sockets.in(room).emit('message', {
		text: player.name + ' won ' + prize.toString() + ' chips',
		room: room
	  })
	})
	break;
  }
}

var victorious = function (game, winner, io) {
  var prize = (game.pot / winner.length);
  winner.forEach(function(player) {
    player.stack += prize;
	io.sockets.in(room)
  })
}

var comparison = function (hand1, hand2) {
  for (var i = 0; i <= 4; i++) {
    console.log('888888888888888');
	console.log(hand1);
	console.log(hand2);
    if (hand1['high'][i] > hand2['high'][i]) {
	  return hand1;
	} else if (hand2['high'][i] > hand1['high'][i]) {
	  return hand2;
	}
  }
  hand1['player'].push(hand2['player'][0]);
  return hand1;
}


var checkCalls = function(socket, game, room, io) {
  game = cyclePlayer(game);
  if (game.numCalled === game.numPlayers) {
    game.numCalled = 0;
	game.currentBet = 0;
	game.phase += 1;
	game.currentPlayer = 0;
	game.players.forEach(function(player) {
	  player.currentBet = 0;
	})
    nextPhase(socket, game, room, io);
  } else {
    checkBet(game.players[game.currentPlayer], game);
  }

}

var checkBet = function(player, game) {
  playerSockets[player.name].emit('betPhase', {
	player: player,
	game: game
  })
}

var handleDisconnection = function(socket, io) {
  socket.on('disconnect', function() {
    var nameIndex = namesUsed.indexOf(nicknames[socket.id]);
	delete namesUsed[nameIndex];
	var leavingRoom = currentRooms[socket.id];
	io.sockets.in(leavingRoom).emit('message', {
	  text: (nicknames[socket.id] + ' is leaving' + leavingRoom + '.'),
	  room: leavingRoom
	})
	var seat = playerRooms[leavingRoom].indexOf(players[nicknames[socket.id]])
	playerRooms[leavingRoom].splice(seat, 1);
	delete players[nicknames[socket.id]];
	delete nicknames[socket.id];
	delete currentRooms[socket.id];

  })
}

var handleNameChangeRequests = function(socket, io) {
  socket.on('nicknameChangeRequest', function(name) {
    if (name.indexOf('Guest') === 0 ) {
	  socket.emit('nicknameChangeResult', {
	    success: false,
		message: 'Names cannot begin with "Guest".'
	  });
	} else if (namesUsed.indexOf(name) > -1) {
	  socket.emit('nicknameChangeResult', {
	    success: false,
		message: 'That name is taken.'
      });
    } else {
	  console.log(name);
      var room = currentRooms[socket.id];
      var previousName = nicknames[socket.id];
	  players[previousName].name = name;
      var previousNameIndex = namesUsed.indexOf(previousName);
      namesUsed.push(name);
      nicknames[socket.id] = name;
	  console.log(nicknames);
      delete namesUsed[previousNameIndex];
      io.sockets.in(room).emit('nicknameChangeResult', {
        success: true,
        text: (previousName + ' is now known as ' + name + '.'),
        name: name
      });
      io.sockets.emit('roomList', getRoomData(io));
    }	  
  })
}

var handleRoomChangeRequests = function(socket, io) {
  socket.on('roomChangeRequest', function(room) {
    var oldRoom = currentRooms[socket.id];
	socket.leave(oldRoom);
	joinRoom(socket, io, room);
	io.sockets.emit('roomList', getRoomData(io));
  })
}

var getRoomData = function(io){
  var roomHash = io.sockets.manager.rooms;
  var roomData = {};
  _.each(_.keys(roomHash), function(key){
    var socketIDs = roomHash[key];
	var usernames = _.map(socketIDs, function(id){
	  return nicknames[id];
	});
	roomData[key] = usernames;
  });
  return roomData;
}

var socketIOListen = function(server){
  var io = socketio.listen(server);
  io.configure(function () { 
    io.set("transports", ["xhr-polling"]); 
    io.set("polling duration", 10); 
  });
  io.sockets.on('connection', function(socket){
    console.log('received connection from: ', socket.id);
	assignGuestName(socket, io);
    joinRoom(socket, io, 'lobby');
    handleMessages(socket, io);
	playPoker(socket, io);
	checkPhase(socket, io);
	foldPhase(socket, io);
	raisePhase(socket, io);
	callPhase(socket, io);
	testHand(socket, io);
    handleNameChangeRequests(socket, io);
    handleRoomChangeRequests(socket, io);
    handleDisconnection(socket, io);
    io.sockets.emit('roomList', getRoomData(io));
  })
}

exports.socketIOListen = socketIOListen;