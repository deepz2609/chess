'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Piece, Square } from 'react-chessboard/dist/chessboard/types';
import { Chess, Move } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RotateCcw, Info, Settings, BrainCircuit } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle } from 'lucide-react';
import { findBestChessMove, type FindBestChessMoveInput, type FindBestChessMoveOutput } from '@/ai/flows/find-best-chess-move';


export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState<{ reason: string; winner: string | null } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const { toast } = useToast();
  const aiMoveRequestPending = useRef(false); // Prevents multiple simultaneous AI requests


  // Function to make a fallback move (simple random move)
  const makeFallbackMove = useCallback(() => {
      console.log("[Fallback] Making a fallback move.");
      const gameCopy = new Chess(game.fen());
      const possibleMoves = gameCopy.moves({ verbose: false }); // Get simple UCI strings
      if (possibleMoves.length === 0) {
        console.warn("[Fallback] No valid moves available for fallback selection.");
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        checkGameState(gameCopy); // Double check if game ended
        setIsThinking(false); // Ensure thinking is off
        aiMoveRequestPending.current = false; // Ensure pending is off
        return;
      }
      const randomIdx = Math.floor(Math.random() * possibleMoves.length);
      const move = possibleMoves[randomIdx];
      console.log(`[Fallback] Selected move: ${move}`);
      gameCopy.move(move);
      setGame(gameCopy);
      setFen(gameCopy.fen());
       // eslint-disable-next-line @typescript-eslint/no-use-before-define
      checkGameState(gameCopy);
      setIsThinking(false); // Ensure thinking is off after fallback is made
      aiMoveRequestPending.current = false; // Ensure pending is off
      toast({ title: "Move Made", description: "AI chose an alternative move.", variant: "default" });
  }, [game, toast]); // Dependency on game state and toast


  // Check game state after each move
   const checkGameState = useCallback((currentGame: Chess) => {
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
         setIsThinking(false); // Stop AI thinking if game ends
         aiMoveRequestPending.current = false; // Clear pending request
     } else {
         console.log("[checkGameState] Game continues.");
         // Only reset gameOver if it was previously set
         if (gameOver !== null) {
             console.log("[checkGameState] Resetting gameOver state to null as game continues.");
             setGameOver(null);
         }
     }
   }, [gameOver, toast]); // Check game state logic, depends on game state, toast


   // Handle AI move (received from Gemini or fallback)
   const handleAiMove = useCallback((moveNotation: string | null) => {
       // If moveNotation is null, it means AI failed or returned invalid, so trigger fallback.
       if (moveNotation === null) {
           console.warn("[handleAiMove] Received null move notation, triggering fallback.");
           makeFallbackMove();
           return;
       }

       console.log(`[handleAiMove] Processing move: ${moveNotation}.`);

       if (gameOver || game.turn() === playerColor) {
           console.warn(`[handleAiMove] Received AI move ${moveNotation}, but game state is invalid or not AI's turn. Ignoring.`, { gameOver, turn: game.turn(), playerColor });
           setIsThinking(false);
           aiMoveRequestPending.current = false;
           return;
       }

       const gameCopy = new Chess(game.fen());
       let moveResult: Move | null = null;
       try {
           console.log(`[handleAiMove] Attempting gameCopy.move(${moveNotation})`);
           moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Allow UCI moves directly
       } catch (error) {
           console.error(`[handleAiMove] Error applying move ${moveNotation} to FEN ${game.fen()} using chess.js:`, error);
           toast({ title: "AI Move Error", description: `Error applying AI move '${moveNotation}'. Making alternative move.`, variant: "destructive" });
           makeFallbackMove(); // Trigger fallback if applying the move fails catastrophically
           // State reset happens in makeFallbackMove
           return;
       }

       if (moveResult) {
           console.log(`[handleAiMove] chess.js applied move successfully. SAN: ${moveResult.san}, New FEN: ${gameCopy.fen()}`);
           setGame(gameCopy);
           setFen(gameCopy.fen()); // Trigger useEffect for turn check & UI update
           checkGameState(gameCopy);
           // Crucially, turn off thinking *after* state updates are done
           setIsThinking(false);
           aiMoveRequestPending.current = false;
       } else {
           console.error(`[handleAiMove] Invalid AI move according to chess.js (moveResult was null): ${moveNotation} for FEN: ${game.fen()}. Making alternative move.`);
           toast({ title: "Invalid AI Move", description: `AI suggested an invalid move: ${moveNotation}. Making alternative move.`, variant: "destructive" });
           makeFallbackMove(); // Trigger fallback if AI move is invalid according to chess.js
            // State reset happens in makeFallbackMove
       }
   }, [game, gameOver, playerColor, toast, checkGameState, makeFallbackMove]); // Dependencies


  // Function to request AI move from Gemini
  const findAiMove = useCallback(async () => {
     console.log("[findAiMove] Attempting to trigger AI move. Checking conditions...");
     if (gameOver || game.turn() === playerColor || isThinking || aiMoveRequestPending.current) {
        console.log("[findAiMove] AI move skipped due to conditions:", { gameOver, turn: game.turn(), playerColor, isThinking, pending: aiMoveRequestPending.current });
        return;
     }

     const currentFen = game.fen();
     const gameForMoves = new Chess(currentFen); // Use a copy for getting moves
     const validMoves = gameForMoves.moves({ verbose: false }); // Get valid moves in UCI format
     const currentPlayerTurn = gameForMoves.turn();

     if (validMoves.length === 0) {
         console.warn("[findAiMove] No valid moves for AI according to chess.js. Checking game state.");
         checkGameState(gameForMoves); // Should already be handled by game logic, but double-check
         return; // Exit if no moves possible
     }

     console.log(`[findAiMove] Conditions met. Requesting move for FEN: ${currentFen}, Turn: ${currentPlayerTurn}, Valid Moves:`, validMoves);
     setIsThinking(true);
     aiMoveRequestPending.current = true;

     try {
         const input: FindBestChessMoveInput = {
             boardStateFen: currentFen,
             playerTurn: currentPlayerTurn,
             validMovesUci: validMoves,
         };
         console.log("[findAiMove] Calling Genkit flow 'findBestChessMove' with input:", input);
         const result: FindBestChessMoveOutput = await findBestChessMove(input);
         console.log("[findAiMove] Received result from Genkit flow:", result);

         // Process result
         if (result.status === 'success' && result.bestMoveUci) {
            // AI succeeded and provided a move
            console.log(`[findAiMove] Genkit flow succeeded, passing move '${result.bestMoveUci}' to handleAiMove.`);
            handleAiMove(result.bestMoveUci);
         } else {
             // Handle 'error', 'no_valid_moves', or 'invalid_move_suggested' from AI flow
             console.warn(`[findAiMove] Genkit flow did not return a successful move. Status: ${result.status}, Move: ${result.bestMoveUci}. Triggering fallback.`);
             handleAiMove(null); // Pass null to handleAiMove to trigger fallback explicitly
         }

     } catch (error) {
         console.error("[findAiMove] Error calling Genkit flow:", error);
         toast({ title: "AI Error", description: `Failed to get AI move: ${error instanceof Error ? error.message : String(error)}. Making alternative move.`, variant: "destructive" });
         handleAiMove(null); // Pass null to handleAiMove to trigger fallback on error
     }
  }, [game, gameOver, playerColor, isThinking, toast, handleAiMove, checkGameState]); // Added checkGameState, removed makeFallbackMove (now called via handleAiMove)


    // Trigger AI move when it's AI's turn
   useEffect(() => {
     console.log("[Turn Check Effect] Evaluating AI move trigger based on dependencies:", {
       fen, // FEN change implies a move was made
       turn: game.turn(),
       playerColor,
       gameOver: !!gameOver,
       isThinking,
       aiMoveRequestPending: aiMoveRequestPending.current
      });

     // Check if the game is not over AND it's AI's turn AND AI is not already thinking AND no request is pending
     if (!gameOver && game.turn() !== playerColor && !isThinking && !aiMoveRequestPending.current) {
       console.log("[Turn Check Effect] Conditions met, scheduling AI move check via findAiMove timer.");
       // Use a timer to slightly delay the AI move request for better UX (prevents instant move)
       const timer = setTimeout(() => {
         console.log("[Turn Check Timer] Timer fired, calling findAiMove.");
         findAiMove();
       }, 750); // Delay AI move slightly
       // Cleanup function to clear the timer if dependencies change before it fires
       return () => {
            console.log("[Turn Check Timer] Clearing AI move timer due to dependency change or unmount.");
            clearTimeout(timer);
       }
     } else {
        console.log("[Turn Check Effect] Conditions NOT met for triggering AI move.");
        // Log why it didn't trigger if needed
        if (gameOver) console.log("[Turn Check Effect] Reason: Game is over.");
        if (game.turn() === playerColor) console.log("[Turn Check Effect] Reason: It's player's turn.");
        if (isThinking) console.log("[Turn Check Effect] Reason: AI is already thinking.");
        if (aiMoveRequestPending.current) console.log("[Turn Check Effect] Reason: AI move request is already pending.");
     }
   }, [fen, playerColor, gameOver, isThinking, game, findAiMove]); // Ensure all relevant states are dependencies


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
    console.log(`[Player Move Attempt] ${piece} from ${sourceSquare} to ${targetSquare}`);
    // Prevent move if game over, AI is thinking, or not player's turn
    if (gameOver || isThinking || game.turn() !== playerColor) {
        console.log("[Player Move] Blocked:", { gameOver, isThinking, turn: game.turn(), playerColor });
        toast({ title: "Wait", description: gameOver ? "Game is over." : (isThinking ? "AI is thinking..." : "Not your turn."), variant: "default" });
        return false; // Indicate move was not made
    }

    const gameCopy = new Chess(game.fen()); // Create a copy to try the move
    let moveResult = null;
    try {
      // Attempt the move
      moveResult = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Automatically promote to Queen for simplicity
      });

      // Check if the move was valid (chess.js returns null for illegal moves)
      if (moveResult === null) {
          console.warn(`[Player Move] Illegal move attempted: ${sourceSquare}-${targetSquare}`);
          toast({ title: "Invalid Move", description: "That move is not allowed.", variant: "default" });
          return false; // Indicate move was not made
      }

      // If move is valid:
      console.log(`[Player Move] Move successful: ${moveResult.san}. New FEN: ${gameCopy.fen()}`);
      setGame(gameCopy); // Update the main game state
      setFen(gameCopy.fen()); // Update FEN state to trigger re-renders and effects
      checkGameState(gameCopy); // Check if this move ended the game
      return true; // Indicate move was successful

    } catch (error) {
      // Catch potential errors during move execution (though chess.js usually returns null for invalid moves)
      console.error(`[Player Move] Error processing move ${sourceSquare}-${targetSquare}:`, error);
      toast({ title: "Move Error", description: "An error occurred processing your move.", variant: "destructive" });
      return false; // Indicate move failed due to error
    }
  }


   // Reset the game
   const resetGame = useCallback((newPlayerColor = playerColor) => {
     console.log(`[Game Reset] Resetting game. Player will be: ${newPlayerColor === 'w' ? 'White' : 'Black'}`);
     // Cancel any pending AI requests
     if (aiMoveRequestPending.current) {
         console.log("[Game Reset] Cancelling pending AI request.");
         // We can set a flag or check the game state in the response handler.
         aiMoveRequestPending.current = false; // Prevent processing the result of the old request
     }
     setIsThinking(false); // Force UI update if it was stuck thinking

     const newGame = new Chess(); // Create a fresh game instance
     setGame(newGame);
     setFen(newGame.fen()); // Update FEN
     setGameOver(null); // Clear game over state
     setPlayerColor(newPlayerColor); // Set the chosen player color
     setOrientation(newPlayerColor === 'w' ? 'white' : 'black'); // Set board orientation
     console.log("[Game Reset] React state updated.");

     // The useEffect hook watching `fen`, `playerColor`, etc., will automatically
     // trigger the AI's first move if it's Black's turn after reset.
     console.log("[Game Reset] Game reset process complete.");
   }, [playerColor]); // Dependencies: playerColor


   // Choose player color (resets game)
   const chooseColor = useCallback((color: 'w' | 'b') => {
     console.log(`[Color Choice] Player chose ${color === 'w' ? 'White' : 'Black'}.`);
     // Only reset if the color actually changes
     if (color !== playerColor) {
        resetGame(color);
     }
   }, [playerColor, resetGame]); // Dependencies: playerColor (to check if change needed), resetGame (the action)


  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 items-start">
      {/* Chessboard Section */}
      <div className="w-full lg:w-2/3 xl:w-1/2 mx-auto">
         <Card className="shadow-xl rounded-lg overflow-hidden bg-card border-4 border-primary relative">
           {/* Loading/Thinking Overlay */}
           {isThinking && (
             <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
               <LoaderCircle className="h-12 w-12 text-accent animate-spin" />
               <p className="text-accent-foreground font-semibold mt-2">AI is thinking...</p>
             </div>
           )}
           {/* The Chessboard Component */}
           <Chessboard
             key={fen + orientation} // Force re-render on FEN or orientation change for reliability
             position={fen}
             onPieceDrop={onDrop} // Handle player moves
             boardOrientation={orientation} // White or Black at bottom
             customBoardStyle={{ borderRadius: '4px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)' }}
             customDarkSquareStyle={{ backgroundColor: 'hsl(var(--primary))' }}
             customLightSquareStyle={{ backgroundColor: 'hsl(var(--background))' }}
             // Disable dragging pieces if AI is thinking, game is over, or not player's turn
             arePiecesDraggable={!isThinking && !gameOver && game.turn() === playerColor}
           />
         </Card>
         {/* Game Over Alert */}
         {gameOver && (
           <Alert variant={gameOver.winner === 'Draw' ? 'default' : 'destructive'} className="mt-4 bg-accent/10 border-accent text-accent-foreground rounded-lg shadow-md">
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
               // Apply specific styles based on selection and theme
               className={`flex-1 ${playerColor === 'w' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10'}`}
               // Disable if AI thinking or already playing as White
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