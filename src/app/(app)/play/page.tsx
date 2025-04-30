// play/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Piece, Square } from 'react-chessboard/dist/chessboard/types';
import { Chess } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Info, Settings } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Dynamically import stockfish.js to ensure it runs client-side
const stockfishPath = '/stockfish.js/stockfish.js'; // Path to the worker script

const AI_DEPTH = 10; // Define AI thinking depth

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [difficulty, setDifficulty] = useState(5); // Stockfish difficulty level (0-20) - Note: Depth overrides this for 'go depth' command
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState<{ reason: string; winner: string | null } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingProgress, setThinkingProgress] = useState(0); // Progress from 0 to 100
  const stockfishWorker = useRef<Worker | null>(null);
  const { toast } = useToast();
  const moveRequestPending = useRef(false); // Flag to prevent duplicate move requests

   // Initialize Stockfish via Web Worker
   useEffect(() => {
     if (typeof Worker !== 'undefined') {
       console.log("Attempting to initialize Stockfish worker...");
       // Check if worker already exists to avoid multiple initializations on HMR
       if (stockfishWorker.current) {
            stockfishWorker.current.terminate();
            console.log("Terminated existing Stockfish worker.");
       }

       try {
           stockfishWorker.current = new Worker(stockfishPath);
           console.log("Stockfish worker instance created.");

           stockfishWorker.current.onmessage = (event) => {
             const message = event.data;
             console.log(`[Stockfish Worker] Received: ${message}`); // Log all messages

             if (message?.startsWith('uciok')) {
                console.log("Stockfish UCI OK received.");
                // Proceed with configuration only after uciok
                stockfishWorker.current?.postMessage('isready');
                // Send Skill Level anyway, although 'go depth' might override it
                stockfishWorker.current?.postMessage(`setoption name Skill Level value ${difficulty}`);
             } else if (message === 'readyok') {
                 console.log("Stockfish Ready OK received.");
                 // Now the engine is truly ready for position/go commands
                 // If AI needs to move immediately (e.g., player chose black), trigger it here or rely on useEffect
             } else if (message?.startsWith('bestmove')) {
               const bestMove = message.split(' ')[1];
               if (bestMove && bestMove !== '(none)') { // Handle case where no move is returned
                   moveRequestPending.current = false; // Reset flag after receiving move
                   handleAiMove(bestMove);
               } else {
                   console.error("Stockfish returned no valid best move.");
                   toast({ title: "AI Error", description: "AI could not determine a move.", variant: "destructive" });
                   setIsThinking(false);
                   moveRequestPending.current = false;
               }
             } else if (message?.includes("info depth")) {
                 const depthMatch = message.match(/depth (\d+)/);
                 if (depthMatch) {
                     const currentDepth = parseInt(depthMatch[1], 10);
                     // Update progress based on the defined AI_DEPTH
                     const progress = Math.min(100, (currentDepth / AI_DEPTH) * 100);
                     setThinkingProgress(progress);
                 }
             }
             // Add handling for other potential Stockfish messages if needed
           };

           stockfishWorker.current.onerror = (error) => {
              console.error('[Stockfish Worker] Error:', error.message, error);
              toast({ title: "Stockfish Error", description: `Worker error: ${error.message}`, variant: "destructive" });
              setIsThinking(false); // Ensure thinking stops on error
              moveRequestPending.current = false;
           };

           // Initiate communication
           console.log("[Stockfish Worker] Sending: uci");
           stockfishWorker.current.postMessage('uci');

       } catch (e) {
           console.error("Failed to create Stockfish worker:", e);
           toast({ title: "Worker Error", description: "Could not create AI engine worker.", variant: "destructive" });
       }


     } else {
       console.error("Web Workers are not supported in this browser.");
       toast({ title: "Browser Incompatible", description: "Web Workers are needed for the AI engine.", variant: "destructive" });
     }

     // Cleanup worker on unmount
     return () => {
        if (stockfishWorker.current) {
            console.log("Terminating Stockfish worker on component unmount...");
            stockfishWorker.current.terminate();
            stockfishWorker.current = null;
            moveRequestPending.current = false;
        }
     };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [difficulty, toast]); // Re-initialize only if difficulty changes (Skill Level setting)


  // Function to make AI move
  const findAiMove = useCallback(() => {
     if (!stockfishWorker.current || gameOver || game.turn() === playerColor || isThinking || moveRequestPending.current) {
        console.log("AI move request skipped:", { gameOver, turn: game.turn(), playerColor, isThinking, moveRequestPending: moveRequestPending.current });
        return;
     }

     console.log(`[AI Turn] Requesting move for FEN: ${game.fen()} with depth ${AI_DEPTH}`);
     setIsThinking(true);
     moveRequestPending.current = true; // Set flag
     setThinkingProgress(0); // Reset progress
     try {
         console.log(`[Stockfish Worker] Sending: position fen ${game.fen()}`);
         stockfishWorker.current.postMessage(`position fen ${game.fen()}`);
         console.log(`[Stockfish Worker] Sending: go depth ${AI_DEPTH}`);
         // Use the defined AI_DEPTH constant
         stockfishWorker.current.postMessage(`go depth ${AI_DEPTH}`);
     } catch (error) {
         console.error("Error sending message to Stockfish worker:", error);
         toast({ title: "AI Communication Error", description: "Failed to send command to AI.", variant: "destructive" });
         setIsThinking(false);
         moveRequestPending.current = false; // Reset flag on error
     }
  }, [game, gameOver, playerColor, isThinking]); // Removed stockfishWorker.current from deps as it's a ref


  // Handle AI move received from Stockfish
  const handleAiMove = (moveNotation: string) => {
    console.log(`[AI Move] Received UCI move: ${moveNotation}`);
    const gameCopy = new Chess(game.fen()); // Use current FEN stored in state
    let moveResult = null;
    try {
        moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Use sloppy for UCI format
    } catch (error) {
         console.error(`[AI Move] Error applying move ${moveNotation} to FEN ${game.fen()}:`, error);
         toast({ title: "AI Error", description: `Error applying AI move: ${moveNotation}`, variant: "destructive" });
         setIsThinking(false); // Stop thinking indicator on error
         moveRequestPending.current = false; // Reset flag
         return; // Stop execution here
    }


    if (moveResult) {
      console.log(`[AI Move] Applied successfully. New FEN: ${gameCopy.fen()}`);
      setGame(gameCopy); // Update the game state object
      setFen(gameCopy.fen()); // Update the FEN state string
      setIsThinking(false); // AI finished thinking
      setThinkingProgress(100); // Show complete progress
      checkGameState(gameCopy); // Check if the AI's move ended the game
    } else {
      console.error(`[AI Move] Invalid AI move notation: ${moveNotation} for FEN: ${game.fen()}. Game state not changed.`);
      toast({ title: "AI Error", description: `Received invalid move notation: ${moveNotation}`, variant: "destructive" });
      setIsThinking(false); // Stop thinking indicator on error
      moveRequestPending.current = false; // Reset flag
    }
  };

   // Check game state after each move
   const checkGameState = (currentGame: Chess) => {
     let currentGameOver = null;
     if (currentGame.isCheckmate()) {
       currentGameOver = { reason: 'Checkmate', winner: currentGame.turn() === 'w' ? 'Black' : 'White' };
       toast({ title: "Game Over!", description: `Checkmate! ${currentGameOver.winner} wins.` });
     } else if (currentGame.isStalemate()) {
       currentGameOver = { reason: 'Stalemate', winner: 'Draw' };
       toast({ title: "Game Over!", description: "Stalemate! It's a draw." });
     } else if (currentGame.isThreefoldRepetition()) {
       currentGameOver = { reason: 'Threefold Repetition', winner: 'Draw' };
       toast({ title: "Game Over!", description: "Draw by Threefold Repetition." });
     } else if (currentGame.isInsufficientMaterial()) {
       currentGameOver = { reason: 'Insufficient Material', winner: 'Draw' };
       toast({ title: "Game Over!", description: "Draw by Insufficient Material." });
     } else if (currentGame.isDraw()) {
       currentGameOver = { reason: 'Draw', winner: 'Draw' }; // Covers 50-move rule
       toast({ title: "Game Over!", description: "The game is a draw." });
     }

     if (currentGameOver) {
         console.log(`[Game State] Game over: ${currentGameOver.reason}, Winner: ${currentGameOver.winner}`);
         setGameOver(currentGameOver);
     } else {
         // console.log("[Game State] Game continues."); // Can be noisy, uncomment if needed
         setGameOver(null); // Explicitly set to null if game is not over
     }
   };

    // Trigger AI move when it's AI's turn
   useEffect(() => {
     console.log("[Turn Check] Evaluating AI move trigger:", { turn: game.turn(), playerColor, gameOver, isThinking });
     if (!gameOver && game.turn() !== playerColor && !isThinking && !moveRequestPending.current) {
       console.log("[Turn Check] Conditions met, scheduling AI move...");
       // Add a small delay for better UX and to allow state updates to settle
       const timer = setTimeout(() => {
         console.log("[Turn Check] Timer fired, calling findAiMove.");
         findAiMove();
       }, 500); // 500ms delay
       return () => {
            // console.log("[Turn Check] Clearing AI move timer."); // Can be noisy
            clearTimeout(timer);
       }
     } else {
        console.log("[Turn Check] Conditions not met for AI move.");
     }
     // Use fen as the primary trigger, but include other relevant states
   }, [fen, game, playerColor, gameOver, isThinking, findAiMove]);


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
    console.log(`[Player Move] Attempt: ${sourceSquare}-${targetSquare} (${piece})`);
    if (gameOver || isThinking || game.turn() !== playerColor) {
        console.log("[Player Move] Blocked:", { gameOver, isThinking, turn: game.turn(), playerColor });
        return false;
    }

    const gameCopy = new Chess(game.fen());
    let moveResult = null;
    try {
      moveResult = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Always promote to queen for simplicity for now
      });

      if (moveResult === null) {
          console.log(`[Player Move] Illegal move: ${sourceSquare}-${targetSquare}`);
          toast({ title: "Invalid Move", description: "That move is not allowed.", variant: "default" });
          return false; // Explicitly return false for illegal moves
      }

      console.log(`[Player Move] Successful: ${moveResult.san}. New FEN: ${gameCopy.fen()}`);
      setGame(gameCopy); // Update game state object
      setFen(gameCopy.fen()); // Update FEN string state -> THIS TRIGGERS THE useEffect FOR AI MOVE
      setIsThinking(false); // Ensure thinking indicator is off (might be redundant but safe)
      setThinkingProgress(0); // Reset progress for AI turn
      checkGameState(gameCopy); // Check if player's move ended the game

      return true; // Move was successful
    } catch (error) {
      console.error(`[Player Move] Error processing move ${sourceSquare}-${targetSquare}:`, error);
      toast({ title: "Move Error", description: "An error occurred processing your move.", variant: "destructive" });
      return false; // Indicate failure due to error
    }
  }


   // Reset the game
   const resetGame = (newPlayerColor = playerColor) => {
     console.log(`[Game Reset] Resetting game. Player color: ${newPlayerColor}`);
     const newGame = new Chess();
     setGame(newGame);
     setFen(newGame.fen());
     setGameOver(null);
     setIsThinking(false);
     moveRequestPending.current = false; // Reset pending flag
     setThinkingProgress(0);
     setPlayerColor(newPlayerColor); // Ensure player color is set correctly
     setOrientation(newPlayerColor === 'w' ? 'white' : 'black'); // Update board orientation

     // If AI should move first after reset (player chose black)
     if (newPlayerColor === 'b') {
        console.log("[Game Reset] Player chose Black, scheduling AI's first move.");
        // Use useEffect hook triggered by fen change to handle the first AI move
        // No need for direct timer here, let the standard turn check handle it
     } else {
         console.log("[Game Reset] Player chose White, waiting for player move.");
     }
   };

   // Choose player color (resets game)
   const chooseColor = (color: 'w' | 'b') => {
     console.log(`[Color Choice] Player chose ${color === 'w' ? 'White' : 'Black'}. Resetting game.`);
     resetGame(color); // Pass the new color to resetGame
   };


  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 items-start">
      <div className="w-full lg:w-2/3 xl:w-1/2 mx-auto">
         <Card className="shadow-xl rounded-lg overflow-hidden bg-card border-4 border-primary">
           {/* Removed aspect-ratio */}
           <Chessboard
             position={fen}
             onPieceDrop={onDrop}
             boardOrientation={orientation}
             customBoardStyle={{ borderRadius: '4px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)' }}
             customDarkSquareStyle={{ backgroundColor: 'hsl(var(--primary))' }}
             customLightSquareStyle={{ backgroundColor: 'hsl(var(--background))' }}
           />
         </Card>
           {isThinking && (
              <div className="mt-2 space-y-1">
                <Progress value={thinkingProgress} className="w-full h-2 bg-secondary" />
                <p className="text-xs text-muted-foreground text-center">AI is thinking...</p>
              </div>
           )}
         {gameOver && (
           <Alert variant={gameOver.winner === 'Draw' ? 'default' : 'destructive'} className="mt-4 bg-accent/10 border-accent text-accent-foreground rounded-lg shadow-md">
             <Info className="h-5 w-5 text-accent" />
             <AlertTitle className="font-bold text-lg">Game Over!</AlertTitle>
             <AlertDescription>
               {gameOver.reason}. {gameOver.winner !== 'Draw' ? `${gameOver.winner} wins!` : "It's a draw."}
             </AlertDescription>
               <Button onClick={() => resetGame()} variant="default" size="sm" className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
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
               className={`flex-1 ${playerColor === 'w' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10'}`}
               disabled={isThinking} // Disable while AI thinks
             >
               Play as White
             </Button>
             <Button
               onClick={() => chooseColor('b')}
               variant={playerColor === 'b' ? 'default' : 'outline'}
               className={`flex-1 ${playerColor === 'b' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10'}`}
               disabled={isThinking} // Disable while AI thinks
             >
               Play as Black
             </Button>
           </div>
          {/* Difficulty Slider - uncomment if needed
          <Label htmlFor="difficulty">AI Difficulty ({difficulty})</Label>
          <Slider
            id="difficulty"
            min={0}
            max={20}
            step={1}
            value={[difficulty]}
            onValueChange={(value) => setDifficulty(value[0])}
            disabled={isThinking}
            className="[&>span]:bg-primary [&>span>span]:bg-accent" // Style slider
          /> */}

          <Button onClick={() => resetGame()} variant="destructive" className="w-full" disabled={isThinking}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
          </Button>
           {/* Placeholder for future features */}
           {/* <div className="text-sm text-muted-foreground pt-2 border-t border-border">Move History / Analysis (Coming Soon)</div> */}

        </CardContent>
      </Card>
    </div>
  );
}

    