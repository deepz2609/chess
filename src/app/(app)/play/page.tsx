
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Piece, Square } from 'react-chessboard/dist/chessboard/types';
import { Chess, Move } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RotateCcw, Info, Settings, BrainCircuit } from 'lucide-react'; // Using BrainCircuit for AI title
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle } from 'lucide-react';
import { findBestChessMove, type FindBestChessMoveInput, type FindBestChessMoveOutput } from '@/ai/flows/find-best-chess-move'; // Import Genkit flow

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState<{ reason: string; winner: string | null } | null>(null);
  const [isThinking, setIsThinking] = useState(false); // General thinking state for AI
  const { toast } = useToast();
  const aiMoveRequestPending = useRef(false); // Flag to prevent duplicate AI move requests

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
         if (gameOver !== null) {
            console.log("[checkGameState] Resetting gameOver state to null.");
            setGameOver(null);
         }
     }
   }, [gameOver, toast]);


   // Make a random legal move for the AI (Fallback)
   const makeRandomMove = useCallback(() => {
     console.log("[makeRandomMove] Attempting to make a random fallback move.");
      if (gameOver || game.turn() === playerColor) {
         console.warn("[makeRandomMove] Skipping: Game over or player's turn.");
         setIsThinking(false);
         aiMoveRequestPending.current = false;
         return;
      }

     const gameCopy = new Chess(game.fen());
     const possibleMoves = gameCopy.moves({ verbose: true });

     if (possibleMoves.length === 0) {
       console.warn("[makeRandomMove] No legal moves available for random move. Checking game state.");
       checkGameState(gameCopy);
       setIsThinking(false);
       aiMoveRequestPending.current = false;
       return;
     }

     const randomIndex = Math.floor(Math.random() * possibleMoves.length);
     const randomMove = possibleMoves[randomIndex];
     const moveNotation = `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`; // UCI format

     console.log(`[makeRandomMove] Selected random move: ${randomMove.san} (UCI: ${moveNotation})`);

     // Make the move directly
      const finalGameCopy = new Chess(game.fen());
      const moveResult = finalGameCopy.move(moveNotation, { sloppy: true });

      if (moveResult) {
         console.log(`[makeRandomMove] Applied random move: ${moveResult.san}. New FEN: ${finalGameCopy.fen()}`);
         setGame(finalGameCopy);
         setFen(finalGameCopy.fen());
         checkGameState(finalGameCopy);
      } else {
         console.error(`[makeRandomMove] Generated random move ${moveNotation} was invalid according to chess.js. FEN: ${game.fen()}. This shouldn't happen.`);
         toast({ title: "Random Move Error", description: "Failed to make a random fallback move.", variant: "destructive" });
         // Don't call makeRandomMove again to prevent loops.
         checkGameState(game); // Check current state
      }

      // Ensure state is updated after the move
      setIsThinking(false);
      aiMoveRequestPending.current = false;

   }, [game, gameOver, playerColor, toast, checkGameState]);

    // Handle AI move (received from Gemini or random fallback)
    const handleAiMove = useCallback((moveNotation: string | null) => {
        console.log(`[handleAiMove] Processing move: ${moveNotation ?? 'null'}.`);
        aiMoveRequestPending.current = false; // Reset pending flag FIRST
        setIsThinking(false); // Turn off thinking indicator

        if (gameOver || game.turn() === playerColor) {
            console.warn(`[handleAiMove] Received AI move ${moveNotation}, but game state is invalid. Ignoring.`, { gameOver, turn: game.turn(), playerColor });
            return;
        }

        if (moveNotation === null) {
             console.warn("[handleAiMove] Received null move from AI. Attempting random move.");
             toast({ title: "AI Decision", description: "AI could not determine a move. Playing randomly.", variant: "default" });
             makeRandomMove();
             return;
        }


        const gameCopy = new Chess(game.fen());
        let moveResult: Move | null = null;
        try {
            console.log(`[handleAiMove] Attempting gameCopy.move(${moveNotation})`);
            moveResult = gameCopy.move(moveNotation, { sloppy: true });
        } catch (error) {
            console.error(`[handleAiMove] Error applying move ${moveNotation} to FEN ${game.fen()} using chess.js:`, error);
            toast({ title: "AI Move Error", description: `Error applying AI move '${moveNotation}'. Playing randomly.`, variant: "destructive" });
            makeRandomMove(); // Fallback on error
            return;
        }

        if (moveResult) {
            console.log(`[handleAiMove] chess.js applied move successfully. SAN: ${moveResult.san}, New FEN: ${gameCopy.fen()}`);
            setGame(gameCopy);
            setFen(gameCopy.fen()); // Trigger useEffect for turn check
            checkGameState(gameCopy);
        } else {
            console.error(`[handleAiMove] Invalid AI move according to chess.js (moveResult was null): ${moveNotation} for FEN: ${game.fen()}. Trying random move.`);
            toast({ title: "Invalid AI Move", description: `Received invalid move: ${moveNotation}. Playing randomly.`, variant: "destructive" });
            makeRandomMove(); // Fallback if move is invalid
        }
    }, [game, gameOver, playerColor, toast, checkGameState, makeRandomMove]);


   // Function to request AI move from Gemini
   const findAiMove = useCallback(async () => {
      console.log("[findAiMove] Attempting to trigger AI move. Checking conditions...");
      if (gameOver || game.turn() === playerColor || isThinking || aiMoveRequestPending.current) {
         console.log("[findAiMove] AI move skipped due to conditions:", { gameOver, turn: game.turn(), playerColor, isThinking, pending: aiMoveRequestPending.current });
         return;
      }

      const currentFen = game.fen();
      const validMoves = game.moves({ verbose: false }); // Get valid moves in UCI format
      const currentPlayerTurn = game.turn();

      if (validMoves.length === 0) {
          console.warn("[findAiMove] No valid moves for AI. Checking game state.");
          checkGameState(game); // Should already be handled by game logic, but double-check
          return;
      }

      console.log(`[findAiMove] Conditions met. Requesting move for FEN: ${currentFen}, Turn: ${currentPlayerTurn}`);
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

          // Process result (handles success, error, no_valid_moves internally)
          handleAiMove(result.bestMoveUci);

      } catch (error) {
          console.error("[findAiMove] Error calling Genkit flow:", error);
          toast({ title: "AI Error", description: `Failed to get AI move: ${error instanceof Error ? error.message : String(error)}. Playing randomly.`, variant: "destructive" });
          // Don't call handleAiMove with null here, directly call random move
          makeRandomMove();
          // Ensure state is consistent after error + random move
          setIsThinking(false);
          aiMoveRequestPending.current = false;
      }
   }, [game, gameOver, playerColor, isThinking, toast, handleAiMove, makeRandomMove, checkGameState]);


     // Trigger AI move when it's AI's turn
    useEffect(() => {
      console.log("[Turn Check Effect] Evaluating AI move trigger based on dependencies:", {
        fen,
        turn: game.turn(),
        playerColor,
        gameOver: !!gameOver,
        isThinking,
        aiMoveRequestPending: aiMoveRequestPending.current
       });

      if (!gameOver && game.turn() !== playerColor && !isThinking && !aiMoveRequestPending.current) {
        console.log("[Turn Check Effect] Conditions met, scheduling AI move check via findAiMove timer.");
        const timer = setTimeout(() => {
          console.log("[Turn Check Timer] Timer fired, calling findAiMove.");
          findAiMove();
        }, 500); // Delay for API call UX
        return () => {
             console.log("[Turn Check Timer] Clearing AI move timer due to dependency change or unmount.");
             clearTimeout(timer);
        }
      } else {
         console.log("[Turn Check Effect] Conditions NOT met for triggering AI move.");
      }
    }, [fen, playerColor, gameOver, isThinking, game, findAiMove]);


   // Handle player move attempt
   function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
     console.log(`[Player Move Attempt] ${piece} from ${sourceSquare} to ${targetSquare}`);
     if (gameOver || isThinking || game.turn() !== playerColor) {
         console.log("[Player Move] Blocked:", { gameOver, isThinking, turn: game.turn(), playerColor });
         toast({ title: "Wait", description: gameOver ? "Game is over." : (isThinking ? "AI is thinking..." : "Not your turn."), variant: "default" });
         return false;
     }

     const gameCopy = new Chess(game.fen());
     let moveResult = null;
     try {
       moveResult = gameCopy.move({
         from: sourceSquare,
         to: targetSquare,
         promotion: 'q', // Auto-promote to queen
       });

       if (moveResult === null) {
           console.warn(`[Player Move] Illegal move attempted: ${sourceSquare}-${targetSquare}`);
           toast({ title: "Invalid Move", description: "That move is not allowed.", variant: "default" });
           return false;
       }

       console.log(`[Player Move] Move successful: ${moveResult.san}. New FEN: ${gameCopy.fen()}`);
       setGame(gameCopy);
       setFen(gameCopy.fen()); // Triggers useEffect for AI turn
       checkGameState(gameCopy);
       return true;

     } catch (error) {
       console.error(`[Player Move] Error processing move ${sourceSquare}-${targetSquare}:`, error);
       toast({ title: "Move Error", description: "An error occurred processing your move.", variant: "destructive" });
       return false;
     }
   }


    // Reset the game
    const resetGame = useCallback((newPlayerColor = playerColor) => {
      console.log(`[Game Reset] Resetting game. Player will be: ${newPlayerColor === 'w' ? 'White' : 'Black'}`);
      if (isThinking || aiMoveRequestPending.current) {
          console.log("[Game Reset] Cancelling pending AI request.");
          // No 'stop' command for Gemini, just prevent processing the result
          aiMoveRequestPending.current = false; // Prevent processing response
          setIsThinking(false); // Force UI update
      }

      const newGame = new Chess();
      setGame(newGame);
      setFen(newGame.fen());
      setGameOver(null);
      setIsThinking(false);
      setPlayerColor(newPlayerColor);
      setOrientation(newPlayerColor === 'w' ? 'white' : 'black');
      console.log("[Game Reset] React state updated.");

      // The useEffect hook [fen, playerColor, ...] will handle triggering the AI if it's AI's turn.
      console.log("[Game Reset] Game reset process complete.");
    }, [playerColor, isThinking]);


    // Choose player color (resets game)
    const chooseColor = useCallback((color: 'w' | 'b') => {
      console.log(`[Color Choice] Player chose ${color === 'w' ? 'White' : 'Black'}.`);
      if (color !== playerColor) {
         resetGame(color);
      }
    }, [playerColor, resetGame]);


   return (
     <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 items-start">
       <div className="w-full lg:w-2/3 xl:w-1/2 mx-auto">
          <Card className="shadow-xl rounded-lg overflow-hidden bg-card border-4 border-primary relative">
            {isThinking && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                <LoaderCircle className="h-12 w-12 text-accent animate-spin" />
                <p className="text-accent-foreground font-semibold mt-2">AI is thinking...</p>
              </div>
            )}
            <Chessboard
              key={fen + orientation}
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={orientation}
              customBoardStyle={{ borderRadius: '4px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)' }}
              customDarkSquareStyle={{ backgroundColor: 'hsl(var(--primary))' }}
              customLightSquareStyle={{ backgroundColor: 'hsl(var(--background))' }}
              arePiecesDraggable={!isThinking && !gameOver}
            />
          </Card>
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

           <Button onClick={() => resetGame()} variant="destructive" className="w-full" disabled={isThinking && !gameOver}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
           </Button>
            <div className="text-sm text-muted-foreground pt-2 border-t border-border">
                 AI Engine: Gemini Pro <br/>
                 Fallback: Random Move
            </div>
         </CardContent>
       </Card>
     </div>
   );
 }
