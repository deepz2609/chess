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

const AI_DEPTH = 5; // Define AI thinking depth

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
       console.log("[Worker Init] Attempting to initialize Stockfish worker...");
       // Check if worker already exists to avoid multiple initializations on HMR
       if (stockfishWorker.current) {
            console.log("[Worker Init] Terminating existing Stockfish worker before re-initialization.");
            stockfishWorker.current.terminate();
            stockfishWorker.current = null;
            moveRequestPending.current = false; // Reset flags
            engineReady.current = false;
       }

       try {
           stockfishWorker.current = new Worker(stockfishPath);
           console.log("[Worker Init] Stockfish worker instance created.");
           engineReady.current = false; // Reset ready state on new worker

           stockfishWorker.current.onmessage = (event) => {
             const message = event.data;
             console.log(`[Worker Msg Recv] Received: ${message}`); // Log all messages

             if (message?.startsWith('uciok')) {
                console.log("[Worker Msg Recv] Stockfish UCI OK received. Sending 'isready'.");
                stockfishWorker.current?.postMessage('isready');
             } else if (message === 'readyok') {
                 console.log("[Worker Msg Recv] Stockfish Ready OK received. Engine is ready.");
                 engineReady.current = true; // Engine is fully ready
                 // Check if AI needs to move immediately (e.g., player chose black on initial load/reset)
                 if (game.turn() !== playerColor && !isThinking && !moveRequestPending.current) {
                    console.log("[Worker Msg Recv] Engine ready, and it's AI's turn. Triggering AI move check via findAiMove.");
                    findAiMove(); // Attempt to move if conditions are right
                 } else {
                    console.log("[Worker Msg Recv] Engine ready, but AI move not triggered:", { turn: game.turn(), playerColor, isThinking, moveRequestPending: moveRequestPending.current });
                 }
             } else if (message?.startsWith('bestmove')) {
               const bestMove = message.split(' ')[1];
               console.log(`[Worker Msg Recv] Received bestmove command: ${message}`);
               // Reset flag *before* processing move to allow new requests if needed immediately
               moveRequestPending.current = false;
               setIsThinking(false); // AI is no longer thinking

               if (bestMove && bestMove !== '(none)') {
                   console.log(`[Worker Msg Recv] Extracted bestMove: ${bestMove}. Calling handleAiMove.`);
                   handleAiMove(bestMove);
               } else {
                   console.error("[AI Error] Stockfish returned no valid bestmove or '(none)'. Resetting state.");
                   toast({ title: "AI Error", description: "AI could not determine a move.", variant: "destructive" });
                   // Don't set isThinking false here, already done above
                   // Do NOT reset moveRequestPending here, it was just reset above
               }
             } else if (message?.includes("info depth")) {
                 const depthMatch = message.match(/depth (\d+)/);
                 if (depthMatch) {
                     const currentDepth = parseInt(depthMatch[1], 10);
                     // Update progress based on the defined AI_DEPTH
                     const progress = Math.min(100, (currentDepth / AI_DEPTH) * 100);
                     // console.log(`[AI Progress] Depth: ${currentDepth}, Progress: ${progress}%`); // Can be noisy
                     setThinkingProgress(progress);
                 }
             } else if (message?.startsWith('error:')) {
                 console.error(`[Worker Msg Recv] Received error from worker: ${message}`);
                 toast({ title: "Stockfish Worker Error", description: message, variant: "destructive" });
                 setIsThinking(false);
                 moveRequestPending.current = false;
                 engineReady.current = false; // Assume engine is not usable after error
             }
             // Add handling for other potential Stockfish messages if needed
           };

           stockfishWorker.current.onerror = (error) => {
              console.error('[Worker Init] Stockfish Worker onerror event:', error.message, error);
              toast({ title: "Stockfish Error", description: `Worker error: ${error.message}`, variant: "destructive" });
              setIsThinking(false); // Ensure thinking stops on error
              moveRequestPending.current = false; // Reset pending flag
              engineReady.current = false; // Engine is no longer ready
           };

           // Initiate communication
           console.log("[Worker Init] Sending: uci");
           stockfishWorker.current.postMessage('uci');

       } catch (e) {
           console.error("[Worker Init] Failed to create Stockfish worker:", e);
           toast({ title: "Worker Error", description: "Could not create AI engine worker.", variant: "destructive" });
       }


     } else {
       console.error("[Worker Init] Web Workers are not supported in this browser.");
       toast({ title: "Browser Incompatible", description: "Web Workers are needed for the AI engine.", variant: "destructive" });
     }

     // Cleanup worker on unmount
     return () => {
        if (stockfishWorker.current) {
            console.log("[Worker Cleanup] Terminating Stockfish worker on component unmount...");
            stockfishWorker.current.terminate();
            stockfishWorker.current = null;
            moveRequestPending.current = false;
            engineReady.current = false;
        } else {
            console.log("[Worker Cleanup] No Stockfish worker to terminate.");
        }
     };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Removed dependencies that might cause unnecessary re-initialization like 'difficulty'


  // Function to make AI move
  const findAiMove = useCallback(() => {
     console.log("[findAiMove] Attempting to trigger AI move. Checking conditions...");
     // Guard conditions: Check worker, game over, turn, thinking state, pending request, and engine readiness
     if (!stockfishWorker.current) {
        console.warn("[findAiMove] AI move skipped: Stockfish worker not available.");
        return;
     }
     if (!engineReady.current) {
        console.warn("[findAiMove] AI move skipped: Engine not ready (engineReady.current is false).");
        return;
     }
      if (gameOver) {
        console.log("[findAiMove] AI move skipped: Game is over.", gameOver);
        return;
     }
     if (game.turn() === playerColor) {
        console.log("[findAiMove] AI move skipped: It's the player's turn.", { turn: game.turn(), playerColor });
        return;
     }
     if (isThinking) {
        console.log("[findAiMove] AI move skipped: AI is already thinking.");
        return;
     }
     if (moveRequestPending.current) {
         console.log("[findAiMove] AI move skipped: A move request is already pending.");
         return;
     }


     const currentFen = game.fen(); // Get current FEN reliably
     console.log(`[findAiMove] Conditions met. Requesting move for FEN: ${currentFen} with depth ${AI_DEPTH}`);
     setIsThinking(true);
     moveRequestPending.current = true; // Set flag: move requested
     setThinkingProgress(0); // Reset progress

     try {
         console.log(`[findAiMove] Sending command to worker: position fen ${currentFen}`);
         stockfishWorker.current.postMessage(`position fen ${currentFen}`);
         // Add a small delay between position and go, sometimes helps Stockfish.js
         setTimeout(() => {
            // Re-check conditions before sending 'go', especially if worker/request changed
            if (moveRequestPending.current && stockfishWorker.current && engineReady.current && isThinking) {
                console.log(`[findAiMove] Sending command to worker: go depth ${AI_DEPTH}`);
                stockfishWorker.current.postMessage(`go depth ${AI_DEPTH}`);
            } else {
                console.log("[findAiMove] Move request cancelled or state changed before sending 'go depth'. Resetting flags.", {
                    moveRequestPending: moveRequestPending.current,
                    worker: !!stockfishWorker.current,
                    engineReady: engineReady.current,
                    isThinking
                });
                // If 'go' wasn't sent, we should reset the state
                setIsThinking(false);
                moveRequestPending.current = false;
            }
         }, 150); // 150ms delay (slightly increased)

     } catch (error) {
         console.error("[findAiMove] Error sending message to Stockfish worker:", error);
         toast({ title: "AI Communication Error", description: "Failed to send command to AI.", variant: "destructive" });
         setIsThinking(false);
         moveRequestPending.current = false; // Reset flag on error
     }
  // Include dependencies relevant to the guards and actions within findAiMove
  }, [game, gameOver, playerColor, isThinking, toast]); // engineReady is a ref, stockfishWorker is a ref - they don't trigger re-renders/re-creation of this callback


  // Handle AI move received from Stockfish
  const handleAiMove = (moveNotation: string) => {
    console.log(`[handleAiMove] Processing UCI move received from worker: ${moveNotation}`);
    // Ensure it's still AI's turn and game isn't over, though checks in findAiMove should prevent this call otherwise.
    // This is a safety check.
    if (gameOver || game.turn() === playerColor) {
        console.warn(`[handleAiMove] Received AI move ${moveNotation}, but game state is invalid. Ignoring.`, { gameOver, turn: game.turn(), playerColor });
        // Reset thinking state just in case it got stuck
        setIsThinking(false);
        // moveRequestPending was already reset when 'bestmove' was received
        return;
    }

    const gameCopy = new Chess(game.fen()); // Create copy from *current* game state FEN
    console.log(`[handleAiMove] Created game copy. Current FEN: ${game.fen()}`);
    let moveResult = null;
    try {
        // Apply the move notation from Stockfish (e.g., 'e2e4')
        console.log(`[handleAiMove] Attempting gameCopy.move(${moveNotation})`);
        moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Use sloppy: true for UCI format compatibility
    } catch (error) {
         console.error(`[handleAiMove] Error applying move ${moveNotation} to FEN ${game.fen()} using chess.js:`, error);
         toast({ title: "AI Error", description: `Error applying AI move '${moveNotation}'. Please reset if issue persists.`, variant: "destructive" });
         // Reset thinking state
         setIsThinking(false);
         // moveRequestPending was already reset when 'bestmove' was received
         return; // Stop execution here
    }

    if (moveResult) {
      console.log(`[handleAiMove] chess.js applied move successfully. SAN: ${moveResult.san}, New FEN: ${gameCopy.fen()}`);
      // Update state in sequence: game object first, then FEN string
      setGame(gameCopy);
      setFen(gameCopy.fen()); // This update will trigger the useEffect for turn check if necessary
      // Thinking state was reset on receiving 'bestmove'
      setThinkingProgress(100); // Show complete progress momentarily
      console.log(`[handleAiMove] Game state updated. Calling checkGameState.`);
      checkGameState(gameCopy); // Check if the AI's move ended the game
    } else {
      // This case should ideally not happen if Stockfish provides a valid UCI move
      // and chess.js handles it, but good to have a fallback.
      console.error(`[handleAiMove] Invalid AI move according to chess.js (moveResult was null): ${moveNotation} for FEN: ${game.fen()}. Game state not changed.`);
      toast({ title: "AI Error", description: `Received invalid move from AI: ${moveNotation}`, variant: "destructive" });
      // Reset thinking state
      setIsThinking(false);
       // moveRequestPending was already reset when 'bestmove' was received
    }
  };

   // Check game state after each move
   const checkGameState = (currentGame: Chess) => {
     console.log(`[checkGameState] Checking game state for FEN: ${currentGame.fen()}`);
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
     } else if (currentGame.isDraw()) { // Includes 50-move rule
       currentGameOver = { reason: 'Draw', winner: 'Draw' };
       toast({ title: "Game Over!", description: "The game is a draw (50-move rule or other draw condition)." });
     }

     if (currentGameOver) {
         console.log(`[checkGameState] Game over detected: ${currentGameOver.reason}, Winner: ${currentGameOver.winner}. Updating state.`);
         setGameOver(currentGameOver);
     } else {
         console.log("[checkGameState] Game continues.");
         // Only set to null if it's currently not null, avoids unnecessary re-renders
         if (gameOver !== null) {
            console.log("[checkGameState] Resetting gameOver state to null.");
            setGameOver(null);
         }
     }
   };

    // Trigger AI move when it's AI's turn - RELIES on FEN change or playerColor change
   useEffect(() => {
     console.log("[Turn Check Effect] Evaluating AI move trigger based on dependencies:", {
       fen, // Current FEN state
       turn: game.turn(), // Whose turn it is according to game object
       playerColor, // Which color the player controls
       gameOver: !!gameOver, // Is the game over?
       isThinking, // Is the AI already thinking?
       engineReady: engineReady.current, // Is the engine ready?
       moveRequestPending: moveRequestPending.current // Is a move request already out?
      });

     // Check all conditions *including* engine readiness
     if (engineReady.current && !gameOver && game.turn() !== playerColor && !isThinking && !moveRequestPending.current) {
       console.log("[Turn Check Effect] Conditions met, scheduling AI move check via findAiMove timer.");
       // Add a small delay for better UX and to allow state updates to settle fully
       const timer = setTimeout(() => {
         console.log("[Turn Check Timer] Timer fired, calling findAiMove.");
         findAiMove(); // This function already contains guards
       }, 300); // 300ms delay
       return () => {
            console.log("[Turn Check Timer] Clearing AI move timer due to dependency change or unmount.");
            clearTimeout(timer);
       }
     } else {
        console.log("[Turn Check Effect] Conditions NOT met for triggering AI move. No timer scheduled.");
     }
   // Key dependencies:
   // - fen: change indicates a move was made, potentially switching turns.
   // - playerColor: if user switches sides, the turn check needs re-evaluation.
   // - gameOver: stops AI from moving if game ended.
   // - isThinking: stops AI if it's already processing.
   // - game: the 'game' object itself is needed for game.turn().
   // - findAiMove: the action triggered by the effect.
   }, [fen, playerColor, gameOver, isThinking, game, findAiMove]);


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
    console.log(`[Player Move Attempt] ${piece} from ${sourceSquare} to ${targetSquare}`);
    // Prevent player move if game over, AI is thinking, or it's not player's turn
    if (gameOver) {
        console.log("[Player Move] Blocked: Game is over.", gameOver);
        toast({ title: "Game Over", description: "The game has ended.", variant: "default" });
        return false;
    }
    if (isThinking) {
        console.log("[Player Move] Blocked: AI is thinking.");
        toast({ title: "Wait", description: "AI is thinking...", variant: "default" });
        return false;
    }
     if (game.turn() !== playerColor) {
        console.log("[Player Move] Blocked: Not your turn.", { turn: game.turn(), playerColor });
        toast({ title: "Wait", description: "Not your turn.", variant: "default" });
        return false; // Move not allowed
    }

    // Create a copy to validate the move without changing the main state yet
    const gameCopy = new Chess(game.fen());
    let moveResult = null;
    try {
      // Attempt the move
      console.log(`[Player Move] Validating move ${sourceSquare}-${targetSquare} with chess.js`);
      moveResult = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        // Automatically promote to queen for simplicity.
        // TODO: Implement promotion selection UI if desired.
        promotion: 'q',
      });

      // If chess.js returns null, the move was illegal
      if (moveResult === null) {
          console.warn(`[Player Move] Illegal move attempted: ${sourceSquare}-${targetSquare}`);
          toast({ title: "Invalid Move", description: "That move is not allowed.", variant: "default" });
          return false; // Indicate the move was illegal
      }

      // Move was legal, proceed to update the actual game state
      console.log(`[Player Move] Move successful (validated by chess.js): ${moveResult.san}. New FEN: ${gameCopy.fen()}`);
      setGame(gameCopy); // Update game state object FIRST
      setFen(gameCopy.fen()); // Update FEN string state -> THIS TRIGGERS THE useEffect FOR AI TURN
      // No need to set isThinking false here, it wasn't true for player move
      setThinkingProgress(0); // Reset progress indicator for the upcoming AI turn
      console.log(`[Player Move] Game state updated. Calling checkGameState.`);
      checkGameState(gameCopy); // Check if the player's move ended the game

      // Trigger AI move check immediately after player move by relying on the useEffect hook
      // triggered by the 'fen' state change.
      console.log(`[Player Move] Move processed. AI turn check will be triggered by FEN update.`);

      return true; // Move was successful

    } catch (error) {
      // Catch potential errors during move validation/execution in chess.js
      console.error(`[Player Move] Error processing move ${sourceSquare}-${targetSquare} in chess.js:`, error);
      toast({ title: "Move Error", description: "An error occurred processing your move.", variant: "destructive" });
      return false; // Indicate failure due to error
    }
  }


   // Reset the game
   const resetGame = (newPlayerColor = playerColor) => {
     console.log(`[Game Reset] Attempting to reset game. Player will be: ${newPlayerColor === 'w' ? 'White' : 'Black'}`);
     // Stop any pending AI thinking process first
     if (stockfishWorker.current && isThinking) {
        console.log("[Game Reset] AI is thinking. Sending 'stop' command to worker.");
        try {
            stockfishWorker.current.postMessage('stop'); // Ask Stockfish to stop
        } catch (error) {
             console.error("[Game Reset] Error sending 'stop' command to worker:", error);
             // Continue with reset anyway
        }
        setIsThinking(false); // Force thinking state off
        moveRequestPending.current = false; // Reset pending flag
     } else {
        console.log("[Game Reset] AI not currently thinking or worker not available.");
     }

     const newGame = new Chess();
     console.log("[Game Reset] Created new Chess() instance.");
     setGame(newGame);
     setFen(newGame.fen()); // Update FEN first
     setGameOver(null);
     setIsThinking(false); // Ensure thinking is off again after potential async stop
     setThinkingProgress(0);
     setPlayerColor(newPlayerColor); // Set the player color
     setOrientation(newPlayerColor === 'w' ? 'white' : 'black'); // Update board orientation based on new color
     console.log("[Game Reset] React state updated (game, fen, gameOver, isThinking, progress, playerColor, orientation).");

     // Ensure engine is ready before potentially triggering AI move
     if (engineReady.current && stockfishWorker.current) {
        console.log("[Game Reset] Engine is ready. Sending 'ucinewgame' and 'isready' to Stockfish.");
         try {
            stockfishWorker.current.postMessage('ucinewgame');
            stockfishWorker.current.postMessage('isready'); // Re-confirm readiness after new game
         } catch(error) {
             console.error("[Game Reset] Error sending 'ucinewgame' or 'isready' to worker:", error);
              // Attempt to recover? Maybe re-initialize worker? For now, just log.
              toast({ title: "AI Error", description: "Failed to reset AI engine state.", variant: "destructive" });
              engineReady.current = false; // Assume engine state is uncertain
         }
        // The useEffect hook triggered by fen/playerColor change will handle AI's first move if needed AFTER 'readyok' is received again.
     } else {
        console.warn("[Game Reset] Stockfish worker not ready or not initialized. AI cannot be configured for new game state.", { engineReady: engineReady.current, worker: !!stockfishWorker.current });
        // Attempt re-initialization if worker exists but not ready?
        if (stockfishWorker.current && !engineReady.current) {
            console.warn("[Game Reset] Attempting to re-send 'uci' to potentially recover worker.");
             try {
                stockfishWorker.current.postMessage('uci');
             } catch (error) {
                  console.error("[Game Reset] Error sending 'uci' during reset recovery attempt:", error);
             }
        }
     }

     // The useEffect [fen, playerColor, ...] will handle triggering the AI if it's Black's turn, once 'readyok' is confirmed.
     console.log("[Game Reset] Game reset process complete. Turn check effect will run based on state changes.");
   };


   // Choose player color (resets game)
   const chooseColor = (color: 'w' | 'b') => {
     console.log(`[Color Choice] Player chose ${color === 'w' ? 'White' : 'Black'}.`);
     // Only reset if the color actually changes to prevent unnecessary resets
     if (color !== playerColor) {
         console.log(`[Color Choice] Color changed from ${playerColor} to ${color}. Resetting game.`);
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
         {/* Debug Info Area - Optional */}
         {/* <Card className="mt-4 p-2 text-xs bg-muted/50">
             <p>FEN: {fen}</p>
             <p>Turn: {game.turn()}</p>
             <p>Player: {playerColor}</p>
             <p>Engine Ready: {engineReady.current.toString()}</p>
             <p>AI Thinking: {isThinking.toString()}</p>
             <p>Move Pending: {moveRequestPending.current.toString()}</p>
             <p>Game Over: {gameOver ? `${gameOver.reason} (${gameOver.winner})` : 'No'}</p>
         </Card> */}
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
               // Disable button if it's already the selected color or if AI is thinking (to prevent reset during AI move)
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
