(function(root) {
  Poker = root.Poker = {} || root.Poker;
  
  Room = Poker.Room = function(room) {
    this.name = room;
	this.players = [];
	this.board = [];
	this.pot = 0;
  }
}(this)