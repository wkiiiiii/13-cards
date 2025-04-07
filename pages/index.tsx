import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import Head from 'next/head';
import { Card } from '../utils/cards';

// Type for cards with position
interface PositionedCard extends Card {
  id: string;
  isPlaced: boolean;
  position?: {row: number; slot: number};
}

// Define Positions interface
interface Positions {
  row0: Card[];
  row1: Card[];
  row2: Card[];
}

function CardComponent({ 
  card, 
  isSmall, 
  onClick 
}: { 
  card: PositionedCard; 
  isSmall?: boolean;
  onClick?: () => void;
}) {
  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
    joker: '★', // Star symbol for joker
  };

  // Determine card color based on suit
  let color = 'text-gray-900'; // Default for clubs and spades
  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    color = 'text-red-500';
  } else if (card.suit === 'joker') {
    color = 'text-purple-600';
  }

  const baseClasses = "bg-white rounded-lg shadow-md flex flex-col items-center justify-between cursor-pointer hover:shadow-xl transition-shadow";
  
  // Reduced sizes for both regular and small cards for better mobile compatibility
  const sizeClasses = isSmall 
    ? "w-8 h-12 p-1" // Smaller size for already small cards
    : "w-[45px] h-[63px] p-1"; // Reduced size for regular cards (was 60x84)

  return (
    <div 
      className={`${baseClasses} ${sizeClasses} ${card.isPlaced ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div className={`${color} flex flex-col items-center`}>
        <div className={`font-bold ${isSmall ? 'text-xs' : 'text-sm'}`}>{card.value}</div>
        <div className={isSmall ? 'text-base' : 'text-lg'}>{suitSymbols[card.suit]}</div>
      </div>
    </div>
  );
}

function EmptySlot({ 
  isOccupied, 
  card,
  onClick
}: { 
  isOccupied: boolean; 
  card?: PositionedCard;
  onClick?: () => void;
}) {
  return (
    <div 
      className={`w-[45px] h-[63px] rounded-lg shadow-md ${isOccupied ? 'p-0' : 'bg-white opacity-80'}`}
      onClick={onClick}
    >
      {isOccupied && card && <CardComponent card={card} isSmall={false} />}
    </div>
  );
}

function CardSummary({ summary, onReady }: { 
  summary: Array<{ 
    roomId: string; 
    playerId: string; 
    cards: { 
      row0: Card[]; 
      row1: Card[]; 
      row2: Card[];
    };
    communityCardUsed: Card | null;
  }>;
  onReady: () => void;
}) {
  const { points, currentRoom, transferPoints, transactions } = useSocket();
  const [transfers, setTransfers] = useState<{[roomId: string]: number}>({});
  
  // Format time from timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get transactions relevant to a room
  const getRoomTransactions = (roomId: string) => {
    return transactions.filter(t => t.from === roomId || t.to === roomId);
  };
  
  const renderCard = (card: Card) => {
    const suitSymbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
      joker: '★', // Star symbol for joker
    };
    
    // Determine color based on suit
    let color = 'text-gray-900'; // Default for clubs and spades
    if (card.suit === 'hearts' || card.suit === 'diamonds') {
      color = 'text-red-500';
    } else if (card.suit === 'joker') {
      color = 'text-purple-600';
    }
    
    return (
      <span className={`${color} font-bold text-sm`}>
        {card.value}{suitSymbols[card.suit]}
      </span>
    );
  };
  
  const handleTransfer = (toRoomId: string) => {
    if (!currentRoom || toRoomId === currentRoom) return;
    
    const amount = transfers[toRoomId] || 0;
    if (amount <= 0) return;
    
    transferPoints(currentRoom, toRoomId, amount);
    
    // Reset just this transfer amount
    setTransfers(prev => ({
      ...prev,
      [toRoomId]: 0
    }));
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, roomId: string) => {
    const value = parseInt(e.target.value);
    setTransfers(prev => ({
      ...prev,
      [roomId]: isNaN(value) ? 0 : Math.max(0, value)
    }));
  };
  
  // Render transaction history for a room
  const renderTransactionHistory = (roomId: string) => {
    const roomTransactions = getRoomTransactions(roomId);
    
    if (roomTransactions.length === 0) {
      return <p className="text-gray-500 italic text-xs">No transactions yet</p>;
    }
    
    return (
      <div className="max-h-24 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-0.5">Time</th>
              <th className="text-left p-0.5">Details</th>
              <th className="text-right p-0.5">Amt</th>
            </tr>
          </thead>
          <tbody>
            {roomTransactions.map((tx, i) => {
              const isReceiving = tx.to === roomId;
              const otherRoom = isReceiving ? tx.from : tx.to;
              
              return (
                <tr key={`${tx.timestamp}-${i}`} className="border-b border-gray-100">
                  <td className="p-0.5">{formatTime(tx.timestamp)}</td>
                  <td className="p-0.5 truncate max-w-[120px]">
                    {isReceiving 
                      ? `From ${otherRoom.replace('-', ' ').toUpperCase()}`
                      : `To ${otherRoom.replace('-', ' ').toUpperCase()}`
                    }
                  </td>
                  <td className={`p-0.5 text-right ${isReceiving ? 'text-green-600' : 'text-red-600'}`}>
                    {isReceiving ? '+' : '-'}{tx.amount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl p-3 shadow-2xl w-full max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-3 text-center">Card Summary</h2>
        
        {/* Card Summary Section with integrated transfer controls */}
        <div className="space-y-4">
          {summary.map((playerSummary, index) => (
            <div key={playerSummary.roomId} className="border rounded-lg p-2 bg-gray-50">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-base font-semibold">
                    Player {index + 1} ({playerSummary.roomId.replace('-', ' ').toUpperCase()})
                  </h3>
                  <p className={`text-base ${(points[playerSummary.roomId] || 0) < 0 ? 'text-red-600' : 'text-blue-600'} font-bold`}>
                    {points[playerSummary.roomId] || 0} points
                  </p>
                </div>
                
                {/* Transfer controls - only show for other players when in summary state */}
                {currentRoom && currentRoom !== playerSummary.roomId && (
                  <div className="bg-blue-50 p-2 rounded-md flex items-center space-x-1 self-start">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-0.5">Transfer points:</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={transfers[playerSummary.roomId] || 0}
                          onChange={(e) => handleAmountChange(e, playerSummary.roomId)}
                          className="border rounded p-0.5 w-14 text-right mr-1 text-sm"
                        />
                        <button
                          onClick={() => handleTransfer(playerSummary.roomId)}
                          disabled={(transfers[playerSummary.roomId] || 0) <= 0}
                          className={`px-2 py-0.5 rounded text-xs ${
                            (transfers[playerSummary.roomId] || 0) <= 0
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Transaction history */}
              <div className="mb-2">
                <h4 className="font-medium text-xs mb-0.5 text-gray-700">Transaction History:</h4>
                {renderTransactionHistory(playerSummary.roomId)}
              </div>
              
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium mb-0.5">Top Row:</p>
                  <div className="flex flex-wrap gap-1">
                    {playerSummary.cards.row0.map((card, i) => (
                      <span key={`${playerSummary.playerId}-0-${i}`} className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                        {renderCard(card)}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-0.5">Middle Row:</p>
                  <div className="flex flex-wrap gap-1">
                    {playerSummary.cards.row1.map((card, i) => (
                      <span key={`${playerSummary.playerId}-1-${i}`} className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                        {renderCard(card)}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-0.5">Bottom Row:</p>
                  <div className="flex flex-wrap gap-1">
                    {playerSummary.cards.row2.map((card, i) => (
                      <span key={`${playerSummary.playerId}-2-${i}`} className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                        {renderCard(card)}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Community card used */}
                {playerSummary.communityCardUsed && (
                  <div>
                    <p className="text-sm font-medium mb-0.5">Community Card Used:</p>
                    <span className="px-2 py-1 bg-blue-100 rounded-md inline-block text-xs">
                      {renderCard(playerSummary.communityCardUsed)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-center">
          <button 
            onClick={onReady}
            className="px-4 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Ready for Next Round
          </button>
        </div>
      </div>
    </div>
  );
}

function GameBoard({ cards }: { cards: Card[] }) {
  // Define positions with correct structure
  const [positions, setPositions] = useState<{[key: string]: PositionedCard | null}>({
    // First row - 3 slots
    '0-0': null, '0-1': null, '0-2': null,
    // Second row - 5 slots
    '1-0': null, '1-1': null, '1-2': null, '1-3': null, '1-4': null,
    // Third row - 5 slots
    '2-0': null, '2-1': null, '2-2': null, '2-3': null, '2-4': null,
  });
  const [isReady, setIsReady] = useState(false);
  const { socket, currentRoom, confirmCards, cardsSummary, readyForNextGame, points, communityCards } = useSocket();
  const [sortMethod, setSortMethod] = useState<'value' | 'valueReverse' | 'suit'>('value');
  const [boardCards, setBoardCards] = useState<PositionedCard[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedCommunityCard, setSelectedCommunityCard] = useState<Card | null>(null);
  const [draggedCard, setDraggedCard] = useState<PositionedCard | null>(null);
  
  // Transform cards into PositionedCard objects
  useEffect(() => {
    // Reset the positions whenever new cards are received
    setPositions({
      '0-0': null, '0-1': null, '0-2': null,
      '1-0': null, '1-1': null, '1-2': null, '1-3': null, '1-4': null,
      '2-0': null, '2-1': null, '2-2': null, '2-3': null, '2-4': null,
    });
    
    setConfirmed(false);
    setSelectedCommunityCard(null);
    
    setBoardCards(cards.map((card, index) => ({
      ...card,
      id: `${card.suit}-${card.value}-${index}`,
      isPlaced: false
    })));
  }, [cards]);
  
  const isGameComplete = Object.values(positions).filter(Boolean).length === 13;
  
  // Handle selecting a community card
  const handleCommunityCardClick = (card: Card) => {
    if (confirmed) return;
    
    // Disable selection of joker cards completely
    if (card.suit === 'joker') {
      return;
    }
    
    // For non-joker community cards: auto-place them in the next available slot
    
    // If this card is already selected, deselect it and remove from board
    if (selectedCommunityCard && 
        selectedCommunityCard.suit === card.suit && 
        selectedCommunityCard.value === card.value) {
      
      // Find where this card is placed and remove it
      Object.entries(positions).forEach(([key, posCard]) => {
        if (posCard && 
            posCard.suit === card.suit && 
            posCard.value === card.value &&
            posCard.id.startsWith('community-')) {
          // Remove the card from this position
          setPositions(prev => ({
            ...prev,
            [key]: null
          }));
        }
      });
      
      setSelectedCommunityCard(null);
      return;
    }
    
    // Find the next available slot
    const nextSlot = findNextEmptySlot();
    if (!nextSlot) {
      alert('No available slots! Remove some cards first.');
      return;
    }
    
    // If another card is already selected and placed, remove it first
    if (selectedCommunityCard && selectedCommunityCard.suit !== 'joker') {
      // Find where the previous community card is placed and remove it
      Object.entries(positions).forEach(([key, posCard]) => {
        if (posCard && 
            posCard.suit === selectedCommunityCard.suit && 
            posCard.value === selectedCommunityCard.value &&
            posCard.id.startsWith('community-')) {
          // Remove the card from this position
          setPositions(prev => ({
            ...prev,
            [key]: null
          }));
        }
      });
    }
    
    // Auto-place the card in the next available slot
    const slotKey = `${nextSlot.row}-${nextSlot.slot}`;
    
    // Create a positioned version of the community card
    const positionedCard: PositionedCard = {
      ...card,
      id: `community-${card.suit}-${card.value}`,
      isPlaced: true,
      position: nextSlot
    };
    
    // Place the card in the slot
    setPositions(prev => ({
      ...prev,
      [slotKey]: positionedCard
    }));
    
    // Select the card as our community card choice
    setSelectedCommunityCard(card);
  };
  
  // Handle clicking on a card
  const handleCardClick = (card: PositionedCard) => {
    if (confirmed) return;
    
    // Find the next available slot
    const nextSlot = findNextEmptySlot();
    if (!nextSlot) return;
    
    // Update the card's position
    const updatedCards = boardCards.map(c => 
      c.id === card.id 
        ? { ...c, isPlaced: true, position: nextSlot } 
        : c
    );
    
    setBoardCards(updatedCards);
    
    // Update the positions map
    const slotKey = `${nextSlot.row}-${nextSlot.slot}`;
    setPositions(prev => ({
      ...prev,
      [slotKey]: updatedCards.find(c => c.id === card.id) || null
    }));
  };
  
  // Handle clicking on a slot to remove a card
  const handleSlotClick = (row: number, slot: number) => {
    if (confirmed) return;
    
    const slotKey = `${row}-${slot}`;
    const cardInSlot = positions[slotKey];
    
    if (!cardInSlot) return;
    
    // Remove the card from the slot
    setPositions(prev => ({
      ...prev,
      [slotKey]: null
    }));
    
    // Update the card's status
    setBoardCards(prev => 
      prev.map(c => 
        c.id === cardInSlot.id 
          ? { ...c, isPlaced: false, position: undefined } 
          : c
      )
    );
  };
  
  // Find the next empty slot in order (first row first, then second, etc.)
  const findNextEmptySlot = () => {
    // First row
    for (let slot = 0; slot < 3; slot++) {
      if (!positions[`0-${slot}`]) {
        return { row: 0, slot };
      }
    }
    
    // Second row
    for (let slot = 0; slot < 5; slot++) {
      if (!positions[`1-${slot}`]) {
        return { row: 1, slot };
      }
    }
    
    // Third row
    for (let slot = 0; slot < 5; slot++) {
      if (!positions[`2-${slot}`]) {
        return { row: 2, slot };
      }
    }
    
    return null;
  };
  
  // Reset the game board
  const handleReset = () => {
    if (confirmed) {
      setConfirmed(false);
    }
    
    setPositions({
      '0-0': null, '0-1': null, '0-2': null,
      '1-0': null, '1-1': null, '1-2': null, '1-3': null, '1-4': null,
      '2-0': null, '2-1': null, '2-2': null, '2-3': null, '2-4': null,
    });
    
    setBoardCards(prev => 
      prev.map(c => ({ ...c, isPlaced: false, position: undefined }))
    );
  };
  
  // Handle ready button click
  const handleReady = () => {
    if (!isGameComplete) {
      alert('Please place all 13 cards before submitting!');
      return;
    }
    
    setConfirmed(true);
    
    // Send the card positions to the server
    if (currentRoom) {
      // Extract cards by row
      const row0Cards = [
        positions['0-0'], positions['0-1'], positions['0-2']
      ].filter(Boolean).map(card => ({
        suit: card!.suit,
        value: card!.value
      }));
      
      const row1Cards = [
        positions['1-0'], positions['1-1'], positions['1-2'], positions['1-3'], positions['1-4']
      ].filter(Boolean).map(card => ({
        suit: card!.suit,
        value: card!.value
      }));
      
      const row2Cards = [
        positions['2-0'], positions['2-1'], positions['2-2'], positions['2-3'], positions['2-4']
      ].filter(Boolean).map(card => ({
        suit: card!.suit,
        value: card!.value
      }));
      
      // Use confirmCards from the context, now with the selected community card
      confirmCards(currentRoom, {
        row0: row0Cards,
        row1: row1Cards,
        row2: row2Cards
      }, selectedCommunityCard);
    }
  };
  
  // Handle ready for next game
  const handleReadyForNextGame = () => {
    if (currentRoom) {
      readyForNextGame(currentRoom);
    }
  };
  
  // Sort cards based on selected method
  const sortedCards = React.useMemo(() => {
    return boardCards.sort((a, b) => {
      const suitOrder = { spades: 0, hearts: 1, clubs: 2, diamonds: 3, joker: 4 };
      const valueOrder: { [key: string]: number } = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9,
        '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
        'Joker': 15 // Joker has highest value
      };
      
      if (sortMethod === 'suit') {
        // Sort by suit first, then by value
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
          return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return valueOrder[a.value] - valueOrder[b.value];
      } else {
        // Sort by value first, then by suit
        if (valueOrder[a.value] !== valueOrder[b.value]) {
          return valueOrder[a.value] - valueOrder[b.value];
        }
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
    });
  }, [boardCards, sortMethod]);

  // Display card summary when available
  useEffect(() => {
    if (cardsSummary && cardsSummary.length > 0) {
      console.log('Displaying card summary:', cardsSummary);
    }
  }, [cardsSummary]);

  // Handle card drag start
  const handleDragStart = (card: PositionedCard, e: React.DragEvent) => {
    if (confirmed) return;
    setDraggedCard(card);
    
    // Set drag image (optional)
    if (e.dataTransfer.setDragImage) {
      const el = document.getElementById(card.id);
      if (el) {
        e.dataTransfer.setDragImage(el, 30, 40);
      }
    }
  };
  
  // Handle drag over slot
  const handleDragOver = (e: React.DragEvent, row: number, slot: number) => {
    e.preventDefault(); // Necessary to allow drop
    e.dataTransfer.dropEffect = 'move';
  };
  
  // Handle drop on slot
  const handleDrop = (e: React.DragEvent, row: number, slot: number) => {
    e.preventDefault();
    if (!draggedCard || confirmed) return;
    
    const slotKey = `${row}-${slot}`;
    
    // If slot is already occupied, return
    if (positions[slotKey]) return;
    
    // For community cards
    if (draggedCard.id.startsWith('community-')) {
      // Don't allow jokers from community to be placed on the board
      if (draggedCard.suit === 'joker') return;
      
      // If it's a different community card than previously selected
      if (selectedCommunityCard && 
          (selectedCommunityCard.suit !== draggedCard.suit || 
           selectedCommunityCard.value !== draggedCard.value)) {
        // Remove any previously placed community card
        Object.entries(positions).forEach(([key, posCard]) => {
          if (posCard && posCard.id.startsWith('community-')) {
            setPositions(prev => ({
              ...prev,
              [key]: null
            }));
          }
        });
      }
      
      // Create positioned version of community card
      const positionedCard: PositionedCard = {
        ...draggedCard,
        isPlaced: true,
        position: { row, slot }
      };
      
      // Place card in slot
      setPositions(prev => ({
        ...prev,
        [slotKey]: positionedCard
      }));
      
      // Set as selected community card
      setSelectedCommunityCard({
        suit: draggedCard.suit,
        value: draggedCard.value
      });
    } 
    // For player's hand cards
    else {
      // Update the card's position
      const updatedCards = boardCards.map(c => 
        c.id === draggedCard.id 
          ? { ...c, isPlaced: true, position: { row, slot } } 
          : c
      );
      
      setBoardCards(updatedCards);
      
      // Update the positions map
      setPositions(prev => ({
        ...prev,
        [slotKey]: updatedCards.find(c => c.id === draggedCard.id) || null
      }));
    }
    
    setDraggedCard(null);
  };

  // Handle drag end (cleanup)
  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto relative pt-8">
      {/* Display card summary when available */}
      {cardsSummary && cardsSummary.length > 0 && (
        <CardSummary summary={cardsSummary} onReady={handleReadyForNextGame} />
      )}

      {/* Ready and Reset buttons */}
      <div className="absolute top-0 right-0 left-0 flex space-x-1 items-center justify-end p-1 bg-green-200 rounded-t-lg z-10">
        {/* Points counter */}
        <div className={`px-2 py-0.5 text-xs ${(points[currentRoom || ''] || 0) < 0 ? 'bg-red-500' : 'bg-yellow-500'} text-white rounded-md font-medium`}>
          {points[currentRoom || ''] || 0} Pts
        </div>
        
        <button 
          onClick={handleReady}
          className={`px-2 py-1 rounded-md transition-colors text-xs min-w-[90px] text-center ${
            confirmed 
              ? "bg-green-600 text-white cursor-default" 
              : isGameComplete
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
          }`}
          disabled={!isGameComplete || confirmed}
        >
          {confirmed ? "Confirmed" : "Wait for Confirm"}
        </button>
        <button 
          onClick={handleReset}
          className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs min-w-[50px]"
        >
          Reset
        </button>
      </div>

      {/* Game board with three rows */}
      <div className="mb-6 bg-green-200 rounded-xl p-4 shadow-lg">
        <div className="space-y-3">
          {/* First row - 3 slots */}
          <div className="flex justify-start gap-2 ml-[50px]">
            {[...Array(3)].map((_, i) => (
              <div
                key={`row1-${i}`}
                onDragOver={(e) => handleDragOver(e, 0, i)}
                onDrop={(e) => handleDrop(e, 0, i)}
                className={`w-[45px] h-[63px] rounded-lg shadow-md ${!positions[`0-${i}`] ? 'bg-white opacity-70 border-2 border-dashed border-gray-400' : ''}`}
              >
                {positions[`0-${i}`] ? (
                  <div onClick={() => handleSlotClick(0, i)}>
                    <CardComponent card={positions[`0-${i}`]!} isSmall={false} />
                  </div>
                ) : (
                  <div className="w-full h-full"></div>
                )}
              </div>
            ))}
          </div>
          
          {/* Second row - 5 slots */}
          <div className="flex justify-start gap-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={`row2-${i}`}
                onDragOver={(e) => handleDragOver(e, 1, i)}
                onDrop={(e) => handleDrop(e, 1, i)}
                className={`w-[45px] h-[63px] rounded-lg shadow-md ${!positions[`1-${i}`] ? 'bg-white opacity-70 border-2 border-dashed border-gray-400' : ''}`}
              >
                {positions[`1-${i}`] ? (
                  <div onClick={() => handleSlotClick(1, i)}>
                    <CardComponent card={positions[`1-${i}`]!} isSmall={false} />
                  </div>
                ) : (
                  <div className="w-full h-full"></div>
                )}
              </div>
            ))}
          </div>
          
          {/* Third row - 5 slots */}
          <div className="flex justify-start gap-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={`row3-${i}`}
                onDragOver={(e) => handleDragOver(e, 2, i)}
                onDrop={(e) => handleDrop(e, 2, i)}
                className={`w-[45px] h-[63px] rounded-lg shadow-md ${!positions[`2-${i}`] ? 'bg-white opacity-70 border-2 border-dashed border-gray-400' : ''}`}
              >
                {positions[`2-${i}`] ? (
                  <div onClick={() => handleSlotClick(2, i)}>
                    <CardComponent card={positions[`2-${i}`]!} isSmall={false} />
                  </div>
                ) : (
                  <div className="w-full h-full"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Community cards section */}
      <div className="mb-4 bg-blue-100 rounded-xl p-3 shadow-lg">
        <h3 className="text-sm font-medium mb-2 text-gray-700">Community Cards (Select at most one):</h3>
        <div className="flex justify-center gap-2">
          {communityCards.map((card, index) => (
            <div 
              key={`community-${index}`}
              id={`community-${card.suit}-${card.value}-${index}`}
              onClick={() => card.suit !== 'joker' ? handleCommunityCardClick(card) : null}
              draggable={card.suit !== 'joker'}
              onDragStart={(e) => handleDragStart({
                ...card,
                id: `community-${card.suit}-${card.value}-${index}`,
                isPlaced: false
              }, e)}
              onDragEnd={handleDragEnd}
              className={`w-[45px] h-[63px] rounded-lg shadow-md ${card.suit === 'joker' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transform transition-all duration-200 
                ${selectedCommunityCard && selectedCommunityCard.suit === card.suit && selectedCommunityCard.value === card.value 
                  ? 'border-2 border-blue-500 scale-110' 
                  : card.suit !== 'joker' ? 'hover:scale-105' : ''}`}
            >
              <CardComponent
                card={{
                  ...card,
                  id: `community-${card.suit}-${card.value}-${index}`,
                  isPlaced: false
                }}
              />
            </div>
          ))}
        </div>
        {selectedCommunityCard && (
          <p className="text-center mt-1 text-xs text-gray-600">
            Selected: <span className={selectedCommunityCard.suit === 'hearts' || selectedCommunityCard.suit === 'diamonds' ? 'text-red-500' : selectedCommunityCard.suit === 'joker' ? 'text-purple-600' : 'text-gray-900'}>
              {selectedCommunityCard.value} of {selectedCommunityCard.suit === 'joker' ? 'Jokers' : selectedCommunityCard.suit}
            </span>
          </p>
        )}
      </div>

      {/* Sorting controls */}
      <div className="fixed bottom-[72px] left-0 right-0 flex justify-center p-1 bg-green-800 z-10">
        <div className="flex space-x-2 items-center">
          <span className="text-white text-xs">Sort:</span>
          <button 
            onClick={() => setSortMethod('suit')} 
            className={`px-2 py-0.5 rounded-md text-xs ${sortMethod === 'suit' ? 'bg-blue-500 text-white' : 'bg-green-600 text-white'}`}
          >
            Suit
          </button>
          <button 
            onClick={() => setSortMethod('value')} 
            className={`px-2 py-0.5 rounded-md text-xs ${sortMethod === 'value' ? 'bg-blue-500 text-white' : 'bg-green-600 text-white'}`}
          >
            Value
          </button>
        </div>
      </div>

      {/* Player's cards at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-green-700 p-2">
        <div className="flex flex-wrap justify-center gap-1 max-w-full mx-auto overflow-x-auto">
          {sortedCards.map((card) => (
            <div 
              key={card.id}
              id={card.id}
              draggable={!card.isPlaced && !confirmed}
              onDragStart={(e) => handleDragStart(card, e)}
              onDragEnd={handleDragEnd}
              className={card.isPlaced ? 'opacity-50' : ''}
            >
              <CardComponent 
                card={card}
                onClick={() => handleCardClick(card)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomStatus({ status }: { status: string }) {
  const colors = {
    empty: 'text-gray-500',
    waiting: 'text-blue-500',
    ready: 'text-green-500',
    playing: 'text-purple-500',
  };

  return (
    <span className={colors[status as keyof typeof colors]}>
      {status.toUpperCase()}
    </span>
  );
}

export default function Home() {
  const { socket, rooms, currentRoom, cards, error, toggleReady, points } = useSocket();
  const [showMockGame, setShowMockGame] = useState(false);
  
  // Calculate room stats
  const roomStats = React.useMemo(() => {
    const totalRooms = Object.keys(rooms).length;
    const occupiedRooms = Object.values(rooms).filter(room => room.player !== null).length;
    const readyRooms = Object.values(rooms).filter(room => room.status === 'ready').length;
    return { totalRooms, occupiedRooms, readyRooms };
  }, [rooms]);

  useEffect(() => {
    console.log('Rooms state updated:', {
      rooms,
      currentRoom,
      hasSocket: !!socket,
      points
    });
  }, [rooms, currentRoom, socket, points]);

  const handleJoinRoom = (roomId: string) => {
    if (socket) {
      console.log('Attempting to join room:', roomId);
      socket.emit('joinRoom', roomId);
    }
  };

  const handleToggleReady = (roomId: string) => {
    console.log('Toggling ready for room:', roomId);
    toggleReady(roomId);
  };

  // Mock cards for demonstration
  const mockCards: Card[] = [
    { suit: 'spades', value: '3' },
    { suit: 'spades', value: '8' },
    { suit: 'spades', value: 'K' },
    { suit: 'spades', value: 'A' },
    { suit: 'hearts', value: '7' },
    { suit: 'hearts', value: '10' },
    { suit: 'hearts', value: 'J' },
    { suit: 'clubs', value: '10' },
    { suit: 'clubs', value: 'J' },
    { suit: 'diamonds', value: '4' },
    { suit: 'diamonds', value: '6' },
    { suit: 'diamonds', value: 'K' },
    { suit: 'diamonds', value: 'A' },
  ];

  const displayCards = currentRoom && cards.length > 0 ? cards : mockCards;

  return (
    <>
      <Head>
        <title>Card Game</title>
        <meta name="description" content="Play the card game!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-green-100 p-8">
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="bg-red-500 text-white p-4 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          {(currentRoom && cards.length > 0) ? (
            <GameBoard cards={displayCards} />
          ) : (
            <>
              {/* Game status banner */}
              <div className="bg-blue-600 text-white p-4 rounded-lg mb-6 text-center">
                <h1 className="text-xl font-bold mb-2">Game Lobby</h1>
                <p>
                  {roomStats.occupiedRooms} of {roomStats.totalRooms} rooms occupied. 
                  {roomStats.readyRooms > 0 ? (
                    <span className="font-bold"> {roomStats.readyRooms} player(s) ready.</span>
                  ) : ''}
                </p>
                {roomStats.occupiedRooms >= 2 && roomStats.readyRooms === 0 && (
                  <p className="mt-2 text-yellow-200">
                    Game will start when at least one player clicks "Ready"
                  </p>
                )}
                {roomStats.readyRooms > 0 && (
                  <p className="mt-2 text-green-200 font-bold">
                    Game will start soon!
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Room selection */}
                {Object.entries(rooms).map(([roomId, room]) => (
                  <div
                    key={roomId}
                    className="bg-gray-800 rounded-lg p-6 shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-semibold text-white">
                          {roomId.replace('-', ' ').toUpperCase()}
                        </h2>
                        {room.player && (
                          <div className={`${(points[roomId] || 0) < 0 ? 'bg-red-500' : 'bg-yellow-500'} text-white px-2 py-1 rounded-md text-sm font-medium`}>
                            {points[roomId] || 0} Points
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-gray-300">
                        <span>Status:</span>
                        <RoomStatus status={room.status} />
                      </div>
                      <div className="text-gray-300">
                        Player: {room.player ? 'Present' : 'None'}
                      </div>
                      {currentRoom === roomId && room.status === 'waiting' && (
                        <button
                          onClick={() => handleToggleReady(roomId)}
                          className="w-full py-2 px-4 rounded-md font-medium bg-yellow-500 hover:bg-yellow-600 text-white transition-colors duration-300"
                        >
                          Click to Ready
                        </button>
                      )}
                      {currentRoom === roomId && room.status === 'ready' && (
                        <button
                          onClick={() => handleToggleReady(roomId)}
                          className="w-full py-2 px-4 rounded-md font-medium bg-green-500 text-white"
                        >
                          Ready!
                        </button>
                      )}
                      {currentRoom !== roomId && room.status !== 'playing' && !room.player && (
                        <button
                          onClick={() => handleJoinRoom(roomId)}
                          className="w-full py-2 px-4 rounded-md font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-300"
                        >
                          Join Room
                        </button>
                      )}
                      {currentRoom !== roomId && room.player && (
                        <button
                          disabled
                          className="w-full py-2 px-4 rounded-md font-medium bg-gray-600 text-gray-400 cursor-not-allowed"
                        >
                          Room Occupied
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
} 