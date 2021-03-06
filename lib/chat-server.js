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
  if (!pokerTables[room]) {
      io.sockets.in(room).emit('gameNotStarted');
  }
  socket.emit('playersInfo', {
    players: playerRooms[room]
  })
  io.sockets.in(room).emit('playerInfo', {
    player: players[name]
  })
}

var tableSpot = function(room, player) {
  if (tables[room]) {
    var ind = -1;
    for (var i = 0; !!tables[room][i]; i++) {
      ind = i;
    }
    tables[room][ind + 1] = player;
    player.location = ind + 1;
  } else {
    tables[room] = {0: player};
    player.location = 0;
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
        text: "Please wait until at least two players are seated at this table.  If you would like to test gameplay, join in a second window.",
        room: data.room
      })
    } else {
      newHand(socket, io, data.room, 0);
    }
  })
}

var newHand = function(socket, io, room, dealer) {
  if (!pokerTables[room]) {
    if (playerRooms[room].length < 2) {
      io.sockets.in(room).emit('message', {
        text: "Please wait until at least two players are seated at this table.  If you would like to test gameplay, join with a second window.",
        room: room
      })
      socket.emit('gameNotStarted');
    } else {
      var tablePlayers = playerRooms[room];
      var newHand = new Poker.Game(tablePlayers, dealer, room);
      newHand.players.forEach(function(player) {
        player.currentBet = 0
      })
      pokerTables[room] = newHand;
      nextPhase(socket, newHand, room, io);
    }
  }
}

var checkPhase = function(socket, io) {
  socket.on('check', function(data) {
    var game = currentGame(data.room);
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' checks'),
      room: data.room
    })
    game.numCalled += 1;
    game.currentPlayer += 1;
    checkCalls(socket, game, data.room, io);
  })
}

var currentGame = function(room) {
  return pokerTables[room]
}
  
var raisePhase = function(socket, io) {
  socket.on('raise', function(data) {
    var game = currentGame(data.room)
    var toCall = game.currentBet - currentPlay(game).currentBet
    var toBet = toCall + 50;
    game.currentBet += 50;
    bet(toBet, game, currentPlay(pokerTables[data.room]));
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' raises to' + pokerTables[data.room].currentBet),
      room: data.room
    })
    updateInfo(data.room, currentPlay(pokerTables[data.room]), socket, io);
    pokerTables[data.room].numCalled = 1;
    game.currentPlayer += 1;
    checkCalls(socket, game, data.room, io);
  })
}
var callPhase = function(socket, io) {
  socket.on('call', function(data) {
    var game = currentGame(data.room);
    var toCall = game.currentBet - currentPlay(game).currentBet
    bet(toCall, game, currentPlay(game));
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' calls ' + toCall),
      room: data.room
    })
    updateInfo(data.room, currentPlay(game), socket, io);
    console.log(currentPlay(game).stack);
    game.numCalled += 1;
    game.currentPlayer += 1;
    checkCalls(socket, game, data.room, io);
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
    var game = currentGame(data.room);
    io.sockets.in(data.room).emit('fold', {
      folding: data.location
    })
    io.sockets.in(data.room).emit('message', {
      text: (nicknames[socket.id] + ' folds'),
      room: data.room
    })
    currentPlay(game).order = -1;
    game.players.splice(game.currentPlayer, 1);
    game.numPlayers -= 1;
    checkCalls(socket, game, data.room, io);
  })
}

var bet = function(amt, game, player) {
  player.currentBet += amt;
  player.stack -= amt;
  game.pot += amt;
}

var cyclePlayer = function(game) {
  if (game.currentPlayer >= game.numPlayers) {
    game.currentPlayer = 0;
  }
  return game;
}

var foldWin = function(socket, io, room) {
  var game = currentGame(room);
  game.players[0].stack += game.pot;
  io.sockets.in(room).emit('message', {
    text: game.players[0].name + ' won ' + game.pot.toString() + ' chips',
    room: room
  })
  updateInfo(room, game.players[0], socket, io);
  setTimeout(function(){newHand(socket, io, room, findNextDealer(game.dealer + 1, game.room), 4000)});
  delete game;
  delete pokerTables[room];
}

var preFlop = function(socket, game, room, io) {
  io.sockets.in(room).emit('clearBoard');
  game.players.forEach(function(player) {
    playerSockets[player.name].emit('revealPocket', {
      cards: player.hand,
      location: player.location,
      locations: game.playerPos()
    })
    playerSockets[player.name].emit('dealButton', {
      loc: game.dealer
    })
  })
  game = cyclePlayer(game);
  bet(25, game, currentPlay(game));
  updateInfo(room, currentPlay(game), socket, io);
  game.currentPlayer += 1;
  game = cyclePlayer(game)
  bet(50, game, currentPlay(game));
  updateInfo(room, currentPlay(game), socket, io);
  game.currentPlayer += 1;
  game = cyclePlayer(game);
  game.currentBet = 50;
  checkBet(game.players[game.currentPlayer], game)
}

