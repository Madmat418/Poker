(function(root){
  var ChatApp = root.ChatApp = (root.ChatApp || {});
  var Chat = ChatApp.Chat = function(socket) {
    this.socket = socket;
    this.room = 'lobby';
    this.game = '';
  }
  
  Chat.prototype.sendMessage = function(text) {
    this.socket.emit('message', { text: text, room: this.room });
  }
  
  Chat.prototype.joinRoom = function(room) {
    this.room = room;
    this.socket.emit('roomChangeRequest', room);
    this.sendMessage('Switched to ' + room);
  }
  
  Chat.prototype.startPoker = function() {
    this.socket.emit('poker', {room: this.room});
  }
  
  Chat.prototype.testPoker = function() {
    this.socket.emit('testPlay', {room: this.room});
  }
  
  Chat.prototype.fold = function(loc) {
    this.socket.emit('fold', {room: this.room, location: loc});
  }
  
  Chat.prototype.check = function() {
    this.socket.emit('check', {room: this.room});
  }
  
  Chat.prototype.raise = function() {
    this.socket.emit('raise', {room: this.room});
  }
  
  Chat.prototype.call = function() {
    this.socket.emit('call', {room: this.room});
  }
  
  Chat.prototype.processCommand = function(command){
    commandArgs = command.split(' ');
    switch(commandArgs[0]) {
    case 'nick':
      var newName = commandArgs[1];
      this.socket.emit('nicknameChangeRequest', newName);
      break;
    case 'join':
      var newRoom = commandArgs[1];
      this.joinRoom(newRoom);
      break;
    case 'poker':
      this.socket.emit('poker', {room: this.room});
      break;
    default:
      this.socket.emit('message', { text: 'unrecognized command' });
      break;
    }
  }
})(this);