import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket as NetSocket } from 'net';
import { Card, PlayerCards, dealCards } from '../../utils/cards';

interface SocketServer extends HTTPServer {
  io?: Server;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

interface GameRoom {
  player: string | null;
  isReady: boolean;
  capacity: number;
  status: 'empty' | 'waiting' | 'ready' | 'playing' | 'summary';
}

// Add interfaces for tracking played cards
interface PlayedCard {
  playerId: string;
  roomId: string;
  cards: {
    row0: Card[];
    row1: Card[];
    row2: Card[];
  };
  communityCardUsed: Card | null;
  confirmed: boolean;
}

const ROOM_CAPACITY = 1; // Only 1 player per room
const rooms: { [key: string]: GameRoom } = {
  'room-1': { player: null, isReady: false, capacity: ROOM_CAPACITY, status: 'empty' },
  'room-2': { player: null, isReady: false, capacity: ROOM_CAPACITY, status: 'empty' },
  'room-3': { player: null, isReady: false, capacity: ROOM_CAPACITY, status: 'empty' },
  'room-4': { player: null, isReady: false, capacity: ROOM_CAPACITY, status: 'empty' },
};

// Track played cards by player
const playedCards: { [playerId: string]: PlayedCard } = {};

// Track ready state for next game
const readyForNextGame: { [playerId: string]: boolean } = {};

// Track player points (default to 0 points each)
const playerPoints: { [roomId: string]: number } = {
  'room-1': 0,
  'room-2': 0,
  'room-3': 0,
  'room-4': 0,
};

// Track point transactions
interface PointTransaction {
  from: string;
  to: string;
  amount: number;
  timestamp: number;
}

const transactions: PointTransaction[] = [];

// Function to ensure player has points entry
function ensurePlayerPoints(roomId: string) {
  if (playerPoints[roomId] === undefined) {
    playerPoints[roomId] = 0; // Default starting points
    console.log(`Initialized room ${roomId} with 0 points`);
  }
}

// Function to get room by player id
function getRoomByPlayerId(playerId: string): string | null {
  const entry = Object.entries(rooms).find(([_, room]) => room.player === playerId);
  return entry ? entry[0] : null;
}

function checkAndStartGame(io: Server) {
  // Count ready rooms
  const readyRooms = Object.entries(rooms).filter(([_, room]) => room.status === 'ready');
  
  // Get all rooms with players (whether ready or not)
  const roomsWithPlayers = Object.entries(rooms).filter(([_, room]) => room.player !== null);
  
  // If at least one room is ready and there are at least two rooms with players, start the game
  if (readyRooms.length >= 1 && roomsWithPlayers.length >= 2) {
    console.log('Starting game with rooms:', roomsWithPlayers);
    
    // Get all players
    const players = roomsWithPlayers.map(([_, room]) => room.player!);
    const gameCards = dealCards(players);
    
    // Clear any existing played cards
    Object.keys(playedCards).forEach(key => {
      delete playedCards[key];
    });
    
    // Update room status and send cards to all players
    roomsWithPlayers.forEach(([roomId, room]) => {
      // Set all rooms with players to playing status
      room.status = 'playing';
      room.isReady = false; // Reset ready status
      
      const playerSocket = io.sockets.sockets.get(room.player!);
      if (playerSocket) {
        // Ensure player has points
        ensurePlayerPoints(roomId);
        
        playerSocket.emit('gameStart', {
          cards: gameCards.players[room.player!],
          communityCards: gameCards.communityCards,
          players: players,
          roomId: roomId
        });
      }
    });
    
    // Broadcast updated room status and points
    io.emit('roomsUpdate', rooms);
    io.emit('pointsUpdate', playerPoints);
  }
}

// Function to check if all players have confirmed their cards
function checkAllPlayersConfirmed(io: Server) {
  // Get all playing rooms with players
  const playingRooms = Object.entries(rooms)
    .filter(([_, room]) => room.status === 'playing' && room.player !== null)
    .map(([roomId, room]) => ({ roomId, playerId: room.player! }));
  
  // Check if all players have played and confirmed
  const allPlayed = playingRooms.every(({ playerId }) => 
    playedCards[playerId] !== undefined
  );
  
  const allConfirmed = playingRooms.every(({ playerId }) => 
    playedCards[playerId]?.confirmed === true
  );
  
  console.log('Check all confirmed:', { 
    playingRooms: playingRooms.length,
    allPlayed, 
    allConfirmed,
    playedCards: Object.keys(playedCards).length
  });
  
  // If all players have confirmed, send the summary
  if (allConfirmed && playingRooms.length >= 2) {
    console.log('All players have confirmed their cards, sending summary');
    
    // Create summary object with all played cards
    const summary = Object.values(playedCards).map(played => ({
      roomId: played.roomId,
      playerId: played.playerId,
      cards: {
        row0: played.cards.row0,
        row1: played.cards.row1,
        row2: played.cards.row2,
      },
      communityCardUsed: played.communityCardUsed
    }));
    
    // Update room status to summary
    playingRooms.forEach(({ roomId }) => {
      if (rooms[roomId]) {
        rooms[roomId].status = 'summary';
      }
    });
    
    // Reset ready for next game
    playingRooms.forEach(({ playerId }) => {
      readyForNextGame[playerId] = false;
    });
    
    // Send summary to all players
    io.emit('cardsSummary', summary);
    io.emit('roomsUpdate', rooms);
  }
}

// Function to check if all players are ready for the next game
function checkAllPlayersReadyForNextGame(io: Server) {
  // Get all rooms in summary state with players
  const summaryRooms = Object.entries(rooms)
    .filter(([_, room]) => room.status === 'summary' && room.player !== null)
    .map(([roomId, room]) => ({ roomId, playerId: room.player! }));
  
  // Check if all players are ready for next game
  const allReady = summaryRooms.length >= 2 && 
    summaryRooms.every(({ playerId }) => readyForNextGame[playerId]);
  
  // If all players are ready, start a new game
  if (allReady) {
    console.log('All players are ready for the next game');
    
    // Reset all rooms to ready state
    summaryRooms.forEach(({ roomId }) => {
      if (rooms[roomId]) {
        rooms[roomId].status = 'ready';
        rooms[roomId].isReady = true;
      }
    });
    
    // Clear played cards
    Object.keys(playedCards).forEach(key => {
      delete playedCards[key];
    });
    
    // Clear ready for next game state
    Object.keys(readyForNextGame).forEach(key => {
      readyForNextGame[key] = false;
    });
    
    // Broadcast room updates
    io.emit('roomsUpdate', rooms);
    
    // Start new game
    checkAndStartGame(io);
  }
}

const SocketHandler = (_: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    res.end();
    return;
  }

