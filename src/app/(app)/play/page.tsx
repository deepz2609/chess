"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Piece, Square } from 'react-chessboard/dist/chessboard/types';
import { Chess } from 'chess.js';
import type { StockfishInstance } from 'stockfish.js/dist/stockfish'; // Correct type import
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Info, Settings } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Dynamically import stockfish.js to ensure it runs client-side
const stockfishPath = '/stockfish.js/stockfish.js#stockfish.wasm'; // Adjust path if needed

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [difficulty, setDifficulty] = useState(5); // Stockfish difficulty level (0-20)
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState<{ reason: string; winner: string | null } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingProgress, setThinkingProgress] = useState(0); // Progress from 0 to 100
  const stockfish = useRef<StockfishInstance | null>(null);
  const stockfishWorker = useRef<Worker | null>(null);
  const { toast } = useToast();


   // Initialize Stockfish via Web Worker
   useEffect(() => {
     if (typeof Worker !== 'undefined') {
       console.log("Initializing Stockfish worker...");
       stockfishWorker.current = new Worker(stockfishPath);

       stockfishWorker.current.onmessage = (event) => {
         const message = event.data;
         // console.log(`Stockfish response: ${message}`);

         if (message?.startsWith('bestmove')) {
           const bestMove = message.split(' ')[1];
           handleAiMove(bestMove);
           setIsThinking(false);
           setThinkingProgress(100);
         } else if (message?.includes("info depth")) {
             // Example of parsing depth to show progress (can be refined)
             const depthMatch = message.match(/depth (\d+)/);
             if (depthMatch) {
                 const currentDepth = parseInt(depthMatch[1], 10);
                 // Map depth to progress (e.g., max depth 20)
                 const progress = Math.min(100, (currentDepth / 20) * 100);
                 setThinkingProgress(progress);
             }
         }
       };

       stockfishWorker.current.onerror = (error) => {
          console.error('Stockfish Worker Error:', error);
          toast({ title: "Stockfish Error", description: "Failed to load AI engine.", variant: "destructive" });
       };

       // Initial setup commands
       stockfishWorker.current.postMessage('uci');
       stockfishWorker.current.postMessage('isready');
       stockfishWorker.current.postMessage(`setoption name Skill Level value ${difficulty}`);
       console.log("Stockfish worker initialized and configured.");

     } else {
       console.error("Web Workers are not supported in this browser.");
       toast({ title: "Browser Incompatible", description: "Web Workers are needed for the AI engine.", variant: "destructive" });
     }

     // Cleanup worker on unmount
     return () => {
        console.log("Terminating Stockfish worker...");
        stockfishWorker.current?.terminate();
     };
   }, [difficulty, toast]); // Re-initialize if difficulty changes


  // Function to make AI move
  const findAiMove = useCallback(() => {
     if (!stockfishWorker.current || gameOver || game.turn() === playerColor) {
        console.log("AI move skipped:", { gameOver, turn: game.turn(), playerColor });
        return;
     }

     console.log("Requesting AI move...");
     setIsThinking(true);
     setThinkingProgress(0); // Reset progress
     stockfishWorker.current.postMessage(`position fen ${game.fen()}`);
     stockfishWorker.current.postMessage(`go depth 15`); // Adjust depth for difficulty/performance balance
  }, [game, gameOver, playerColor]);


  // Handle AI move received from Stockfish
  const handleAiMove = (moveNotation: string) => {
    console.log(`AI move received: ${moveNotation}`);
    const gameCopy = new Chess(game.fen()); // Use current FEN
    const moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Use sloppy for UCI format

    if (moveResult) {
      console.log("AI move applied successfully.");
      setGame(gameCopy);
      setFen(gameCopy.fen());
      checkGameState(gameCopy);
    } else {
      console.error(`Invalid AI move: ${moveNotation} for FEN: ${game.fen()}`);
      toast({ title: "AI Error", description: `Received invalid move: ${moveNotation}`, variant: "destructive" });
      setIsThinking(false); // Stop thinking indicator on error
    }
  };

   // Check game state after each move
   const checkGameState = (currentGame: Chess) => {
     if (currentGame.isCheckmate()) {
       setGameOver({ reason: 'Checkmate', winner: currentGame.turn() === 'w' ? 'Black' : 'White' });
       toast({ title: "Game Over!", description: `Checkmate! ${currentGame.turn() === 'w' ? 'Black' : 'White'} wins.` });
     } else if (currentGame.isStalemate()) {
       setGameOver({ reason: 'Stalemate', winner: 'Draw' });
       toast({ title: "Game Over!", description: "Stalemate! It's a draw." });
     } else if (currentGame.isThreefoldRepetition()) {
       setGameOver({ reason: 'Threefold Repetition', winner: 'Draw' });
       toast({ title: "Game Over!", description: "Draw by Threefold Repetition." });
     } else if (currentGame.isInsufficientMaterial()) {
       setGameOver({ reason: 'Insufficient Material', winner: 'Draw' });
       toast({ title: "Game Over!", description: "Draw by Insufficient Material." });
     } else if (currentGame.isDraw()) {
        // Covers 50-move rule and potentially other draw conditions
       setGameOver({ reason: 'Draw', winner: 'Draw' });
       toast({ title: "Game Over!", description: "The game is a draw." });
     } else {
        setGameOver(null); // Game continues
     }
   };

    // Trigger AI move when it's AI's turn
   useEffect(() => {
     if (!gameOver && game.turn() !== playerColor && !isThinking) {
       // Add a small delay for better UX
       const timer = setTimeout(() => {
         findAiMove();
       }, 500); // 500ms delay
       return () => clearTimeout(timer);
     }
   }, [fen, gameOver, game, playerColor, isThinking, findAiMove]); // Dependency on fen ensures it triggers after state update


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
    if (gameOver || isThinking || game.turn() !== playerColor) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Always promote to queen for simplicity for now
      });

      if (move === null) return false; // Illegal move

      setGame(gameCopy);
      setFen(gameCopy.fen());
      checkGameState(gameCopy);
      // AI move will be triggered by useEffect watching fen changes

      return true;
    } catch (error) {
      console.error("Error making move:", error);
      return false; // Invalid move
    }
  }


   // Reset the game
   const resetGame = () => {
     const newGame = new Chess();
     setGame(newGame);
     setFen(newGame.fen());
     setGameOver(null);
     setIsThinking(false);
     setThinkingProgress(0);
     // If player chose black, trigger AI's first move
     if (playerColor === 'b') {
        const timer = setTimeout(() => {
            findAiMove();
          }, 500);
         // No need to clear timer here as reset is a one-off action
     }
   };

   // Choose player color (resets game)
   const chooseColor = (color: 'w' | 'b') => {
     setPlayerColor(color);
     setOrientation(color === 'w' ? 'white' : 'black');
     resetGame(); // Reset game when color changes
   };


  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 items-start">
      <div className="w-full lg:w-2/3 xl:w-1/2 mx-auto">
         <Card className="shadow-xl rounded-lg overflow-hidden bg-card border-4 border-primary">
          {/* Add aspect-ratio to maintain square shape if needed */}
           <Chessboard
             position={fen}
             onPieceDrop={onDrop}
             boardOrientation={orientation}
             customBoardStyle={{ borderRadius: '4px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)' }}
             customDarkSquareStyle={{ backgroundColor: 'hsl(var(--primary))' }} // Deep Green
             customLightSquareStyle={{ backgroundColor: 'hsl(var(--background))' }} // Light Tan
             customPieces={
                // Example: Define custom SVG pieces or use default
                 {}
             }
           />
         </Card>
           {isThinking && (
              <Progress value={thinkingProgress} className="w-full mt-2 h-2 bg-secondary" indicatorClassName="bg-accent"/>
           )}
         {gameOver && (
           <Alert variant="default" className="mt-4 bg-accent/10 border-accent text-accent-foreground rounded-lg shadow-md">
             <Info className="h-5 w-5 text-accent" />
             <AlertTitle className="font-bold text-lg">Game Over!</AlertTitle>
             <AlertDescription>
               {gameOver.reason}. {gameOver.winner !== 'Draw' ? `${gameOver.winner} wins!` : "It's a draw."}
             </AlertDescription>
               <Button onClick={resetGame} variant="default" size="sm" className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
                 Play Again?
               </Button>
           </Alert>
         )}
      </div>

      <Card className="w-full lg:w-1/3 xl:w-1/4 shadow-lg rounded-lg bg-card border border-border">
        <CardHeader>
          <CardTitle className="text-primary flex items-center justify-between">
            Game Controls
            <Settings className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
             <Button
               onClick={() => chooseColor('w')}
               variant={playerColor === 'w' ? 'default' : 'outline'}
               className={`flex-1 ${playerColor === 'w' ? 'bg-primary text-primary-foreground' : 'border-primary text-primary'}`}
             >
               Play as White
             </Button>
             <Button
               onClick={() => chooseColor('b')}
               variant={playerColor === 'b' ? 'default' : 'outline'}
               className={`flex-1 ${playerColor === 'b' ? 'bg-primary text-primary-foreground' : 'border-primary text-primary'}`}

             >
               Play as Black
             </Button>
           </div>
          {/* Difficulty Slider can be added here */}
          {/* <Label htmlFor="difficulty">AI Difficulty ({difficulty})</Label>
          <Slider
            id="difficulty"
            min={0}
            max={20}
            step={1}
            value={[difficulty]}
            onValueChange={(value) => setDifficulty(value[0])}
            disabled={isThinking}
          /> */}

          <Button onClick={resetGame} variant="destructive" className="w-full" disabled={isThinking}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
          </Button>
           {/* Add move history, analysis display etc. here later */}

        </CardContent>
      </Card>
    </div>
  );
}
