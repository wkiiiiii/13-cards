import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Card } from '../utils/cards';

interface GameRoom {
  player: string | null;
  isReady: boolean;
  capacity: number;
  status: 'empty' | 'waiting' | 'ready' | 'playing' | 'summary';
}

// Interface for card summary
interface CardSummary {
  roomId: string;
  playerId: string;
  cards: {
    row0: Card[];
    row1: Card[];
    row2: Card[];
  };
  communityCardUsed: Card | null;
}

interface PointTransaction {
  from: string;
  to: string;
  amount: number;
  timestamp: number;
}

interface SocketContextType {
  socket: Socket | null;
  rooms: {
    [key: string]: GameRoom;
  };
  currentRoom: string | null;
  cards: Card[];
  communityCards: Card[];
  error: string | null;
  toggleReady: (roomId: string) => void;
  confirmCards: (roomId: string, cards: { row0: Card[], row1: Card[], row2: Card[] }, communityCardUsed: Card | null) => void;
  cardsSummary: CardSummary[] | null;
  readyForNextGame: (roomId: string) => void;
  points: { [roomId: string]: number };
  transferPoints: (fromRoomId: string, toRoomId: string, amount: number) => void;
  transactions: PointTransaction[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  rooms: {},
  currentRoom: null,
  cards: [],
  communityCards: [],
  error: null,
  toggleReady: () => {},
  confirmCards: () => {},
  cardsSummary: null,
  readyForNextGame: () => {},
  points: {},
  transferPoints: () => {},
  transactions: [],
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<{ [key: string]: GameRoom }>({});
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cardsSummary, setCardsSummary] = useState<CardSummary[] | null>(null);
  const [points, setPoints] = useState<{ [roomId: string]: number }>({});
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);

  const toggleReady = (roomId: string) => {
    if (socket && currentRoom === roomId) {
      console.log('Emitting toggleReady for room:', roomId);
      socket.emit('toggleReady', roomId);
    } else {
      console.log('Cannot toggle ready:', { socket: !!socket, currentRoom, roomId });
    }
  };

  const confirmCards = (roomId: string, cards: { row0: Card[], row1: Card[], row2: Card[] }, communityCardUsed: Card | null) => {
    if (socket && currentRoom === roomId) {
      console.log('Confirming cards for room:', roomId, 'with community card:', communityCardUsed);
      socket.emit('confirmCards', { roomId, cards, communityCardUsed });
    } else {
      console.log('Cannot confirm cards:', { socket: !!socket, currentRoom, roomId });
    }
  };

  const readyForNextGame = (roomId: string) => {
    if (!socket) return;
    
    console.log('Ready for next game:', roomId);
    socket.emit('readyForNextGame', roomId);
    
    // Clear the summary after player is ready for the next game
    setCardsSummary([]);
    
    // Also clear cards to ensure board resets
    setCards([]);
  };

  // Listen for transactions update
  useEffect(() => {
    if (!socket) return;
    
    socket.on('transactionsUpdate', (updatedTransactions: PointTransaction[]) => {
      console.log('Transactions updated:', updatedTransactions);
      setTransactions(updatedTransactions);
    });
    
    return () => {
      socket.off('transactionsUpdate');
    };
  }, [socket]);

  // Function to transfer points between players
  const transferPoints = (fromRoomId: string, toRoomId: string, amount: number) => {
    if (!socket) {
      console.error('Cannot transfer points - socket not connected');
      return;
    }
    
    if (currentRoom !== fromRoomId) {
      console.error('Cannot transfer points - not in the sending room');
      return;
    }
    
    console.log(`Emitting transferPoints: ${amount} points from ${fromRoomId} to ${toRoomId}`);
    socket.emit('transferPoints', { fromRoomId, toRoomId, amount });
  };

  useEffect(() => {
    const initSocket = async () => {
      // Initialize socket server
      await fetch('/api/socket');

      const socketInstance = io('', {
        path: '/api/socket',
      });

      socketInstance.on('connect', () => {
        console.log('Connected to socket');
        setError(null);
      });

      socketInstance.on('roomsUpdate', (updatedRooms) => {
        console.log('Rooms updated (detailed):', {
          updatedRooms,
          currentRoom,
          previousRooms: rooms
        });
        setRooms(updatedRooms);
      });

      socketInstance.on('joinedRoom', (roomId) => {
        setCurrentRoom(roomId);
        setCards([]);
        setCommunityCards([]);
        setCardsSummary(null); // Reset card summary when joining a new room
      });

      socketInstance.on('gameStart', (data) => {
        console.log('Game started:', data);
        setCards(data.cards);
        setCommunityCards(data.communityCards);
        setCurrentRoom(data.roomId);
        
        // Reset any cards summary when a new game starts
        setCardsSummary([]);
      });

      socketInstance.on('cardsSummary', (summaryData) => {
        console.log('Received card summary:', summaryData);
        setCardsSummary(summaryData);
      });

      socketInstance.on('error', (message) => {
        console.error('Socket error:', message);
        setError(message);
      });

      // Listen for points update
      socketInstance.on('pointsUpdate', (updatedPoints) => {
        console.log('Points updated:', updatedPoints);
        console.log('Current room:', currentRoom);
        if (currentRoom) {
          console.log('My points now:', updatedPoints[currentRoom]);
        }
        setPoints(updatedPoints);
      });

      setSocket(socketInstance);
    };

    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('cardsSummary', (summaryData) => {
      console.log('Received card summary:', summaryData);
      setCardsSummary(summaryData);
    });
    
    return () => {
      socket.off('cardsSummary');
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      rooms, 
      currentRoom, 
      cards, 
      communityCards,
      error, 
      toggleReady,
      confirmCards,
      cardsSummary,
      readyForNextGame,
      points,
      transferPoints,
      transactions
    }}>
      {children}
    </SocketContext.Provider>
  );
}; 