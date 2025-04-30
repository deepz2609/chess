'use server';
/**
 * @fileOverview An AI agent that generates chess opening tips based on the player's first few moves.
 *
 * - generateChessOpeningTips - A function that handles the generation of chess opening tips.
 * - GenerateChessOpeningTipsInput - The input type for the generateChessOpeningTips function.
 * - GenerateChessOpeningTipsOutput - The return type for the generateChessOpeningTips function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateChessOpeningTipsInputSchema = z.object({
  moves: z.string().describe('The sequence of moves made by the player in algebraic notation, separated by spaces.'),
});
export type GenerateChessOpeningTipsInput = z.infer<typeof GenerateChessOpeningTipsInputSchema>;

const GenerateChessOpeningTipsOutputSchema = z.object({
  tips: z.string().describe('AI-generated tips on chess openings based on the provided moves.'),
});
export type GenerateChessOpeningTipsOutput = z.infer<typeof GenerateChessOpeningTipsOutputSchema>;

export async function generateChessOpeningTips(input: GenerateChessOpeningTipsInput): Promise<GenerateChessOpeningTipsOutput> {
  return generateChessOpeningTipsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChessOpeningTipsPrompt',
  input: {
    schema: z.object({
      moves: z.string().describe('The sequence of moves made by the player in algebraic notation, separated by spaces.'),
    }),
  },
  output: {
    schema: z.object({
      tips: z.string().describe('AI-generated tips on chess openings based on the provided moves.'),
    }),
  },
  prompt: `You are a chess grandmaster providing tips to chess players.

  Based on the following sequence of moves, provide relevant opening tips.

Moves: {{{moves}}}
`,
});

const generateChessOpeningTipsFlow = ai.defineFlow<
  typeof GenerateChessOpeningTipsInputSchema,
  typeof GenerateChessOpeningTipsOutputSchema
>({
  name: 'generateChessOpeningTipsFlow',
  inputSchema: GenerateChessOpeningTipsInputSchema,
  outputSchema: GenerateChessOpeningTipsOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