var flop = function(socket, game, room, io) {
  io.sockets.in(room).emit('message', {
    text: 'Flop',
    room: room
  })
  io.sockets.in(room).emit('renderFlop', {
    cards: game.flop,
    room: room
  })
  checkBet(game.players[game.currentPlayer], game)
}

var turn = function(socket, game, room, io) {
  io.sockets.in(room).emit('message', {
    text: 'Turn',
    room: room
  })
  io.sockets.in(room).emit('renderTurn', {
    card: game.turn,
    room: room
  })
  checkBet(game.players[game.currentPlayer], game)
}

var river = function(socket, game, room, io) {
  io.sockets.in(room).emit('message', {
    text: 'River',
    room: room
  })
  io.sockets.in(room).emit('renderRiver', {
    card: game.river,
    room: room
  })
  checkBet(game.players[game.currentPlayer], game)
}

var resolve = function(socket, game, room, io) {
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
  delete pokerTables[room];
  setTimeout(function() {newHand(socket, io, room, findNextDealer(game.dealer + 1, room))}, 4000)
  delete currentGame(room);
}

var findNextDealer = function(dealer, room) {
  console.log('mmmmmmmmmmmmmmm');
  if (tables[room][dealer]) {
    return dealer;
  } else {
    if (dealer > 5) {
      return findNextDealer(0, room);
    } else {
      return findNextDealer(dealer + 1, room);
    }  
  } 
}
var nextPhase = function(socket, game, room, io) {
  switch (game.PHASES[game.phase]) {
  case 'Preflop':
    preFlop(socket, game, room, io);
    break;     
  case 'Flop':
    flop(socket, game, room, io);
    break;
  case 'Turn':
    turn(socket, game, room, io);
    break;
  case 'River':
    river(socket, game, room, io);
    break;
  case 'Resolve':
    resolve(socket, game, room, io);
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
  var game = cyclePlayer(game);
  if (game.numPlayers === 1) {
    foldWin(socket, io, room);
  } else if (game.numCalled === game.numPlayers) {
    game.numCalled = 0;
    game.currentBet = 0;
    game.phase += 1;
    game.currentPlayer = 0;
    game.players.forEach(function(player) {
      player.currentBet = 0;
    })
    nextPhase(socket, game, room, io);
  } else {
    checkBet(currentPlay(game), game);
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
    var leavingPlayer = players[nicknames[socket.id]]
    var name = leavingPlayer.name;
    var room = leavingPlayer.room;
    var game = currentGame(room);
    var current = false;
    
    if (game) {
      var currentName = currentPlay(game).name;
      if (currentName === name) {
        current = true;
      } else if (game.currentPlayer > leavingPlayer.order && leavingPlayer.order >= 0) {
        game.currentPlayer -= 1;
      }
      if (leavingPlayer.order >= 0) {
        game.numPlayers -= 1;
        game.players.splice(leavingPlayer.order, 1);
      }
      if (game.numPlayers === 1) {
        playerSockets[game.players[0].name].emit('winWhilePlaying');
        foldWin(socket, io, room);
      }
    }
    
    var seat = playerRooms[room].indexOf(leavingPlayer)
    playerRooms[room].splice(seat, 1);
    var nameIndex = namesUsed.indexOf(name);
    delete namesUsed[nameIndex];
    delete tables[room][leavingPlayer.location];
    delete players[name];
    delete nicknames[socket.id];
    delete currentRooms[socket.id];
    io.sockets.in(room).emit('fold', {
      folding: leavingPlayer.location
    })
    io.sockets.in(room).emit('message', {
      text: (name + ' is leaving' + room + '.'),
      room: room
    })
    io.sockets.in(room).emit('playerLeft', {
      name: name
    })
    
    io.sockets.emit('roomList', getRoomData(io))
    if (current && game.numPlayers > 1) {
      console.log('&&&&&&&&&&&&&&&&&&&&&');
      game = cyclePlayer(game);
      checkCalls(socket, game, room, io);
    } 
  })
}

var handleNameChangeRequests = function(socket, io) {
  socket.on('nicknameChangeRequest', function(name) {
    if (name.indexOf('Guest') === 0 ) {
      socket.emit('nicknameChangeResult', {
        success: false,
        message: 'Custom names cannot begin with "Guest".'
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
    handleNameChangeRequests(socket, io);
    handleRoomChangeRequests(socket, io);
    handleDisconnection(socket, io);
    io.sockets.emit('roomList', getRoomData(io));
  })
}
exports.socketIOListen = socketIOListen;