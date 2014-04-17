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
  
  $(document).ready(function() {
    var gameState = '';
    var chatApp = new ChatApp.Chat(socket);
	var ctx = document.getElementById('my_canvas').getContext('2d');
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
	socket.on('renderFlop', function(data) {
	  for (var i = 0; i <= 2 ; i++) {
	    ctx.drawImage(images[data.cards[i].img] , (i * 80) + (ctx.canvas.width / 2) - 200, (ctx.canvas.height / 2) - 50);
	  }      
	})
	socket.on('renderTurn', function(data) {
	  ctx.drawImage(images[data.card[0].img], (40 + (ctx.canvas.width / 2)), (ctx.canvas.height / 2) - 50);
	})
	socket.on('renderRiver', function(data) {
	  ctx.drawImage(images[data.card[0].img], (120 + (ctx.canvas.width / 2)), (ctx.canvas.height / 2) - 50);
	})
	socket.on('revealPocket', function(data) {
	  ctx.drawImage(images[data.cards[0].img], 400, 500)
	  ctx.drawImage(images[data.cards[1].img], 480, 500)
	})
	socket.on('betPhase', function(data) {
	  console.log(data.player.currentBet);
	  console.log(data.game.currentBet);
	  console.log(data.game.currentPlayer);
	  console.log(data.game);
	  $('#fold')[0].style.visibility = 'visible';
	  if (data.player.currentBet === data.game.currentBet) {
	    $('#check')[0].style.visibility = 'visible';
	  } else {
	    $('#call')[0].style.visibility = 'visible';
	  }
	  $('#raise')[0].style.visibility = 'visible';
	  gameState = data.game;
	})
	socket.on('clearBoard', function() {
	  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);	  
	})
	$('#fold').click(function() {
	  chatApp.fold(gameState);
	  hideButtons();
	})
	$('#check').click(function() {
	  hideButtons();
	  chatApp.check(gameState);
	})
	$('#raise').click(function() {
	  hideButtons();
	  chatApp.raise(gameState);
	})
	$('#call').click(function() {
	  hideButtons();
	  chatApp.call(gameState);
	})
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