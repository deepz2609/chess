'use server';
/**
 * @fileOverview An AI agent that determines the best chess move for a given board state using Gemini.
 *
 * - findBestChessMove - A function that uses Gemini to find the best move.
 * - FindBestChessMoveInput - The input type for the findBestChessMove function.
 * - FindBestChessMoveOutput - The return type for the findBestChessMove function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {Chess} from 'chess.js'; // Import chess.js for move validation

const FindBestChessMoveInputSchema = z.object({
  boardStateFen: z.string().describe('The current board state in FEN notation.'),
  playerTurn: z.enum(['w', 'b']).describe('Whose turn it is ("w" for white, "b" for black).'),
  validMovesUci: z.array(z.string()).describe('A list of all valid moves in UCI notation for the current player.'),
});
export type FindBestChessMoveInput = z.infer<typeof FindBestChessMoveInputSchema>;

const FindBestChessMoveOutputSchema = z.object({
  bestMoveUci: z.string().nullable().describe('The best move determined by the AI in UCI notation (e.g., "e2e4", "a7a8q"). Null if no move is possible or determined.'),
  status: z.enum(['success', 'no_valid_moves', 'error', 'invalid_move_suggested']).describe('Status of the move generation.'),
});
export type FindBestChessMoveOutput = z.infer<typeof FindBestChessMoveOutputSchema>;

export async function findBestChessMove(input: FindBestChessMoveInput): Promise<FindBestChessMoveOutput> {
  // If there are no valid moves, return immediately.
  if (input.validMovesUci.length === 0) {
     console.warn("[findBestChessMove Wrapper] No valid moves provided in input. Returning 'no_valid_moves'.");
     return { bestMoveUci: null, status: 'no_valid_moves' };
  }
  return findBestChessMoveFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findBestChessMovePrompt',
  input: {
    schema: FindBestChessMoveInputSchema,
  },
  output: {
    // Let Gemini return just the string, validation happens in the flow
     schema: z.object({
       bestMoveUci: z.string().nullable().describe('Suggested move in UCI format (e.g., "e2e4", "g1f3", "a7a8q").'),
     })
  },
  prompt: `You are a world-class chess grandmaster AI, playing at the level of a World Champion. Your goal is to determine the absolute best possible move given the current board state and the player whose turn it is. You must perform deep strategic and tactical analysis.

Current Board State (FEN):
{{{boardStateFen}}}

It is currently {{#if (eq playerTurn 'w')}}White's{{else}}Black's{{/if}} turn to move.

Here is a list of all valid moves in UCI notation for the current player:
{{#each validMovesUci}}
- {{this}}
{{/each}}

Analyze the position with extreme depth. Consider the following:
- **Tactics:** Look for checks, captures, forks, pins, skewers, discovered attacks, and sacrifices several moves ahead.
- **Strategy:** Evaluate piece activity, king safety, pawn structure, control of key squares and open files, and long-term positional advantages.
- **Threats:** Identify and neutralize immediate threats from the opponent.
- **Endgame:** If approaching an endgame, consider relevant principles.
- **Avoid Blunders:** Do not make simple mistakes or hang pieces unnecessarily. Play with precision.

Select the *single best move* from the provided list of valid moves based on your deep analysis. Return *only* the chosen move in UCI format (e.g., "e2e4", "g1f3", "a7a8q" for promotion). Do not include any explanation, analysis, or extraneous text. Your output must be solely the UCI string of the best move.

If no valid moves are provided, or if the game state represents a checkmate or stalemate where no move is logically possible (though the list might technically be non-empty in some edge cases), return null for the move.
`,
  // Configure the prompt for strong chess play
  config: {
    temperature: 0.2, // Low temperature for more deterministic, less random, stronger play
    maxOutputTokens: 10, // Enough for just the UCI move (e.g., "a7a8q")
    stopSequences: ["\n"], // Stop generation after the move
  },
});

const findBestChessMoveFlow = ai.defineFlow<
  typeof FindBestChessMoveInputSchema,
  typeof FindBestChessMoveOutputSchema // Keep the original output schema for the flow
>({
  name: 'findBestChessMoveFlow',
  inputSchema: FindBestChessMoveInputSchema,
  outputSchema: FindBestChessMoveOutputSchema, // The flow returns the structured output
}, async input => {
   if (input.validMovesUci.length === 0) {
     console.log("[findBestChessMove Flow] No valid moves passed to flow. Returning 'no_valid_moves'.");
     return { bestMoveUci: null, status: 'no_valid_moves' };
   }

  try {
    console.log("[findBestChessMove Flow] Calling Gemini prompt with FEN:", input.boardStateFen);
    const {output} = await prompt(input);
    console.log("[findBestChessMove Flow] Received raw output from Gemini:", output);

    if (!output || !output.bestMoveUci) {
      console.warn("[findBestChessMove Flow] Gemini returned no output or null move.");
      // Could be stalemate/checkmate handled by AI, or an error. Check game state to be sure.
      const tempGame = new Chess(input.boardStateFen);
      if (tempGame.isGameOver()) {
          console.log("[findBestChessMove Flow] Game is over, Gemini returning null is expected.");
          return { bestMoveUci: null, status: 'no_valid_moves' }; // No moves possible
      }
      console.warn("[findBestChessMove Flow] Gemini returned null but game not over. Treating as error.");
      return { bestMoveUci: null, status: 'error' }; // Indicate error, let caller handle fallback
    }

     // Clean up the output - Gemini might add extra spaces or quotes
     const suggestedMove = output.bestMoveUci.trim().replace(/['"]/g, ''); // Remove quotes and trim whitespace
     console.log(`[findBestChessMove Flow] Cleaned suggested move: '${suggestedMove}'`);

    // Validate the returned move is actually in the list of valid moves *and* valid according to chess.js
    const gameForValidation = new Chess(input.boardStateFen);
    let isValidChessJsMove = false;
    let validatedMoveObject = null;
    try {
        // Use chess.js to validate the move structure and legality in the current position.
        // The `move` method returns the move object if legal, null otherwise.
        validatedMoveObject = gameForValidation.move(suggestedMove, { sloppy: true }); // Sloppy allows SAN/UCI etc.
        isValidChessJsMove = !!validatedMoveObject;
        console.log(`[findBestChessMove Flow] chess.js validation result for '${suggestedMove}': ${isValidChessJsMove}`);
    } catch (e) {
        // chess.js might throw if the move format is fundamentally wrong (e.g., not UCI)
        console.warn(`[findBestChessMove Flow] chess.js threw error validating move format '${suggestedMove}':`, e);
        isValidChessJsMove = false;
    }

    // Check if the move returned by Gemini is present in the initial list of valid moves
    // We use the UCI representation from the validated move object if available, otherwise the raw suggestion.
    // chess.js `move` function returns a move object containing the UCI string if successful.
    const uciToCompare = validatedMoveObject ? validatedMoveObject.lan : suggestedMove;
    const isInProvidedList = input.validMovesUci.includes(uciToCompare);
    console.log(`[findBestChessMove Flow] Is move '${uciToCompare}' (derived from suggestion '${suggestedMove}') in provided list? ${isInProvidedList}`);


    if (isValidChessJsMove && isInProvidedList) {
       console.log(`[findBestChessMove Flow] Move '${uciToCompare}' is valid and in the list. Returning success.`);
        // Return the validated UCI move from chess.js object for consistency
       return { bestMoveUci: uciToCompare, status: 'success' };
    } else {
       console.warn(`[findBestChessMove Flow] Gemini returned an invalid or unexpected move: '${suggestedMove}'. Valid according to chess.js: ${isValidChessJsMove}. In provided list: ${isInProvidedList} (compared against '${uciToCompare}').`);
       return { bestMoveUci: null, status: 'invalid_move_suggested' }; // Indicate invalid suggestion, let caller handle fallback
    }

  } catch (error) {
    console.error("[findBestChessMove Flow] Error calling Gemini:", error);
    return { bestMoveUci: null, status: 'error' }; // Indicate error, let caller handle fallback
  }
});
