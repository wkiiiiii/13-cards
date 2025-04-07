export type Card = {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
  value: string; // '2' through '10', 'J', 'Q', 'K', 'A', 'Joker'
};

export type PlayerCards = {
  [playerId: string]: Card[];
};

export type GameCards = {
  players: PlayerCards;
  communityCards: Card[];
};

export function createDeck(): Card[] {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  // Add standard cards
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }

  // Add 4 jokers
  for (let i = 0; i < 4; i++) {
    deck.push({ suit: 'joker', value: 'Joker' });
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(players: string[]): GameCards {
  const deck = shuffleDeck(createDeck());
  const playerCards: PlayerCards = {};
  
  // Deal 13 cards to each player
  players.forEach((playerId, index) => {
    playerCards[playerId] = deck.slice(index * 13, (index + 1) * 13);
  });
  
  // Take 4 community cards from the remainder of the deck
  const communityCards = deck.slice(players.length * 13, players.length * 13 + 4);
  
  return {
    players: playerCards,
    communityCards
  };
} 