
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Piece, Square } from 'react-chessboard/dist/chessboard/types';
import { Chess, Move } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RotateCcw, Info, Settings, BrainCircuit, LoaderCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { findBestChessMove, type FindBestChessMoveInput, type FindBestChessMoveOutput } from '@/ai/flows/find-best-chess-move';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
import { useAuth } from '@/context/auth-context'; // Import useAuth to get user ID


export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState<{ reason: string; winner: string | null } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null); // Track game start time
  const { toast } = useToast();
  const { user } = useAuth(); // Get current user
  const aiMoveRequestPending = useRef(false); // Prevents multiple simultaneous AI requests
  const gameStatsSaved = useRef(false); // Prevent saving stats multiple times for the same game

  // Set initial game start time on mount
  useEffect(() => {
    if (!gameStartTime) {
      setGameStartTime(new Date());
    }
  }, []); // Run only once on mount

   // Extract username part from email (part before @)
   const getUsernameFromEmail = (email: string | null | undefined): string => {
        if (!email) return "Player"; // Fallback name
        return email.split('@')[0];
   };

   // Determine the display name: use Firebase displayName if set, otherwise extract from email
   const getPlayerName = useCallback(() => {
        return user?.displayName || getUsernameFromEmail(user?.email);
   }, [user]);


   // Check game state after each move
   const checkGameState = useCallback((currentGame: Chess) => {
     let currentGameOver = null;
     let resultForStats: 'win' | 'loss' | 'draw' | null = null;
     let winnerPlayer: string | 'AI' | 'Draw' | null = null; // Use string for player name
     let winnerColorDisplay: 'White' | 'Black' | 'Draw' | null = null; // For display message

     const playerName = getPlayerName(); // Get the current player's name

     if (currentGame.isCheckmate()) {
       const playerLost = currentGame.turn() === playerColor;
       winnerPlayer = playerLost ? 'AI' : playerName; // Assign AI or actual player name
       winnerColorDisplay = winnerPlayer === playerName ? (playerColor === 'w' ? 'White' : 'Black') : (playerColor === 'w' ? 'Black' : 'White');
       currentGameOver = { reason: 'Checkmate', winner: winnerColorDisplay };
       resultForStats = winnerPlayer === playerName ? 'win' : 'loss';
       toast({ title: "Game Over!", description: `Checkmate! ${winnerColorDisplay} wins.` });
     } else if (currentGame.isStalemate()) {
       winnerPlayer = 'Draw';
       winnerColorDisplay = 'Draw';
       currentGameOver = { reason: 'Stalemate', winner: winnerColorDisplay };
       resultForStats = 'draw';
       toast({ title: "Game Over!", description: "Stalemate! It's a draw." });
     } else if (currentGame.isThreefoldRepetition()) {
        winnerPlayer = 'Draw';
        winnerColorDisplay = 'Draw';
        currentGameOver = { reason: 'Threefold Repetition', winner: winnerColorDisplay };
        resultForStats = 'draw';
       toast({ title: "Game Over!", description: "Draw by Threefold Repetition." });
     } else if (currentGame.isInsufficientMaterial()) {
        winnerPlayer = 'Draw';
        winnerColorDisplay = 'Draw';
        currentGameOver = { reason: 'Insufficient Material', winner: winnerColorDisplay };
        resultForStats = 'draw';
       toast({ title: "Game Over!", description: "Draw by Insufficient Material." });
     } else if (currentGame.isDraw()) { // Includes 50-move rule
        winnerPlayer = 'Draw';
        winnerColorDisplay = 'Draw';
        currentGameOver = { reason: 'Draw', winner: winnerColorDisplay };
        resultForStats = 'draw';
       toast({ title: "Game Over!", description: "The game is a draw (50-move rule or other condition)." });
     }

     if (currentGameOver) {
         setGameOver(currentGameOver);
         setIsThinking(false); // Stop AI thinking if game ends
         aiMoveRequestPending.current = false; // Clear pending request

         // --- Save Game Stats to Firestore ---
         if (user && !gameStatsSaved.current && resultForStats && gameStartTime) {
            console.log("Attempting to save game stats...");
            gameStatsSaved.current = true; // Set flag immediately to prevent duplicates

            const endTime = new Date();
            const elapsedTimeMs = endTime.getTime() - gameStartTime.getTime(); // Calculate duration in milliseconds

            const gameStatData = {
                userId: user.uid,
                result: resultForStats,
                opponent: 'AI (Gemini)', // Be specific about the AI
                playerColor: playerColor,
                reason: currentGameOver.reason,
                winner: winnerPlayer, // Store actual player name, 'AI', or 'Draw'
                timeElapsedMs: elapsedTimeMs, // Store duration in ms
                timestamp: serverTimestamp(), // Use server timestamp
            };
            addDoc(collection(db, "gameStats"), gameStatData)
              .then(() => {
                 console.log("Game stats saved successfully:", gameStatData);
              })
              .catch((error) => {
                 console.error("Error saving game stats:", error);
                 toast({ title: "Error", description: "Could not save game statistics.", variant: "destructive" });
                 gameStatsSaved.current = false; // Reset flag if saving failed
              });
         }
         // ------------------------------------

     } else {
         // Only reset gameOver if it was previously set
         if (gameOver !== null) {
             setGameOver(null);
         }
     }
   }, [gameOver, toast, user, playerColor, gameStartTime, getPlayerName]); // Added getPlayerName dependency


   // Function to make a random legal move (Fallback)
   const makeFallbackMove = useCallback(() => {
     console.log("[Fallback Move] Attempting fallback move...");
     const gameCopy = new Chess(game.fen());
     const possibleMoves = gameCopy.moves({ verbose: false }); // Get simple UCI strings

     if (possibleMoves.length === 0) {
       console.warn("[Fallback Move] No moves available for fallback.");
       // Need to pass the game instance to checkGameState
       checkGameState(gameCopy); // Double check if game ended
       setIsThinking(false);
       aiMoveRequestPending.current = false;
       return; // Exit if no moves possible
     }

     const randomIdx = Math.floor(Math.random() * possibleMoves.length);
     const move = possibleMoves[randomIdx];

     console.log("[Fallback Move] Making move:", move);
     gameCopy.move(move); // Apply the chosen move to the copy

     setGame(gameCopy); // Update the main game state
     setFen(gameCopy.fen()); // Update the FEN to trigger re-render
     checkGameState(gameCopy); // Check game state after the move
     setIsThinking(false); // AI is no longer thinking
     aiMoveRequestPending.current = false; // Request is no longer pending
   }, [game, checkGameState]); // checkGameState needs to be stable or included


   // Handle AI move (received from Gemini or fallback)
   const handleAiMove = useCallback((moveNotation: string | null) => {
       setIsThinking(false); // Turn off thinking indicator regardless of outcome
       aiMoveRequestPending.current = false; // Clear pending flag

       // If moveNotation is null, it signifies AI failure or invalid suggestion.
       if (moveNotation === null) {
            console.warn("[handleAiMove] Received null move notation. Triggering fallback move.");
            makeFallbackMove(); // Use the dedicated fallback function
            return; // Exit after calling fallback
       }

       if (gameOver || game.turn() === playerColor) {
           console.log("[handleAiMove] Skipping AI move application (game over or player turn).");
           return;
       }

       const gameCopy = new Chess(game.fen());
       let moveResult: Move | null = null;
       try {
           console.log(`[handleAiMove] Attempting to apply AI move: ${moveNotation}`);
           // Use chess.js move validation built-in. It returns null for invalid moves.
           moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Allow UCI, SAN etc.

           if (moveResult) {
               console.log(`[handleAiMove] AI move ${moveNotation} (${moveResult.san}) applied successfully.`);
               setGame(gameCopy);
               setFen(gameCopy.fen()); // Trigger useEffect for turn check & UI update
               checkGameState(gameCopy);
           } else {
               // This case should ideally be caught by the flow's validation, but handle defensively
               console.warn(`[handleAiMove] AI suggested an invalid move according to chess.js: ${moveNotation}. Triggering fallback.`);
               toast({ title: "AI Error", description: "AI suggested an invalid move. Making a different move.", variant: "default" });
               makeFallbackMove(); // Use the dedicated fallback function
           }
       } catch (error) {
            // This catch is for unexpected errors during gameCopy.move(), not just invalid moves.
            console.error(`[handleAiMove] Error applying AI move '${moveNotation}'. Triggering fallback.`, error);
            toast({ title: "AI Error", description: "Error applying AI move. Making a different move.", variant: "destructive" });
            makeFallbackMove(); // Use the dedicated fallback function
            return; // Exit after calling fallback
       }
   }, [game, gameOver, playerColor, checkGameState, makeFallbackMove, toast]);


  // Function to request AI move from Gemini
  const findAiMove = useCallback(async () => {
     if (gameOver || game.turn() === playerColor || isThinking || aiMoveRequestPending.current) {
        console.log("[findAiMove] Skipping AI move request (conditions not met).");
        return;
     }

     const currentFen = game.fen();
     const gameForMoves = new Chess(currentFen); // Use a copy for getting moves
     const validMoves = gameForMoves.moves({ verbose: false }); // Get valid moves in UCI format
     const currentPlayerTurn = gameForMoves.turn();

     if (validMoves.length === 0) {
         console.log("[findAiMove] No valid moves available for AI, checking game state.");
         checkGameState(gameForMoves); // Should already be handled by game logic, but double-check
         return; // Exit if no moves possible
     }

     console.log("[findAiMove] Requesting AI move...");
     setIsThinking(true);
     aiMoveRequestPending.current = true;

     try {
         const input: FindBestChessMoveInput = {
             boardStateFen: currentFen,
             playerTurn: currentPlayerTurn,
             validMovesUci: validMoves,
         };
         console.log("[findAiMove] Calling findBestChessMove flow with input:", input);
         const result: FindBestChessMoveOutput = await findBestChessMove(input);
         console.log("[findAiMove] Received result from flow:", result);

         // Process result immediately
         if (result.status === 'success' && result.bestMoveUci) {
            console.log("[findAiMove] AI returned successful move:", result.bestMoveUci);
            handleAiMove(result.bestMoveUci);
         } else {
             // AI failed, returned no move, or returned invalid move. Pass null to trigger fallback.
             console.warn(`[findAiMove] AI flow status: ${result.status}. Passing null to handleAiMove for fallback.`);
             toast({ title: "AI Decision", description: "AI could not decide or suggested an invalid move. Making a different move.", variant: "default" });
             handleAiMove(null);
         }

     } catch (error) {
         console.error("[findAiMove] Error calling findBestChessMove:", error);
         toast({ title: "AI Error", description: "Error communicating with AI. Making a different move.", variant: "destructive" });
         handleAiMove(null); // Trigger fallback on communication error
     } finally {
        // Ensure flags are reset even if errors occur before handleAiMove is called
        // Although handleAiMove also resets them, this is a safeguard.
         if (aiMoveRequestPending.current) {
             setIsThinking(false);
             aiMoveRequestPending.current = false;
         }
     }
  }, [game, gameOver, playerColor, isThinking, handleAiMove, checkGameState, toast]);


    // Trigger AI move when it's AI's turn
   useEffect(() => {
     if (!gameOver && game.turn() !== playerColor && !isThinking && !aiMoveRequestPending.current) {
       console.log("[Turn Effect] It's AI's turn. Setting timer for AI move.");
       const timer = setTimeout(() => {
         findAiMove();
       }, 500); // Delay AI move slightly for UX
       return () => {
            console.log("[Turn Effect Cleanup] Clearing AI move timer.");
            clearTimeout(timer);
       }
     }
   }, [fen, playerColor, gameOver, isThinking, game, findAiMove]);


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square): boolean {
    // Prevent move if game over, AI is thinking, or not player's turn
    if (gameOver) {
        toast({ title: "Game Over", description: "The game has ended. Reset to play again.", variant: "default" });
        return false;
    }
     if (isThinking) {
        toast({ title: "Wait", description: "AI is thinking...", variant: "default" });
        return false;
     }
     if (game.turn() !== playerColor) {
         toast({ title: "Not Your Turn", description: "Wait for the AI to move.", variant: "default" });
         return false;
     }

    const gameCopy = new Chess(game.fen()); // Create a copy to try the move
    let moveResult: Move | null = null;

    try {
        // Structure the move object for chess.js
        const moveAttempt = {
            from: sourceSquare,
            to: targetSquare,
            promotion: 'q', // Default promotion to Queen
        };

        console.log(`[onDrop] Attempting player move: ${sourceSquare}${targetSquare}`);
        // Attempt the move on the copy
        moveResult = gameCopy.move(moveAttempt);

        // Check if the move was valid (chess.js returns null for illegal moves)
        if (moveResult === null) {
            console.warn(`[onDrop] Invalid player move attempt: ${sourceSquare}${targetSquare}`);
            // Provide more helpful feedback if possible (e.g., "Cannot move King into check")
            toast({ title: "Invalid Move", description: "This move is not legal.", variant: "default" });
            return false; // Indicate move was not made
        }

        // If move is valid:
        console.log(`[onDrop] Player move successful: ${moveResult.san}`);
        setGame(gameCopy); // Update the main game state
        setFen(gameCopy.fen()); // Update FEN state to trigger re-renders and effects
        checkGameState(gameCopy); // Check if this move ended the game
        return true; // Indicate move was successful

    } catch (error) {
        // Catch potential errors *during* move execution in chess.js (less common)
        // Note: chess.js usually returns null for illegal moves rather than throwing.
        // This catch is more for unexpected library errors.
        console.error(`[onDrop] Error processing player move ${sourceSquare}${targetSquare}:`, error);
        toast({ title: "Move Error", description: "An unexpected error occurred processing your move.", variant: "destructive" });
        return false; // Indicate move failed due to error
    }
}


   // Reset the game
   const resetGame = useCallback((newPlayerColor = playerColor) => {
     console.log("[resetGame] Resetting game...");
     aiMoveRequestPending.current = false; // Cancel any potential pending AI requests implicitly
     setIsThinking(false); // Ensure thinking state is reset

     const newGame = new Chess(); // Create a fresh game instance
     setGame(newGame);
     setFen(newGame.fen());
     setGameOver(null);
     setGameStartTime(new Date()); // Reset game start time for new game
     gameStatsSaved.current = false; // Reset stats saved flag for the new game
     setPlayerColor(newPlayerColor);
     setOrientation(newPlayerColor === 'w' ? 'white' : 'black');
     toast({ title: "Game Reset", description: `New game started. Player is ${newPlayerColor === 'w' ? 'White' : 'Black'}.`});

     // useEffect watching fen/playerColor will handle AI's first move if needed
   }, [playerColor, toast]); // Dependencies


   // Choose player color (resets game)
   const chooseColor = useCallback((color: 'w' | 'b') => {
     if (color !== playerColor) {
        console.log(`[chooseColor] Changing player color to ${color} and resetting game.`);
        resetGame(color);
     }
   }, [playerColor, resetGame]); // Dependencies


  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 items-start">
      {/* Chessboard Section */}
      <div className="w-full lg:w-2/3 xl:w-1/2 mx-auto">
         <Card className="shadow-xl rounded-lg overflow-hidden bg-card border-4 border-primary relative">
           {/* Loading/Thinking Overlay */}
           {isThinking && (
             <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
               <LoaderCircle className="h-12 w-12 text-accent animate-spin" />
               <p className="text-accent-foreground font-semibold mt-2">AI is deciding...</p>
             </div>
           )}
           {/* The Chessboard Component */}
            <Chessboard
                id="PlayVsStockfish" // Added ID for potential styling/testing hooks
                key={fen + orientation} // Force re-render on FEN or orientation change for reliability
                position={fen}
                onPieceDrop={onDrop}
                boardOrientation={orientation}
                arePiecesDraggable={!isThinking && !gameOver && game.turn() === playerColor}
                customBoardStyle={{
                    borderRadius: '4px',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)',
                }}
                customDarkSquareStyle={{ backgroundColor: 'hsl(var(--primary) / 0.8)' }} // Slightly transparent
                customLightSquareStyle={{ backgroundColor: 'hsl(var(--background))' }}
                customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 4px hsl(var(--accent))' }} // Accent color on drop
                customPieces={
                // Optional: Define custom pieces if needed
                // e.g., using SVGs or different styles
                {}
                }
                // Example of highlighting last move or checks - requires tracking last move/check status
                // squareStyles={getSquareStyles()}
            />
         </Card>
         {/* Game Over Alert */}
         {gameOver && (
           <Alert variant={gameOver.winner === 'Draw' ? 'default' : (gameOver.winner === (playerColor === 'w' ? 'White' : 'Black') ? 'default' : 'destructive')} className="mt-4 bg-accent/10 border-accent text-accent-foreground rounded-lg shadow-md">
              <Info className="h-5 w-5 text-accent" />
              <AlertTitle className="font-bold text-lg">Game Over!</AlertTitle>
              <AlertDescription>
                {gameOver.reason}. {gameOver.winner !== 'Draw' ? `${gameOver.winner} wins!` : "It's a draw."}
              </AlertDescription>
                {/* Play Again Button */}
                <Button onClick={() => resetGame()} variant="default" size="sm" className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  Play Again?
                </Button>
           </Alert>
          )}

      </div>

      {/* Game Controls Section */}
      <Card className="w-full lg:w-1/3 xl:w-1/4 shadow-lg rounded-lg bg-card border border-border">
        <CardHeader>
          <CardTitle className="text-primary flex items-center justify-between">
            Game Controls
            <Settings className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Color Selection Buttons */}
          <div className="flex gap-2">
             <Button
               onClick={() => chooseColor('w')}
               variant={playerColor === 'w' ? 'default' : 'outline'}
               className={`flex-1 ${playerColor === 'w' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10'}`}
               disabled={isThinking || (playerColor === 'w' && !gameOver)} // Disable if already playing as white unless game over
             >
               Play as White
             </Button>
             <Button
               onClick={() => chooseColor('b')}
               variant={playerColor === 'b' ? 'default' : 'outline'}
               className={`flex-1 ${playerColor === 'b' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10'}`}
               disabled={isThinking || (playerColor === 'b' && !gameOver)} // Disable if already playing as black unless game over
             >
               Play as Black
             </Button>
           </div>

          {/* Reset Game Button */}
          <Button onClick={() => resetGame()} variant="destructive" className="w-full" disabled={isThinking && !gameOver}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
          </Button>
           {/* AI Engine Info */}
           <div className="text-sm text-muted-foreground pt-2 border-t border-border flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" /> AI Engine: Gemini Flash
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