  console.log('Setting up socket');
  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
  });
  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    console.log('Current rooms state:', rooms);
    console.log('Current points state:', playerPoints);

    // Send initial rooms state and points
    socket.emit('roomsUpdate', rooms);
    socket.emit('pointsUpdate', playerPoints);
    socket.emit('transactionsUpdate', transactions);

    // Handle room joining
    socket.on('joinRoom', (roomId: string) => {
      console.log(`Player ${socket.id} attempting to join room ${roomId}`);
      const room = rooms[roomId];
      
      if (!room || room.status === 'playing' || room.player !== null) {
        socket.emit('error', 'Room is not available');
        return;
      }

      // Leave current room if in one
      Object.entries(rooms).forEach(([id, r]) => {
        if (r.player === socket.id) {
          r.player = null;
          r.isReady = false;
          r.status = 'empty';
        }
      });

      // Join new room
      room.player = socket.id;
      room.status = 'waiting';
      room.isReady = false;
      
      console.log(`Player ${socket.id} joined room ${roomId} with ${playerPoints[roomId]} points`);
      console.log('Updated rooms state:', rooms);
      
      io.emit('roomsUpdate', rooms);
      io.emit('pointsUpdate', playerPoints);
      socket.emit('joinedRoom', roomId);
    });

    // Handle ready state
    socket.on('toggleReady', (roomId: string) => {
      console.log(`Player ${socket.id} toggling ready state for room ${roomId}`);
      const room = rooms[roomId];
      
      if (!room) {
        console.log('Room not found:', roomId);
        return;
      }
      
      if (room.player !== socket.id) {
        console.log('Player not in this room:', socket.id);
        return;
      }

      room.isReady = !room.isReady;
      room.status = room.isReady ? 'ready' : 'waiting';
      console.log(`Room ${roomId} updated:`, room);
      
      io.emit('roomsUpdate', rooms);
      console.log('Sent roomsUpdate with:', rooms);
      
      // Check if we can start the game
      checkAndStartGame(io);
    });

    // Handle card confirmation
    socket.on('confirmCards', ({ roomId, cards, communityCardUsed }) => {
      console.log(`Player ${socket.id} confirmed cards in room ${roomId}`, {
        cards,
        communityCardUsed
      });
      const room = rooms[roomId];
      
      if (!room || room.player !== socket.id || room.status !== 'playing') {
        console.log('Invalid card confirmation:', { room, player: socket.id });
        return;
      }
      
      // Store the played cards
      playedCards[socket.id] = {
        playerId: socket.id,
        roomId,
        cards,
        communityCardUsed,
        confirmed: true
      };
      
      console.log(`Cards confirmed for player ${socket.id}`);
      
      // Check if all players have confirmed
      checkAllPlayersConfirmed(io);
    });

    // Handle ready for next game
    socket.on('readyForNextGame', (roomId: string) => {
      console.log(`Player ${socket.id} is ready for next game in room ${roomId}`);
      const room = rooms[roomId];
      
      if (!room || room.player !== socket.id || room.status !== 'summary') {
        console.log('Invalid ready for next game:', { room, player: socket.id });
        return;
      }
      
      // Mark player as ready for next game
      readyForNextGame[socket.id] = true;
      
      console.log(`Player ${socket.id} marked as ready for next game`);
      
      // Check if all players are ready for next game
      checkAllPlayersReadyForNextGame(io);
    });

    // Handle points transfer
    socket.on('transferPoints', ({ fromRoomId, toRoomId, amount }) => {
      console.log(`Player ${socket.id} transferring ${amount} points from ${fromRoomId} to ${toRoomId}`);
      
      // Validate amount is positive
      if (amount <= 0) {
        socket.emit('error', 'Cannot transfer zero or negative points');
        return;
      }
      
      // Get player IDs from room IDs
      const fromPlayer = rooms[fromRoomId]?.player;
      const toPlayer = rooms[toRoomId]?.player;
      
      console.log('Transfer attempt:', {
        fromRoom: fromRoomId,
        toRoom: toRoomId,
        fromPlayer,
        toPlayer,
        currentRoomStatus: rooms[fromRoomId]?.status,
        targetRoomStatus: rooms[toRoomId]?.status
      });
      
      // Validate players exist and are in summary state
      if (!fromPlayer || !toPlayer) {
        console.log('Invalid transfer: Players not found');
        socket.emit('error', 'Cannot transfer points - players not found');
        return;
      }
      
      if (rooms[fromRoomId]?.status !== 'summary' || rooms[toRoomId]?.status !== 'summary') {
        console.log('Invalid transfer: Not in summary state', {
          fromRoomStatus: rooms[fromRoomId]?.status,
          toRoomStatus: rooms[toRoomId]?.status
        });
        socket.emit('error', 'Cannot transfer points - game not in summary state');
        return;
      }
      
      // Ensure sender is the one requesting the transfer
      if (fromPlayer !== socket.id) {
        console.log('Invalid transfer: Not authorized to transfer from this room');
        socket.emit('error', 'You can only transfer your own points');
        return;
      }
      
      // Ensure sender has points entry (can now be negative)
      ensurePlayerPoints(fromRoomId);
      ensurePlayerPoints(toRoomId);
      
      console.log('Points before transfer:', {
        fromPlayer: playerPoints[fromRoomId],
        toPlayer: playerPoints[toRoomId]
      });
      
      // Transfer points (allowed to go negative)
      playerPoints[fromRoomId] -= amount;
      playerPoints[toRoomId] += amount;
      
      // Record the transaction
      const transaction: PointTransaction = {
        from: fromRoomId,
        to: toRoomId,
        amount,
        timestamp: Date.now()
      };
      transactions.push(transaction);
      
      console.log('Points after transfer:', {
        fromPlayer: playerPoints[fromRoomId],
        toPlayer: playerPoints[toRoomId]
      });
      
      // Broadcast updated points and transactions
      io.emit('pointsUpdate', playerPoints);
      io.emit('transactionsUpdate', transactions);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      // Remove played cards for disconnected player
      delete playedCards[socket.id];
      delete readyForNextGame[socket.id];
      
      Object.entries(rooms).forEach(([roomId, room]) => {
        if (room.player === socket.id) {
          room.player = null;
          room.isReady = false;
          room.status = 'empty';
          console.log(`Player ${socket.id} removed from room ${roomId}`);
          io.emit('roomsUpdate', rooms);
        }
      });
      
      // Keep player points in case they reconnect
    });
  });

  res.end();
};

export default SocketHandler;

export const config = {
  api: {
    bodyParser: false,
  },
}; 