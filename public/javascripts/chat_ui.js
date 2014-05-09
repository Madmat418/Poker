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
  
  var images = {};
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
  
  var hideButtons = function() {
    $('#check')[0].style.visibility = 'hidden';
    $('#call')[0].style.visibility = 'hidden';
    $('#raise')[0].style.visibility = 'hidden';
    $('#fold')[0].style.visibility = 'hidden';
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
      align: 'center'
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
    
    button.on('click', action)
    layer.add(button);
    layer.add(stringObj)
    stage.add(layer);
    layer.destroy();
  }
  
  var removeButtons = function() {
    console.log('here')
    var buttons = stage.find('.button');
    buttons.each(function(but) {
      but.destroy();
    })
  }
  
  var renderCard = function(loc, card) {
    var layer = new Kinetic.Layer();
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
    var gameState = '';
    var chatApp = new ChatApp.Chat(socket);
    
    
    makeButton([20,20], chatApp.startPoker.bind(chatApp), 'Play Poker');
    socket.on('message', function(message) {
      var newElement = escapeDivText(message);
      $('#chat-messages').prepend(escapeDivText(message.text));
    })
    socket.on('nicknameChangeResult', function(result) {
      if (result.success){
        $('#chat-messages').append(escapeDivText(result.text))
      }
    });
    socket.on('hidePoker', function() {
      $('#play-poker')[0].style.visibility = 'hidden';
    })
    socket.on('roomList', function(roomData){
      updateRoomList(roomData);
    });
    socket.on('renderFlop', function(data) {
      var layer = new Kinetic.Layer();
      for (var i = 0; i <= 2 ; i++) {
        renderCard([(i * 80) + (stage.width() / 2) - 150, (stage.height() / 2 - 50)], images[data.cards[i].img])
      } 
    })
    socket.on('renderTurn', function(data) {
      renderCard([(3 * 80) + (stage.width() / 2) - 150, (stage.height() / 2) - 50], images[data.card[0].img])
    })
    socket.on('renderRiver', function(data) {
      renderCard([(4 * 80) + (stage.width() / 2) - 150, (stage.height() / 2) - 50], images[data.card[0].img])
    })
    socket.on('revealPocket', function(data) {
      renderCard([400, 450], images[data.cards[0].img]);
      renderCard([480, 450], images[data.cards[1].img]);
    })
    
    var timer = '';
    socket.on('betPhase', function(data) {
      gameState = data.game;
      if (data.game.numPlayers === 1) {
        chatApp.winner(gameState);
      } else {
        makeButton([720, 450], fold.bind(chatApp), 'Fold')
        if (data.player.currentBet === data.game.currentBet) {
          makeButton([720, 500], check.bind(chatApp), 'Check');
        } else {
          makeButton([720, 500], call.bind(chatApp), 'Call');
        }
        makeButton([720, 550], raise.bind(chatApp), 'Raise');
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
      stage.clear(); 
    })
    var fold = function() {
      clearInterval(timer);
      chatApp.fold(gameState);
      removeButtons();
    }
    
    var check = function() {
      clearInterval(timer);
      removeButtons();
      chatApp.check(gameState);
    }
    
    var raise = function() {
      clearInterval(timer);
      removeButtons();
      chatApp.raise(gameState);
    }
    var call = function() {
      clearInterval(timer);
      removeButtons();
      chatApp.call(gameState);
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