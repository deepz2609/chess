// 'use server'
'use server';

/**
 * @fileOverview Analyzes a chess move and provides insights.
 *
 * - analyzeGameMove - A function that analyzes a given chess move.
 * - AnalyzeGameMoveInput - The input type for the analyzeGameMove function.
 * - AnalyzeGameMoveOutput - The return type for the analyzeGameMove function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeGameMoveInputSchema = z.object({
  boardStateFen: z.string().describe('The current board state in FEN notation.'),
  moveUci: z.string().describe('The move to analyze in UCI notation.'),
  playerId: z.string().describe('The ID of the player making the move.'),
});

export type AnalyzeGameMoveInput = z.infer<typeof AnalyzeGameMoveInputSchema>;

const AnalyzeGameMoveOutputSchema = z.object({
  analysis: z.string().describe('The AI analysis of the move, including strengths and weaknesses.'),
});

export type AnalyzeGameMoveOutput = z.infer<typeof AnalyzeGameMoveOutputSchema>;

export async function analyzeGameMove(input: AnalyzeGameMoveInput): Promise<AnalyzeGameMoveOutput> {
  return analyzeGameMoveFlow(input);
}

const analyzeGameMovePrompt = ai.definePrompt({
  name: 'analyzeGameMovePrompt',
  input: {
    schema: z.object({
      boardStateFen: z.string().describe('The current board state in FEN notation.'),
      moveUci: z.string().describe('The move to analyze in UCI notation.'),
      playerId: z.string().describe('The ID of the player making the move.'),
    }),
  },
  output: {
    schema: z.object({
      analysis: z.string().describe('The AI analysis of the move, including strengths and weaknesses.'),
    }),
  },
  prompt: `You are a chess grandmaster providing move analysis to chess players.

You will be given the current board state in FEN notation, the move played in UCI notation, and the player ID.

Provide a detailed analysis of the move, including its potential strengths and weaknesses.

Board State (FEN): {{{boardStateFen}}}
Move (UCI): {{{moveUci}}}
Player ID: {{{playerId}}}

Analysis: `,
});

const analyzeGameMoveFlow = ai.defineFlow<
  typeof AnalyzeGameMoveInputSchema,
  typeof AnalyzeGameMoveOutputSchema
>({
  name: 'analyzeGameMoveFlow',
  inputSchema: AnalyzeGameMoveInputSchema,
  outputSchema: AnalyzeGameMoveOutputSchema,
},
async input => {
  const {output} = await analyzeGameMovePrompt(input);
  return output!;
});
