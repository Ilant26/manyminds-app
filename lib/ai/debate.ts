import type { AIModel, AIResponse } from '@/types';
import { callAIModel } from './callers';
import { calculateConsensus } from './consensus';
import { generateSynthesis } from './synthesis';

export interface DebateResult {
  responses: AIResponse[];
  consensusScore: number;
  hasDisagreement: boolean;
  disagreements: import('@/types').DisagreementDetail[];
  synthesis: string;
}

export async function runDebate(
  models: AIModel[],
  question: string
): Promise<DebateResult> {
  const responses: AIResponse[] = [];
  const results = await Promise.allSettled(
    models.map((model) => callAIModel(model, question))
  );
  for (const r of results) {
    if (r.status === 'fulfilled') {
      responses.push(r.value);
    }
  }

  const { score, disagreements } = await calculateConsensus(responses);
  const synthesis = await generateSynthesis(question, responses);

  return {
    responses,
    consensusScore: score,
    hasDisagreement: score >= 0 && score < 60,
    disagreements,
    synthesis,
  };
}
