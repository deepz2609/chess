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

const AI_DEPTH = 5; // Define AI thinking depth (reduced from 10 for faster response)

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  // const [difficulty, setDifficulty] = useState(5); // Stockfish difficulty level (0-20) - Note: Depth overrides this for 'go depth' command
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState<{ reason: string; winner: string | null } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingProgress, setThinkingProgress] = useState(0); // Progress from 0 to 100
  const stockfishWorker = useRef<Worker | null>(null);
  const { toast } = useToast();
  const moveRequestPending = useRef(false); // Flag to prevent duplicate move requests
  const engineReady = useRef(false); // Flag to track if 'readyok' was received

   // Initialize Stockfish via Web Worker
   useEffect(() => {
     if (typeof Worker !== 'undefined') {
       console.log("Attempting to initialize Stockfish worker...");
       // Check if worker already exists to avoid multiple initializations on HMR
       if (stockfishWorker.current) {
            console.log("Terminating existing Stockfish worker before re-initialization.");
            stockfishWorker.current.terminate();
            stockfishWorker.current = null;
            moveRequestPending.current = false; // Reset flags
            engineReady.current = false;
       }

       try {
           stockfishWorker.current = new Worker(stockfishPath);
           console.log("Stockfish worker instance created.");
           engineReady.current = false; // Reset ready state on new worker

           stockfishWorker.current.onmessage = (event) => {
             const message = event.data;
             console.log(`[Stockfish Worker] Received: ${message}`); // Log all messages

             if (message?.startsWith('uciok')) {
                console.log("Stockfish UCI OK received. Sending 'isready'.");
                stockfishWorker.current?.postMessage('isready');
             } else if (message === 'readyok') {
                 console.log("Stockfish Ready OK received. Engine is ready.");
                 engineReady.current = true; // Engine is fully ready
                 // Check if AI needs to move immediately (e.g., player chose black on initial load/reset)
                 if (game.turn() !== playerColor && !isThinking && !moveRequestPending.current) {
                    console.log("Engine ready, and it's AI's turn. Triggering AI move check.");
                    findAiMove();
                 }
             } else if (message?.startsWith('bestmove')) {
               const bestMove = message.split(' ')[1];
               // Reset flag *before* processing move to allow new requests if needed immediately
               moveRequestPending.current = false;
               if (bestMove && bestMove !== '(none)') {
                   console.log(`[AI Move] Received bestmove: ${bestMove}`);
                   handleAiMove(bestMove);
               } else {
                   console.error("[AI Error] Stockfish returned no valid bestmove or '(none)'.");
                   toast({ title: "AI Error", description: "AI could not determine a move.", variant: "destructive" });
                   setIsThinking(false); // Stop thinking indicator
               }
             } else if (message?.includes("info depth")) {
                 const depthMatch = message.match(/depth (\d+)/);
                 if (depthMatch) {
                     const currentDepth = parseInt(depthMatch[1], 10);
                     // Update progress based on the defined AI_DEPTH
                     const progress = Math.min(100, (currentDepth / AI_DEPTH) * 100);
                    //  console.log(`[AI Progress] Depth: ${currentDepth}, Progress: ${progress}%`); // Can be noisy
                     setThinkingProgress(progress);
                 }
             }
             // Add handling for other potential Stockfish messages if needed
           };

           stockfishWorker.current.onerror = (error) => {
              console.error('[Stockfish Worker] Error:', error.message, error);
              toast({ title: "Stockfish Error", description: `Worker error: ${error.message}`, variant: "destructive" });
              setIsThinking(false); // Ensure thinking stops on error
              moveRequestPending.current = false; // Reset pending flag
              engineReady.current = false; // Engine is no longer ready
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
            engineReady.current = false;
        }
     };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Removed dependencies that might cause unnecessary re-initialization like 'difficulty'


  // Function to make AI move
  const findAiMove = useCallback(() => {
     // Guard conditions: Check worker, game over, turn, thinking state, pending request, and engine readiness
     if (!stockfishWorker.current || !engineReady.current || gameOver || game.turn() === playerColor || isThinking || moveRequestPending.current) {
        console.log("AI move request skipped:", {
          worker: !!stockfishWorker.current,
          ready: engineReady.current,
          gameOver: !!gameOver,
          turn: game.turn(),
          playerColor,
          isThinking,
          moveRequestPending: moveRequestPending.current
        });
        return;
     }

     const currentFen = game.fen(); // Get current FEN reliably
     console.log(`[AI Turn] Requesting move for FEN: ${currentFen} with depth ${AI_DEPTH}`);
     setIsThinking(true);
     moveRequestPending.current = true; // Set flag: move requested
     setThinkingProgress(0); // Reset progress

     try {
         console.log(`[Stockfish Worker] Sending: position fen ${currentFen}`);
         stockfishWorker.current.postMessage(`position fen ${currentFen}`);
         // Add a small delay between position and go, sometimes helps Stockfish.js
         setTimeout(() => {
            if (moveRequestPending.current && stockfishWorker.current) { // Check if still pending
                console.log(`[Stockfish Worker] Sending: go depth ${AI_DEPTH}`);
                stockfishWorker.current.postMessage(`go depth ${AI_DEPTH}`);
            } else {
                console.log("[Stockfish Worker] Move request cancelled before sending 'go depth'.");
            }
         }, 100); // 100ms delay

     } catch (error) {
         console.error("Error sending message to Stockfish worker:", error);
         toast({ title: "AI Communication Error", description: "Failed to send command to AI.", variant: "destructive" });
         setIsThinking(false);
         moveRequestPending.current = false; // Reset flag on error
     }
  // Include 'game' in dependencies as its state (FEN, turn) is crucial
  }, [game, gameOver, playerColor, isThinking]);


  // Handle AI move received from Stockfish
  const handleAiMove = (moveNotation: string) => {
    console.log(`[AI Move] Processing UCI move: ${moveNotation}`);
    const gameCopy = new Chess(game.fen()); // Create copy from *current* game state FEN
    let moveResult = null;
    try {
        // Apply the move notation from Stockfish (e.g., 'e2e4')
        moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Use sloppy: true for UCI format compatibility
    } catch (error) {
         console.error(`[AI Move] Error applying move ${moveNotation} to FEN ${game.fen()}:`, error);
         toast({ title: "AI Error", description: `Error applying AI move '${moveNotation}'. Please reset if issue persists.`, variant: "destructive" });
         setIsThinking(false); // Stop thinking indicator on error
         // Do NOT reset moveRequestPending here, it was reset on receiving 'bestmove'
         return; // Stop execution here
    }


    if (moveResult) {
      console.log(`[AI Move] Applied successfully. SAN: ${moveResult.san}, New FEN: ${gameCopy.fen()}`);
      // Update state in sequence: game object first, then FEN string
      setGame(gameCopy);
      setFen(gameCopy.fen()); // This update will trigger the useEffect for turn check if necessary
      setIsThinking(false); // AI finished thinking
      setThinkingProgress(100); // Show complete progress momentarily
      checkGameState(gameCopy); // Check if the AI's move ended the game
    } else {
      // This case should ideally not happen if Stockfish provides a valid UCI move
      // and chess.js handles it, but good to have a fallback.
      console.error(`[AI Move] Invalid AI move according to chess.js: ${moveNotation} for FEN: ${game.fen()}. Game state not changed.`);
      toast({ title: "AI Error", description: `Received invalid move from AI: ${moveNotation}`, variant: "destructive" });
      setIsThinking(false); // Stop thinking indicator on error
      // Do NOT reset moveRequestPending here
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
         // Only set to null if it's currently not null, avoids unnecessary re-renders
         if (gameOver !== null) {
            setGameOver(null);
         }
     }
   };

    // Trigger AI move when it's AI's turn - RELIES on FEN change or playerColor change
   useEffect(() => {
     console.log("[Turn Check Effect] Evaluating AI move trigger:", { fen, turn: game.turn(), playerColor, gameOver: !!gameOver, isThinking, engineReady: engineReady.current, moveRequestPending: moveRequestPending.current });
     // Check all conditions *including* engine readiness
     if (engineReady.current && !gameOver && game.turn() !== playerColor && !isThinking && !moveRequestPending.current) {
       console.log("[Turn Check Effect] Conditions met, scheduling AI move check via findAiMove...");
       // Add a small delay for better UX and to allow state updates to settle fully
       const timer = setTimeout(() => {
         console.log("[Turn Check Timer] Timer fired, calling findAiMove.");
         findAiMove(); // This function already contains guards
       }, 300); // Slightly shorter delay, findAiMove has guards
       return () => {
            console.log("[Turn Check Timer] Clearing AI move timer.");
            clearTimeout(timer);
       }
     } else {
        console.log("[Turn Check Effect] Conditions not met for triggering AI move.");
     }
   // Key dependencies: fen (indicates board change), playerColor (if user switches sides), gameOver status, isThinking status
   // findAiMove is included as it's the action to take
   }, [fen, playerColor, gameOver, isThinking, game, findAiMove]); // game object needed for game.turn()


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
    console.log(`[Player Move] Attempt: ${sourceSquare}-${targetSquare} (${piece})`);
    // Prevent player move if game over, AI is thinking, or it's not player's turn
    if (gameOver || isThinking || game.turn() !== playerColor) {
        console.log("[Player Move] Blocked:", { gameOver: !!gameOver, isThinking, turn: game.turn(), playerColor });
        toast({ title: "Wait", description: isThinking ? "AI is thinking..." : "Not your turn.", variant: "default" });
        return false; // Move not allowed
    }

    // Create a copy to validate the move without changing the main state yet
    const gameCopy = new Chess(game.fen());
    let moveResult = null;
    try {
      // Attempt the move
      moveResult = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        // Automatically promote to queen for simplicity.
        // TODO: Implement promotion selection UI if desired.
        promotion: 'q',
      });

      // If chess.js returns null, the move was illegal
      if (moveResult === null) {
          console.log(`[Player Move] Illegal move: ${sourceSquare}-${targetSquare}`);
          toast({ title: "Invalid Move", description: "That move is not allowed.", variant: "default" });
          return false; // Indicate the move was illegal
      }

      // Move was legal, proceed to update the actual game state
      console.log(`[Player Move] Successful: ${moveResult.san}. New FEN: ${gameCopy.fen()}`);
      setGame(gameCopy); // Update game state object FIRST
      setFen(gameCopy.fen()); // Update FEN string state -> THIS TRIGGERS THE useEffect FOR AI TURN
      // No need to set isThinking false here, it wasn't true for player move
      setThinkingProgress(0); // Reset progress indicator for the upcoming AI turn
      checkGameState(gameCopy); // Check if the player's move ended the game

      // Trigger AI move check immediately after player move by relying on the useEffect hook
      // triggered by the 'fen' state change.

      return true; // Move was successful

    } catch (error) {
      // Catch potential errors during move validation/execution in chess.js
      console.error(`[Player Move] Error processing move ${sourceSquare}-${targetSquare}:`, error);
      toast({ title: "Move Error", description: "An error occurred processing your move.", variant: "destructive" });
      return false; // Indicate failure due to error
    }
  }


   // Reset the game
   const resetGame = (newPlayerColor = playerColor) => {
     console.log(`[Game Reset] Resetting game. Player will be: ${newPlayerColor === 'w' ? 'White' : 'Black'}`);
     // Stop any pending AI thinking process first
     if (stockfishWorker.current && isThinking) {
        console.log("[Game Reset] Stopping current AI thinking...");
        stockfishWorker.current.postMessage('stop'); // Ask Stockfish to stop
        setIsThinking(false);
        moveRequestPending.current = false; // Reset pending flag
     }

     const newGame = new Chess();
     setGame(newGame);
     setFen(newGame.fen()); // Update FEN first
     setGameOver(null);
     setIsThinking(false); // Ensure thinking is off
     setThinkingProgress(0);
     setPlayerColor(newPlayerColor); // Set the player color
     setOrientation(newPlayerColor === 'w' ? 'white' : 'black'); // Update board orientation based on new color

     // Ensure engine is ready before potentially triggering AI move
     if (engineReady.current && stockfishWorker.current) {
        console.log("[Game Reset] Sending 'ucinewgame' and 'isready' to Stockfish.");
        stockfishWorker.current.postMessage('ucinewgame');
        stockfishWorker.current.postMessage('isready'); // Re-confirm readiness after new game
        // The useEffect hook triggered by fen change will handle AI's first move if needed
     } else {
        console.warn("[Game Reset] Stockfish worker not ready or not initialized. AI move might be delayed.");
        // Attempt re-initialization if worker exists but not ready? Maybe too aggressive.
     }

     // The useEffect [fen, playerColor, ...] will handle triggering the AI if it's Black's turn.
     console.log("[Game Reset] Game state updated. Turn check effect will run.");
   };


   // Choose player color (resets game)
   const chooseColor = (color: 'w' | 'b') => {
     console.log(`[Color Choice] Player chose ${color === 'w' ? 'White' : 'Black'}. Resetting game.`);
     // Only reset if the color actually changes to prevent unnecessary resets
     if (color !== playerColor) {
        resetGame(color); // Pass the new color to resetGame
     } else {
        console.log("[Color Choice] Same color selected, no reset needed.");
     }
   };


  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 items-start">
      <div className="w-full lg:w-2/3 xl:w-1/2 mx-auto">
         <Card className="shadow-xl rounded-lg overflow-hidden bg-card border-4 border-primary">
           {/* Removed aspect-ratio for flexibility */}
           <Chessboard
             // Use a key derived from FEN and orientation to force re-render on reset/color change if needed
             key={fen + orientation}
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
                <Progress value={thinkingProgress} className="w-full h-2 bg-secondary [&>div]:bg-accent" />
                <p className="text-xs text-muted-foreground text-center">AI is thinking (depth {AI_DEPTH})...</p>
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
               // Disable button if it's already the selected color or if AI is thinking
               disabled={isThinking || playerColor === 'w'}
             >
               Play as White
             </Button>
             <Button
               onClick={() => chooseColor('b')}
               variant={playerColor === 'b' ? 'default' : 'outline'}
               className={`flex-1 ${playerColor === 'b' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10'}`}
               disabled={isThinking || playerColor === 'b'}
             >
               Play as Black
             </Button>
           </div>
          {/* Difficulty Slider - Kept commented as depth is fixed
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
           <div className="text-sm text-muted-foreground pt-2 border-t border-border">Current AI Depth: {AI_DEPTH}</div>

        </CardContent>
      </Card>
    </div>
  );
}
