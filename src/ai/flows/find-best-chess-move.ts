'use server';
/**
 * @fileOverview An AI agent that determines the best chess move for a given board state.
 *
 * - findBestChessMove - A function that uses Gemini to find the best move.
 * - FindBestChessMoveInput - The input type for the findBestChessMove function.
 * - FindBestChessMoveOutput - The return type for the findBestChessMove function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const FindBestChessMoveInputSchema = z.object({
  boardStateFen: z.string().describe('The current board state in FEN notation.'),
  playerTurn: z.enum(['w', 'b']).describe('Whose turn it is ("w" for white, "b" for black).'),
  validMovesUci: z.array(z.string()).describe('A list of all valid moves in UCI notation for the current player.'),
});
export type FindBestChessMoveInput = z.infer<typeof FindBestChessMoveInputSchema>;

const FindBestChessMoveOutputSchema = z.object({
  bestMoveUci: z.string().nullable().describe('The best move determined by the AI in UCI notation (e.g., "e2e4", "a7a8q"). Null if no move is possible or determined.'),
  // Removed analysis field
  status: z.enum(['success', 'no_valid_moves', 'error']).describe('Status of the move generation.'),
});
export type FindBestChessMoveOutput = z.infer<typeof FindBestChessMoveOutputSchema>;

export async function findBestChessMove(input: FindBestChessMoveInput): Promise<FindBestChessMoveOutput> {
  // If there are no valid moves, return immediately.
  if (input.validMovesUci.length === 0) {
     console.warn("[findBestChessMove Flow] No valid moves provided in input. Returning 'no_valid_moves'.");
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
    schema: FindBestChessMoveOutputSchema, // Updated schema without analysis
  },
  prompt: `You are a strong chess engine. Your goal is to determine the best possible move given the current board state and the player whose turn it is.

Current Board State (FEN):
{{{boardStateFen}}}

It is currently {{#if (eq playerTurn 'w')}}White's{{else}}Black's{{/if}} turn to move.

Here is a list of all valid moves in UCI notation for the current player:
{{#each validMovesUci}}
- {{this}}
{{/each}}

Analyze the position and select the *single best move* from the provided list of valid moves. Return *only* the chosen move in UCI format (e.g., "e2e4", "g1f3", "a7a8q" for promotion). Do not include any explanation or analysis.

If no valid moves are provided, or if the game state represents a checkmate or stalemate where no move is logically possible (though the list might technically be non-empty in some edge cases), return null for the move.
`,
  // Configure the prompt for strong chess play - temperature 0 for deterministic best move based on model's knowledge
  config: {
    temperature: 0.1, // Low temperature for more deterministic/focused chess analysis
    maxOutputTokens: 10, // Enough for just the UCI move
  }
});

const findBestChessMoveFlow = ai.defineFlow<
  typeof FindBestChessMoveInputSchema,
  typeof FindBestChessMoveOutputSchema
>({
  name: 'findBestChessMoveFlow',
  inputSchema: FindBestChessMoveInputSchema,
  outputSchema: FindBestChessMoveOutputSchema,
}, async input => {
   // Double-check no valid moves case, although handled in the wrapper function too.
   if (input.validMovesUci.length === 0) {
     return { bestMoveUci: null, status: 'no_valid_moves' };
   }

  try {
    console.log("[findBestChessMoveFlow] Calling Gemini prompt with FEN:", input.boardStateFen);
    const {output} = await prompt(input);
    console.log("[findBestChessMoveFlow] Received output from Gemini:", output);

    if (!output) {
      console.error("[findBestChessMoveFlow] Gemini returned no output.");
      return { bestMoveUci: null, status: 'error' };
    }

    // Validate the returned move is actually in the list of valid moves
    if (output.bestMoveUci && !input.validMovesUci.includes(output.bestMoveUci)) {
       console.warn(`[findBestChessMoveFlow] Gemini returned an invalid move: ${output.bestMoveUci}. It's not in the provided valid moves list. Falling back.`);
       // Attempt to return the first valid move as a simple fallback, or indicate error
       // const fallbackMove = input.validMovesUci[0] || null;
       // return { bestMoveUci: fallbackMove, status: fallbackMove ? 'success' : 'error', analysis: `AI suggested an invalid move (${output.bestMoveUci}). Fallback chosen.` };
        return { bestMoveUci: null, status: 'error' }; // No analysis field anymore
    }

     // Ensure status is set correctly based on the move
     if (output.bestMoveUci) {
        // Return only bestMoveUci and status
        return { bestMoveUci: output.bestMoveUci, status: 'success' };
     } else {
        // If Gemini returns null move but status wasn't set, assume no valid moves found by AI
        return { bestMoveUci: null, status: output.status || 'no_valid_moves' }; // No analysis field
     }

  } catch (error) {
    console.error("[findBestChessMoveFlow] Error calling Gemini:", error);
    return { bestMoveUci: null, status: 'error' }; // No analysis field
  }
});
