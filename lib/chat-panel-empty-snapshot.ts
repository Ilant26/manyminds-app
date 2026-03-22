/**
 * Snapshot LS / workspace pour un panneau vidé (Close / Archive / reset).
 * Important : garder une entrée LS non vide évite que le bootstrap SSR réinjecte une vieille conversation.
 */
export const CHAT_PANEL_SNAPSHOT_VERSION = 2;

export function createEmptyPanelSnapshotRecord(): Record<string, unknown> {
  return {
    v: CHAT_PANEL_SNAPSHOT_VERSION,
    mode: 'quick',
    question: '',
    lastSubmitted: '',
    turnHistory: [],
    debateStatus: 'idle',
    debateError: null,
    messageScrollTop: 0,
    debate: {
      id: null,
      question: '',
      ai_responses: [],
      consensus_score: -1,
      has_disagreement: false,
      disagreement_details: [],
      synthesis: '',
    },
  };
}
