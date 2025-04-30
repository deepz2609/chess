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
      const gameCopy = new Chess(game.fen());
      const possibleMoves = gameCopy.moves({ verbose: false }); // Get simple UCI strings
      if (possibleMoves.length === 0) {
        checkGameState(gameCopy); // Double check if game ended
        setIsThinking(false); // Ensure thinking is off
        aiMoveRequestPending.current = false; // Ensure pending is off
        return;
      }
      const randomIdx = Math.floor(Math.random() * possibleMoves.length);
      const move = possibleMoves[randomIdx];
      gameCopy.move(move);
      setGame(gameCopy);
      setFen(gameCopy.fen());
      checkGameState(gameCopy);
      setIsThinking(false); // Ensure thinking is off after fallback is made
      aiMoveRequestPending.current = false; // Ensure pending is off
  }, [game, toast]); // Dependency on game state and toast


  // Check game state after each move
   const checkGameState = useCallback((currentGame: Chess) => {
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
         setGameOver(currentGameOver);
         setIsThinking(false); // Stop AI thinking if game ends
         aiMoveRequestPending.current = false; // Clear pending request
     } else {
         // Only reset gameOver if it was previously set
         if (gameOver !== null) {
             setGameOver(null);
         }
     }
   }, [gameOver, toast]); // Check game state logic, depends on game state, toast


   // Handle AI move (received from Gemini or fallback)
   const handleAiMove = useCallback((moveNotation: string | null) => {
       // If moveNotation is null, it means AI failed or returned invalid, so trigger fallback.
       if (moveNotation === null) {
           makeFallbackMove();
           return;
       }

       if (gameOver || game.turn() === playerColor) {
           setIsThinking(false);
           aiMoveRequestPending.current = false;
           return;
       }

       const gameCopy = new Chess(game.fen());
       let moveResult: Move | null = null;
       try {
           moveResult = gameCopy.move(moveNotation, { sloppy: true }); // Allow UCI moves directly
       } catch (error) {
           toast({ title: "AI Move Error", description: `Error applying AI move '${moveNotation}'. Making alternative move.`, variant: "destructive" });
           makeFallbackMove(); // Trigger fallback if applying the move fails catastrophically
           // State reset happens in makeFallbackMove
           return;
       }

       if (moveResult) {
           setGame(gameCopy);
           setFen(gameCopy.fen()); // Trigger useEffect for turn check & UI update
           checkGameState(gameCopy);
           // Crucially, turn off thinking *after* state updates are done
           setIsThinking(false);
           aiMoveRequestPending.current = false;
       } else {
           toast({ title: "Invalid AI Move", description: `AI suggested an invalid move: ${moveNotation}. Making alternative move.`, variant: "destructive" });
           makeFallbackMove(); // Trigger fallback if AI move is invalid according to chess.js
            // State reset happens in makeFallbackMove
       }
   }, [game, gameOver, playerColor, toast, checkGameState, makeFallbackMove]); // Dependencies


  // Function to request AI move from Gemini
  const findAiMove = useCallback(async () => {
     if (gameOver || game.turn() === playerColor || isThinking || aiMoveRequestPending.current) {
        return;
     }

     const currentFen = game.fen();
     const gameForMoves = new Chess(currentFen); // Use a copy for getting moves
     const validMoves = gameForMoves.moves({ verbose: false }); // Get valid moves in UCI format
     const currentPlayerTurn = gameForMoves.turn();

     if (validMoves.length === 0) {
         checkGameState(gameForMoves); // Should already be handled by game logic, but double-check
         return; // Exit if no moves possible
     }

     setIsThinking(true);
     aiMoveRequestPending.current = true;

     try {
         const input: FindBestChessMoveInput = {
             boardStateFen: currentFen,
             playerTurn: currentPlayerTurn,
             validMovesUci: validMoves,
         };
         const result: FindBestChessMoveOutput = await findBestChessMove(input);

         // Process result
         if (result.status === 'success' && result.bestMoveUci) {
            // AI succeeded and provided a move
            handleAiMove(result.bestMoveUci);
         } else {
             // Handle 'error', 'no_valid_moves', or 'invalid_move_suggested' from AI flow
             handleAiMove(null); // Pass null to handleAiMove to trigger fallback explicitly
         }

     } catch (error) {
         toast({ title: "AI Error", description: `Failed to get AI move: ${error instanceof Error ? error.message : String(error)}. Making alternative move.`, variant: "destructive" });
         handleAiMove(null); // Pass null to handleAiMove to trigger fallback on error
     }
  }, [game, gameOver, playerColor, isThinking, toast, handleAiMove, checkGameState]); // Added checkGameState, removed makeFallbackMove (now called via handleAiMove)


    // Trigger AI move when it's AI's turn
   useEffect(() => {
     // Check if the game is not over AND it's AI's turn AND AI is not already thinking AND no request is pending
     if (!gameOver && game.turn() !== playerColor && !isThinking && !aiMoveRequestPending.current) {
       // Use a timer to slightly delay the AI move request for better UX (prevents instant move)
       const timer = setTimeout(() => {
         findAiMove();
       }, 750); // Delay AI move slightly
       // Cleanup function to clear the timer if dependencies change before it fires
       return () => {
            clearTimeout(timer);
       }
     } else {
     }
   }, [fen, playerColor, gameOver, isThinking, game, findAiMove]); // Ensure all relevant states are dependencies


  // Handle player move attempt
  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
    // Prevent move if game over, AI is thinking, or not player's turn
    if (gameOver || isThinking || game.turn() !== playerColor) {
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
          toast({ title: "Invalid Move", description: "That move is not allowed.", variant: "default" });
          return false; // Indicate move was not made
      }

      // If move is valid:
      setGame(gameCopy); // Update the main game state
      setFen(gameCopy.fen()); // Update FEN state to trigger re-renders and effects
      checkGameState(gameCopy); // Check if this move ended the game
      return true; // Indicate move was successful

    } catch (error) {
      // Catch potential errors during move execution (though chess.js usually returns null for invalid moves)
      toast({ title: "Move Error", description: "An error occurred processing your move.", variant: "destructive" });
      return false; // Indicate move failed due to error
    }
  }


   // Reset the game
   const resetGame = useCallback((newPlayerColor = playerColor) => {
     // Cancel any pending AI requests
     if (aiMoveRequestPending.current) {
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

     // The useEffect hook watching `fen`, `playerColor`, etc., will automatically
     // trigger the AI's first move if it's Black's turn after reset.
   }, [playerColor]); // Dependencies: playerColor


   // Choose player color (resets game)
   const chooseColor = useCallback((color: 'w' | 'b') => {
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
