# 13 Cards Game

A real-time multiplayer card game built with Next.js and Socket.IO.

## Features

- Real-time multiplayer card game with up to 4 players
- Drag and drop card placement interface
- Community cards with special rules
- Points system with transfer capabilities
- Game round summary with transaction history
- Responsive design for various screen sizes

## Technologies Used

- Next.js
- React
- Socket.IO for real-time communication
- Tailwind CSS for styling
- TypeScript for type safety

## Game Rules

1. Each player receives 13 cards
2. Players must arrange their cards in three rows:
   - Top row: 3 cards
   - Middle row: 5 cards
   - Bottom row: 5 cards
3. Community cards can be selected to enhance your hand
4. Points are calculated based on card combinations

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or yarn

### Installation

1. Clone the repository
```
git clone https://github.com/wkiiiiii/13-cards.git
cd 13-cards
```

2. Install dependencies
```
npm install
# or
yarn install
```

3. Run the development server
```
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Gameplay

1. Join a room in the game lobby
2. Click "Ready" to start the game
3. Arrange your cards by dragging them to the board
4. Select a community card if desired
5. Click "Confirm" when your arrangement is complete
6. View the round summary and transfer points if desired
7. Click "Ready for Next Round" to continue playing

## License

MIT 