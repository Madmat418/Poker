(function(root) {
  var ChatApp = root.ChatApp = (root.ChatApp || {});
  var socket = io.connect();
  var SUITS = ['Hearts', 'Clubs', 'Spades', 'Diamonds'];
  var VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  var VALUESTRINGS = {
        1 : 'Ace', 2 : 'Two', 3 : 'Three', 4 : 'Four', 5 : 'Five', 6 : 'Six', 
        7 : 'Seven', 8 : 'Eight', 9 : 'Nine', 10 : 'Ten', 11 : 'Jack', 12 : 'Queen',
        13 : 'King'
  }
  var POCLOCS = {1: [220, 350], 2: [740, 350], 3: [880, 200], 4: [740, 20],  5: [220, 20],  6: [20, 200]}
  var INFLOCS = {1: [207, 450], 2: [727, 450], 3: [867, 300], 4: [727, 120], 5: [207, 120], 6: [ 7, 300]}
  var images = {};
  var cardBack = new Image();
  cardBack.src = '/assets/Card_Back.jpg';
  SUITS.forEach(function(suit) {
    VALUES.forEach(function(value) {
    var img = new Image();
    img.src = '/assets/' + VALUESTRINGS[value] + '_of_' + suit + '.jpg';
    images[VALUESTRINGS[value] + '_of_' + suit] = img;
  })
  })
  
  var escapeDivText = function(text) {
    return $('<div></div>').text(text);
  }
  
  Kinetic._addName = function(node, name) {
    if(name !== undefined) {
      var names = name.split(/\W+/g);
      for (var n = 0; n < names.length; n++) {
        if (names[n]) {
          if (this.names[names[n]] === undefined) {
            this.names[names[n]] = [];
          }
          this.names[names[n]].push(node);
        }
      }
    }
  }
  
  var processInput = function (chatApp) {
    var text = $('#send-message').val();
    if(text[0] === '/'){
      chatApp.processCommand(text.slice(1));
    } else {
      chatApp.sendMessage(text);
    }
    $('#send-message').val('');
  }
  
  var updateRoomList = function(roomData){
    $('.room-listings').empty();
    $.each(roomData, function(room, userList){
      if (room.length > 0) {
        var roomListing = $('<div></div>').addClass('room-listing');
        roomListing.append($('<h3></h3>').text(room));
        var usersUL = $('<ul></ul>');
        $.each(userList, function(i, username){
          usersUL.append($('<li></li>').text(username));
        });
        roomListing.append(usersUL);
        $('.room-listings').append(roomListing);
      }
    });
  }
  
  var addPlayerInfo = function(player) {
    var info = stage.find('#' + player.name);
    if (info[0]) {
      info[0].destroy();
    }
    var loc = INFLOCS[player.location];
    var layer = new Kinetic.Layer({
      id: player.name
    });
    var rect = new Kinetic.Rect({
      x: loc[0], 
      y: loc[1], 
      height: 40, 
      width: 113, 
      fill: '#ddd', 
      stroke: 'black', 
      strokeWidth: 4
    })
    var stringObj = new Kinetic.Text({
      x: loc[0],
      y: loc[1],
      width: 113,
      text: '\n' + player.name + '\n' + player.stack,
      fontsize: 14,
      fill: '#555',
      align: 'center',
    })
    layer.add(rect);
    layer.add(stringObj);
    stage.add(layer);
  }
  
  
  
  var removeItems = function(name) {
    var items = stage.find(name);
    items.forEach(function(item) {
      item.destroy();
    })
  }
  
  var renderCard = function(loc, card, string) {
    var str = string + ' card'
    var layer = new Kinetic.Layer({
      name: str
    });
    var card = new Kinetic.Image({
      x: loc[0],
      y: loc[1],
      image: card
    })
    layer.add(card);
    stage.add(layer);
  }
  
  var makeButton = function(loc, action, string) {
      var layer = new Kinetic.Layer({
        name: 'button'
      });
      var stringObj = new Kinetic.Text({
        x: loc[0],
        y: loc[1],
        width: 80,
        text: string,
        fontsize: 12,
        fill: '#555',
        align: 'center',
      })
      var button = new Kinetic.Rect({
        x: loc[0],
        y: loc[1],
        height: 40,
        width: 80,
        fill: '#ddd',
        listening: true,
        stroke: 'black',
        strokeWidth: 4
      })
    stringObj.on('click', action);
    button.on('click', action);
    layer.add(button);
    layer.add(stringObj);
    
    stage.add(layer);
  }
  
  $(document).ready(function() {
    var chatApp = new ChatApp.Chat(socket);
    var myPos = 0;
    socket.on('gameInProgress', function(data) {
    
    
    })
    
    socket.on('gameNotStarted', function(data) {
      makeButton([20,20], chatApp.startPoker.bind(chatApp), 'Play Poker');
    })
    socket.on('message', function(message) {
      var newElement = escapeDivText(message);
      $('#chat-messages').prepend(escapeDivText(message.text));
    })
    socket.on('nicknameChangeResult', function(result) {
      if (result.success){
        $('#chat-messages').append(escapeDivText(result.text))
      }
    });
    socket.on('roomList', function(roomData){
      updateRoomList(roomData);
    });
    socket.on('playerInfo', function(data) {
      console.log('something');
      console.log(data.player);
      addPlayerInfo(data.player);
    })
    socket.on('playersInfo', function(data) {
      data.players.forEach(function(player) {
        addPlayerInfo(player);
      })
    })    
    socket.on('renderFlop', function(data) {
      var layer = new Kinetic.Layer();
      for (var i = 0; i <= 2 ; i++) {
        renderCard([(i * 80) + (stage.width() / 2) - 175, (stage.height() / 2 - 50)], images[data.cards[i].img])
      } 
    })
    socket.on('renderTurn', function(data) {
      renderCard([(3 * 80) + (stage.width() / 2) - 175, (stage.height() / 2) - 50], images[data.card[0].img])
    })
    socket.on('renderRiver', function(data) {
      renderCard([(4 * 80) + (stage.width() / 2) - 175, (stage.height() / 2) - 50], images[data.card[0].img])
    })
    socket.on('revealPocket', function(data) {
      myPos = data.location
      data.locations.forEach(function(loc) {
        var num = loc.toString();
        var numString = 'cards' + num;
        if (data.location === loc) {
          var location = POCLOCS[data.location]
          var location2 = [location[0] + 13, location[1]];
          renderCard(location, images[data.cards[0].img], numString);
          renderCard(location2, images[data.cards[1].img], numString);
        } else {
          var location = POCLOCS[loc];
          var location2 = [location[0] + 13, location[1]];
          var num = 
          renderCard(location, cardBack, numString);
          renderCard(location, cardBack, numString);
        }
      })
    })

    var timer = '';
    socket.on('betPhase', function(data) {
      console.log('here');
      if (data.game.numPlayers === 1) {
        chatApp.winner();
      } else {
        makeButton([920, 350], fold.bind(chatApp), 'Fold')
        if (data.player.currentBet === data.game.currentBet) {
          makeButton([920, 400], check.bind(chatApp), 'Check');
        } else {
          makeButton([920, 400], call.bind(chatApp), 'Call');
        }
        makeButton([920, 450], raise.bind(chatApp), 'Raise');
        var ticker = 0;
        timer = setInterval(function() {
          ticker += 1
          if (ticker >= 1500) {
            fold();
          }
        }, 10)
      }
    })
    socket.on('clearBoard', function() {
      removeItems('.button');
      removeItems('.card');
    })
    socket.on('fold', function(data) {
      var numString = data.folding.toString();
      var cardString = '.cards' + numString;
      removeItems(cardString);
    })
    socket.on('newButton', function() {
      makeButton([20,20], chatApp.startPoker.bind(chatApp), 'Play Poker');
    })
    socket.on('playerLeft', function(data) {
      removeItems('#' + data.name);
    })
    var fold = function() {
      clearInterval(timer);
      chatApp.fold(myPos);
      removeItems('.button');
    }
    
    var check = function() {
      clearInterval(timer);
      removeItems('.button');
      chatApp.check();
    }
    
    var raise = function() {
      clearInterval(timer);
      removeItems('.button');
      chatApp.raise();
    }
    var call = function() {
      clearInterval(timer);
      removeItems('.button');
      chatApp.call();
    }
    
    $('.send-form').submit(function(e) {
      e.preventDefault();
      processInput(chatApp);
      return false;
    });
    $('#play-poker').click(function() {
      console.log('button');
      chatApp.startPoker();
    })
    $('#test-poker').click(function() {
      chatApp.testPoker();
    })
  });
})(this);