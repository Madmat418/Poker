(function(root) {
  Poker = root.Poker = {} || root.Poker;
  Poker.SUITS = ['Hearts', 'Clubs', 'Spades', 'Diamonds'];
  Poker.VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  Poker.VALUESTRINGS = {
        1 : 'Ace', 2 : 'Two', 3 : 'Three', 4 : 'Four', 5 : 'Five', 6 : 'Six', 
        7 : 'Seven', 8 : 'Eight', 9 : 'Nine', 10 : 'Ten', 11 : 'Jack', 12 : 'Queen',
        13 : 'King'
  }
  
  
  Game = Poker.Game = function(players) {
    var that = this;
    this.players = players;
    this.deck = Poker.newDeck();
    this.numPlayers = 0;
    this.players.forEach(function(player) {
      player.hand = that.draw(2);
      that.numPlayers += 1;
    })
    this.draw(1);
    this.flop = this.draw(3);
    this.draw(1);
    this.turn = this.draw(1);
    this.draw(1);
    this.river = this.draw(1);
    this.board = this.flop.concat(this.turn).concat(this.river);
    this.pot = 0;
    this.currentBet = 0;
    this.PHASES = ['Preflop', 'Flop', 'Turn', 'River', 'Resolve']
    this.phase = 0;
    this.currentPlayer = 0;
    this.numCalled = 0;
  }
  
  Game.prototype.playerPos = function() {
    var positions = [];
    this.players.forEach(function(player) {
      positions.push(player.location);
    })
    return positions;
  }

  Game.prototype.draw = function(num) {
    var cards = [];
    for (var i = 1; i <= num; i++) {
      cards.push(this.deck.pop());
    }
    return cards;
  }
  
  Poker.evaluateHand = function(pocket, board) {
    var hand = board.concat(pocket);
    var suitHash = new Object;
    var handHash = {
      'Royal Flush': false, 'Straight Flush': false, 'Four of a Kind': false, 'Full House': false, 
      'Flush': false, 'Straight': false, 'Three of a Kind': false, 'Two Pair': false, 'One Pair': false
    }

    function suitedCards(suit) {
      var cards = [];
      hand.forEach(function(card) {
        if (card.suit === suit) {
          cards.push(card)
        }
      })
      return cards;
    }

    runningCards = function(set) {
      valHash = new Object;
      for (var i = 1; i <= 14; i++) {
        valHash[i] = [];
      }
      set.forEach(function(card) {
        valHash[card.value].push(card);
        if (card.ace) {
          valHash[14].push(card);
        }
      })
      var permRunners = [];
      var tempRunners = [];
      for (i = 1; i <= 14; i++) {
        if (valHash[i].length > 0) {
          tempRunners.push(valHash[i][0]);
          if (tempRunners.length > 5) {
            tempRunners.shift();
            permRunners = tempRunners;
          } else if (tempRunners.length === 5) {
            permRunners = tempRunners;
          }
        } else {
          tempRunners = [];
        }
      }
      if (permRunners.length === 5) {
        handHash['Straight'] = true;
        return permRunners;
      }
    }
    
    var aceValue = function(card) {
      if (card.ace) {
        return 14;
      }
      return card.value
    }

    var setCards = function() {
      var valHash = new Object();
      var cardHash = new Object();
      var result = [];
      
      hand.forEach(function(card) {
        if (card.ace) {
          if (valHash[14]) {
            valHash[14]++;
            cardHash[14].push(card);
          } else {
            valHash[14] = 1;
            cardHash[14] = [card];
          }
        } else {
          if (valHash[card.value]) {
            valHash[card.value]++;
            cardHash[card.value].push(card);
          } else {
            valHash[card.value] = 1;
            cardHash[card.value] = [card];
          }
        }
      })
      var setsHash = new Object();
      var cardSets = new Object();
      for (var value in valHash) {
        if (setsHash[valHash[value]]) {
          setsHash[valHash[value]]++;
          for (var i = 1; i <= valHash[value]; i++) {
            cardSets[valHash[value]].unshift(cardHash[value].shift())
          }
        } else {
          setsHash[valHash[value]] = 1;
          cardSets[valHash[value]] = cardHash[value];
        }
      }
      
      if (setsHash[4]) {
        handHash['Four of a Kind'] = true;
        result = cardSets[4];
        var remaining = removeCards(hand, result);
        result.push(highCard(remaining));
      } else if (setsHash[3] === 2) {
        handHash['Full House'] = true;
        result = cardSets[3].slice(0, 5);
      } else if (setsHash[3] && setsHash[2]) {
        handHash['Full House'] = true;
        result = cardSets[3].concat(cardSets[2].slice(0,2));
      } else if (setsHash[3]) {
        handHash['Three of a Kind'] = true;
        result = cardSets[3];
        var remaining = removeCards(hand, result);
        result.push(highCard(remaining));
        remaining = removeCards(remaining, [result[3]]);
        result.push(highCard(remaining));
      } else if (setsHash[2] >= 2) {
        handHash['Two Pair'] = true;
        result = cardSets[2].slice(0,4);
        var remaining = removeCards(hand, result);
        result.push(highCard(remaining));
      } else if (setsHash[2]) {
        handHash['One Pair'] = true;
        result = cardSets[2];
        var remaining = removeCards(hand, result);
        result.push(highCard(remaining));
        remaining = removeCards(remaining, [result[2]]);
        result.push(highCard(remaining));
        remaining = removeCards(remaining, [result[3]]);
        result.push(highCard(remaining));
      } else {
        result.push(highCard(hand));
        var remaining = removeCards(hand, result);
        result.push(highCard(remaining));
        remaining = removeCards(remaining, [result[1]]);
        result.push(highCard(remaining));
        remaining = removeCards(remaining, [result[2]]);
        result.push(highCard(remaining));
        remaining = removeCards(remaining, [result[3]]);
        result.push(highCard(remaining));
      }
      return result;
    }

    var removeCards = function(set, subset) {
      var newSet = set;
      subset.forEach(function(card) {
        newSet.splice(set.indexOf(card), 1);
      })
      return newSet;
    }

    var highCard = function(set) {
      var highCard = set[0];
      set.forEach(function(card) {
        if (card.value === 1) {
          highCard = card;
        } else if (card.value > highCard.value && highCard.value != 1) {
          highCard = card;
        }
      })
      return highCard;
    }

    var orderCards = function(set) {
      var unorderedSet = set;
      var orderedSet = [];
      for (var i = 1; i <= (set.length - 1); i++) {
        var highest = highCard(unorderedSet);
        orderedSet.unshift(highest);
        removeCards(unorderedSet, [highest]);
      }
      return orderedSet;
    }


    var royalFlush = function(flushed) {
      if (handHash['Straight'] && handHash['Flush']) {
        var royalFlushCheck = {10: false, 11: false, 12: false, 13: false, 1: false};
        flushed.forEach(function(card) {
          if (card.value === 1 || card.value >= 10) {
            royalFlushCheck[card.value] = true;
          }
        })
        for (var val in royalFlushCheck) {
          if (!royalFlushCheck[val]) {
            return;
          }
        }
        handHash['Royal Flush'] = true
      }
    }

    var getResult = function() {
      for (var reveal in handHash) {
        if (handHash[reveal]) {
          return reveal;
        }
      }
    }

    var runners	= runningCards(hand);
    var flushSuit = '';
    var flushedCards = [];
    var sortFlush = [];
    var flushRuns = [];
    var highFlush = '';
    Poker.SUITS.forEach(function(suit) {
      suitHash[suit] = suitedCards(suit);
      if (suitHash[suit].length >= 5) {
        handHash['Flush'] = true;
        flushSuit = suit;
        for (var i = 0; i <= 4; i++) {
          sortFlush[i] = highCard(suitHash[suit]);
          removeCards(suitHash[suit], [sortFlush[i]]);
        }
        highFlush = sortFlush[0];
        if (handHash['Straight']) {
          flushRuns = runningCards(suitHash[suit]);
          if (flushRuns) {
            handHash['Straight Flush'] = true;
            royalFlush(sortFlush)
          }
        }
      }
    })

    var setHand = setCards();
    var handType = getResult();

    switch (handType) {
    case 'Royal Flush':
      return {'string': handType, 'hand': sortFlush, 'value': 1, 'high': [1]};
      break;
    case 'Straight Flush':
      return {'string': handType + ': ' + flushRuns[4].valueString + ' high', 'hand': flushRuns, 'value': 2, 'high': [aceValue(flushRuns[4].value)]};
      break;
    case 'Four of a Kind':
      var kickArray = [aceValue(setHand[0]), aceValue(setHand[4])];
      return {'string': handType + ': ' + setHand[0].valueString + 's', 'hand': setHand, 'value': 3, 'high': kickArray};
      break;
    case 'Full House':
      var kickArray = [aceValue(setHand[0]), aceValue(setHand[3])];
      return {'string': handType + ': ' + setHand[0].valueString + 's full of ' + setHand[3].valueString + 's', 'hand': setHand, 'value': 4, 'high': kickArray};
      break;
    case 'Flush':
      var kickArray = [];
      for (var i = 4; i >= 0; i--) {
        kickArray.push(aceValue(sortFlush[i]));
      }
      return {'string': handType + ': ' + sortFlush[0].valueString + ' high', 'hand': sortFlush, 'value': 5, 'high': kickArray};
      break;
    case 'Straight':
      return {'string': handType + ': ' + runners[4].valueString + ' high', 'hand': runners, 'value': 6, 'high': [aceValue(runners[4])]};
      break;
    case 'Three of a Kind':
      var kickArray = [aceValue(setHand[0]), aceValue(setHand[3]), aceValue(setHand[4])]
      return {'string': handType + ': ' + setHand[0].valueString + 's', 'hand': setHand, 'value': 7, 'high': kickArray};
      break;
    case 'Two Pair':
      var kickArray = [aceValue(setHand[0]), aceValue(setHand[2]), aceValue(setHand[4])];
      return {'string': handType + ': ' + setHand[0].valueString + 's and ' + setHand[2].valueString + 's', 'hand': setHand, 'value': 8, 'high': kickArray};
      break;
    case 'One Pair':
      var kickArray = [aceValue(setHand[0]), aceValue(setHand[2]), aceValue(setHand[3]), aceValue(setHand[4])];
      return {'string': handType + ': ' + setHand[0].valueString + 's', 'hand': setHand, 'value': 9, 'high': kickArray};
      break;
    default:
      var kickArray = [aceValue(setHand[0]), aceValue(setHand[1]), aceValue(setHand[2]), aceValue(setHand[3]), aceValue(setHand[4])]
      return {'string': 'High Card: ' + setHand[0].valueString, 'hand': setHand, 'value': 10, 'high': kickArray };
      break;
    }
  }
  
  
  Card = Poker.Card = function(value, suit) {
    this.value = value;
    this.suit = suit;
    this.ace = false;
    if (this.value === 1) {
      this.ace = true;
    }
    this.string = this.to_s();
    this.valueString = Poker.VALUESTRINGS[this.value];
    this.img = this.imgUrl();
  }
  
  Card.prototype.to_s = function() {
    return Poker.VALUESTRINGS[this.value] + ' of ' + this.suit
  }
  
  Card.prototype.imgUrl = function() {
    return Poker.VALUESTRINGS[this.value] + '_of_' + this.suit;
  }
  
  newDeck = Poker.newDeck = function() {
    var deck = [];
    Poker.SUITS.forEach(function(suit) {
      Poker.VALUES.forEach(function(value) {
        deck.push(new Poker.Card(value, suit))
      })
    })
    for (var i = 1; i <= 5; i++) {
      deck = deck.shuffle();
    }
    return deck;
  }
  
  Array.prototype.shuffle = function() {
    var that = this;
    var length = that.length
    var newArray = [];
    for (var i = 1; i <= length; i++) {
      var ind = Math.round(Math.random() * (that.length - i))
      newArray.push(that.splice(ind, 1)[0]);
    }
    return newArray;
  }
  
  Player = Poker.Player = function(name, socket) {
    this.name = name;
    this.stack = 1000;
    this.hand = [];
    this.room = '';
    this.currentBet = 0;
    this.location = '';
  }
})(this);