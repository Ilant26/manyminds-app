import type { ConversationTurnRecord } from '@/types';

const DEFAULT_MAX_TOTAL = 14_000;
const DEFAULT_MAX_SYNTHESIS_PER_TURN = 2_500;
const DEFAULT_MAX_QUESTION_PER_TURN = 1_500;

/**
 * Formate les tours déjà terminés pour le prompt (suivi dans le même débat).
 * Tronque pour rester sous les limites de contexte.
 */
export function buildThreadHistoryPrompt(
  turns: ConversationTurnRecord[],
  options?: {
    maxTotalChars?: number;
    maxSynthesisPerTurn?: number;
    maxQuestionPerTurn?: number;
  }
): string | null {
  if (!turns.length) return null;

  const maxTotal = options?.maxTotalChars ?? DEFAULT_MAX_TOTAL;
  const maxSynth = options?.maxSynthesisPerTurn ?? DEFAULT_MAX_SYNTHESIS_PER_TURN;
  const maxQ = options?.maxQuestionPerTurn ?? DEFAULT_MAX_QUESTION_PER_TURN;

  const parts: string[] = [];
  let used = 0;

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    let q = (t.question ?? '').trim();
    if (q.length > maxQ) q = `${q.slice(0, maxQ - 1)}…`;
    let syn = (t.synthesis ?? '').trim();
    if (syn.length > maxSynth) syn = `${syn.slice(0, maxSynth - 1)}…`;

    const block = [
      `### Turn ${i + 1}`,
      `**User:** ${q || '(empty)'}`,
      syn ? `**Consensus answer (ManyMinds):** ${syn}` : '**Consensus answer:** (none)',
    ].join('\n');

    if (used + block.length + 2 > maxTotal) {
      parts.push('… (earlier turns omitted for length)');
      break;
    }
    parts.push(block);
    used += block.length + 2;
  }

  return parts.join('\n\n');
}
