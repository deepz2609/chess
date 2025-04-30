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
  // Removed analysis field
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
  prompt: `You are a strong chess engine. Your goal is to determine the best possible move given the current board state and the player whose turn it is.

Current Board State (FEN):
{{{boardStateFen}}}

It is currently {{#if (eq playerTurn 'w')}}White's{{else}}Black's{{/if}} turn to move.

Here is a list of all valid moves in UCI notation for the current player:
{{#each validMovesUci}}
- {{this}}
{{/each}}

Analyze the position and select the *single best move* from the provided list of valid moves. Return *only* the chosen move in UCI format (e.g., "e2e4", "g1f3", "a7a8q" for promotion). Do not include any explanation, analysis, or extraneous text.

If no valid moves are provided, or if the game state represents a checkmate or stalemate where no move is logically possible (though the list might technically be non-empty in some edge cases), return null for the move.
`,
  // Configure the prompt for strong chess play
  config: {
    temperature: 0.2, // Low temperature for more deterministic chess analysis
    maxOutputTokens: 10, // Enough for just the UCI move (e.g., "a7a8q")
    stopSequences: ["\n"], // Stop generation after the move
    // Consider adding candidate_count > 1 and choosing the best if needed, but start simple
  },
  // Ensure output is just the move string
  // format: 'text' // Implicitly text if output schema is just a string
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
      return { bestMoveUci: null, status: 'error' };
    }

     // Clean up the output - Gemini might add extra spaces or quotes
     const suggestedMove = output.bestMoveUci.trim().replace(/['"]/g, ''); // Remove quotes and trim whitespace
     console.log(`[findBestChessMove Flow] Cleaned suggested move: '${suggestedMove}'`);

    // Validate the returned move is actually in the list of valid moves *and* valid according to chess.js
    const gameForValidation = new Chess(input.boardStateFen);
    let isValidChessJsMove = false;
    try {
        isValidChessJsMove = !!gameForValidation.move(suggestedMove, { sloppy: true }); // Try the move
        console.log(`[findBestChessMove Flow] chess.js validation result for '${suggestedMove}': ${isValidChessJsMove}`);
    } catch (e) {
        // chess.js throws if the move format is fundamentally wrong (not just illegal)
        console.warn(`[findBestChessMove Flow] chess.js threw error validating move '${suggestedMove}':`, e);
        isValidChessJsMove = false;
    }

    const isInProvidedList = input.validMovesUci.includes(suggestedMove);
    console.log(`[findBestChessMove Flow] Is move '${suggestedMove}' in provided list? ${isInProvidedList}`);

    if (isValidChessJsMove && isInProvidedList) {
       console.log(`[findBestChessMove Flow] Move '${suggestedMove}' is valid and in the list. Returning success.`);
       return { bestMoveUci: suggestedMove, status: 'success' };
    } else {
       console.warn(`[findBestChessMove Flow] Gemini returned an invalid or unexpected move: '${suggestedMove}'. Valid according to chess.js: ${isValidChessJsMove}. In provided list: ${isInProvidedList}.`);
       // Do NOT fallback to random here. Let the calling function decide.
       return { bestMoveUci: null, status: 'invalid_move_suggested' };
    }

  } catch (error) {
    console.error("[findBestChessMove Flow] Error calling Gemini:", error);
    // Do NOT fallback to random here. Let the calling function decide.
    return { bestMoveUci: null, status: 'error' };
  }
});
