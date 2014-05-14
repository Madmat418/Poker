var socketio = require('socket.io');
var _ = require('lodash');
var poker = require('../public/javascripts/poker.js');
var guestnumber = 1;
var nicknames = {};
var namesUsed = [];
var currentRooms = {};
var tables = {};
var players = {};
var playerRooms = {};
var playerSockets = {};
var pokerTables = {};

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
  tableSpot(room, players[name]);
  socket.emit('playersInfo', {
    players: playerRooms[room]
  })
  io.sockets.in(room).emit('playerInfo', {
    player: players[name]
  })
}

var tableSpot = function(room, player) {
  if (tables[room]) {
    var ind = 0;
    for (var i = 1; !!tables[room][i]; i++) {
      ind = i;
    }
    tables[room][ind + 1] = player;
    player.location = ind + 1;
  } else {
    tables[room] = {1: player};
    player.location = 1;
  }
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
    if (playerRooms[data.room].length < 2) {
      io.sockets.in(data.room).emit('message', {
        text: "Please wait until at least two players are seated at this table",
        room: data.room
      })
    } else {
      io.sockets.in(data.room).emit('hidePoker');
      var tablePlayers = playerRooms[data.room];
      var newHand = new Poker.Game(tablePlayers);
      pokerTables[data.room] = newHand;
      nextPhase(socket, newHand, data.room, io);
    }
  })
}

var newHand = function(socket, io, room) {
  var tablePlayers = playerRooms[room];
  var newHand = new Poker.Game(tablePlayers);
  newHand.players.forEach(function(player) {
    player.currentBet = 0
  })
  pokerTables[room] = newHand;
  nextPhase(socket, newHand, room, io);
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
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' checks'),
      room: data.room
    })
    data.game.numCalled += 1;
    data.game.currentPlayer += 1;
    checkCalls(socket, data.game, data.room, io);
  })
}
  
var raisePhase = function(socket, io) {
  socket.on('raise', function(data) {
    var toCall = data.game.currentBet - currentPlay(data.game).currentBet
    var toBet = toCall + 50;
    data.game.currentBet += 50;
    bet(toBet, data.game, currentPlay(data.game));
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' raises to' + data.game.currentBet),
      room: data.room
    })
    updateInfo(data.room, currentPlay(data.game), socket, io);
    data.game.numCalled = 1;
    data.game.currentPlayer += 1;
    checkCalls(socket, data.game, data.room, io);
  })
}
var callPhase = function(socket, io) {
  socket.on('call', function(data) {
    console.log('!!!!!!!!!!!!!!!!!!!!!');
    console.log(currentPlay(data.game).stack)
    var toCall = data.game.currentBet - currentPlay(data.game).currentBet
    bet(toCall, data.game, currentPlay(data.game));
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' calls ' + toCall),
      room: data.room
    })
    updateInfo(data.room, currentPlay(data.game), socket, io);
    console.log(currentPlay(data.game).stack);
    data.game.numCalled += 1;
    data.game.currentPlayer += 1;
    checkCalls(socket, data.game, data.room, io);
  })
}

var updateInfo = function(room, player, socket, io) {
  io.sockets.in(room).emit('playerInfo', {
    player: player
  })
}

var currentPlay = function(game) {
  return game.players[game.currentPlayer]
}
  
var foldPhase = function(socket, io) {
  socket.on('fold', function(data) {
    io.sockets.in(data.room).emit('fold', {
      folding: data.location
    })
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' folds'),
      room: data.room
    })
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

var foldWin = function(socket, io) {
  socket.on('winByFold', function(data) {
    data.game.players[0].stack += data.game.pot;
    io.sockets.in(data.room).emit('message', {
      text: data.game.players[0].name + ' won ' + data.game.pot.toString() + ' chips',
      room: data.room
    })
    updateInfo(data.room, data.game.players[0], socket, io);
    setTimeout(function(){newHand(socket, io, data.room)}, 4000);
  })
}

var nextPhase = function(socket, game, room, io) {
  switch (game.PHASES[game.phase]) {
  case 'Preflop':
    io.sockets.in(room).emit('clearBoard');
    game.players.forEach(function(player) {
      playerSockets[player.name].emit('revealPocket', {
        cards: player.hand,
        location: player.location,
        locations: game.playerPos()
      })
    })
    bet(25, game, currentPlay(game));
    updateInfo(room, currentPlay(game), socket, io);
    game.currentPlayer += 1;  
    bet(50, game, currentPlay(game));
    updateInfo(room, currentPlay(game), socket, io);
    game.currentPlayer += 1;
    game = cyclePlayer(game);
    game.currentBet = 50;
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
    })
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
      updateInfo(room, player, socket, io)
    })
    setTimeout(function(){newHand(socket, io, room)}, 4000);
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
    delete tables[leavingRoom][players[nicknames[socket.id]].location];
    delete players[nicknames[socket.id]];
    delete nicknames[socket.id];
    delete currentRooms[socket.id];
    io.sockets.emit('roomList', getRoomData(io))
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
    foldWin(socket, io);
    handleNameChangeRequests(socket, io);
    handleRoomChangeRequests(socket, io);
    handleDisconnection(socket, io);
    io.sockets.emit('roomList', getRoomData(io));
  })
}
exports.socketIOListen = socketIOListen;