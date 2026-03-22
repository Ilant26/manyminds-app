/**
 * Short label for history / project lists: first non-empty line, trimmed & capped.
 * Does not mutate the full `question` stored for the AI thread.
 */
export function deriveConversationTitleFromQuestion(question: string): string {
  const lines = question.split(/\r?\n/);
  const first = lines.find((l) => l.trim().length > 0) ?? question;
  const t = first.trim();
  if (t.length <= 120) return t;
  return `${t.slice(0, 117)}…`;
}

import { splitMergedQuestionParts } from '@/lib/debate-question-merge-split';

/** Nombre de tours utilisateur (1 débat = 1 ligne historique, plusieurs échanges possibles). */
export function conversationTurnCount(d: {
  question?: string;
  conversation_turns?: unknown[] | null;
}): number {
  const n = d.conversation_turns?.length;
  if (typeof n === 'number' && n > 0) return n;
  const parts = splitMergedQuestionParts(d.question ?? '');
  if (parts.length > 1) return parts.length;
  return parts.length > 0 ? 1 : 0;
}

/**
 * Libellé liste : titre persisté, sinon 1ʳᵉ question du 1ᵉʳ tour,
 * sinon 1ʳᵉ partie du fil fusionné (évite un titre = tout le prompt concaténé).
 */
export function conversationListLabel(d: {
  title?: string | null;
  question: string;
  conversation_turns?: { question?: string }[];
}): string {
  const raw = d.title?.trim();
  if (raw) return raw;
  const firstTurnQ = d.conversation_turns?.[0]?.question;
  if (firstTurnQ?.trim()) {
    return deriveConversationTitleFromQuestion(firstTurnQ);
  }
  const parts = splitMergedQuestionParts(d.question ?? '');
  if (parts.length > 0) {
    return deriveConversationTitleFromQuestion(parts[0] ?? '');
  }
  return deriveConversationTitleFromQuestion(d.question ?? '');
}
