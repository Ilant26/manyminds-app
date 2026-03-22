import type { ChatTurnSnapshot, Debate } from '@/types';
import { splitMergedQuestionParts } from '@/lib/debate-question-merge-split';

type ConvTurn = NonNullable<Debate['conversation_turns']>[number];

function recordToSnapshot(debateId: string, t: ConvTurn, stableId: string): ChatTurnSnapshot {
  return {
    id: stableId,
    question: t.question,
    debateId,
    responses: t.ai_responses,
    consensusScore: t.consensus_score,
    hasDisagreement: t.has_disagreement,
    disagreements: t.disagreement_details,
    synthesis: t.synthesis,
    mode: t.mode === 'quick' ? 'quick' : 'deep',
    createdAt: new Date(t.completed_at).getTime(),
  };
}

/** Questions sans réponses persistées (legacy / fil uniquement dans `question`). */
function legacyQuestionOnlySnapshots(
  debateId: string,
  questions: string[],
  baseTime: number
): ChatTurnSnapshot[] {
  return questions.map((question, i) => ({
    id: `${debateId}-legacy-q-${i}`,
    question,
    debateId,
    responses: [],
    consensusScore: -1,
    hasDisagreement: false,
    disagreements: [],
    synthesis: '',
    mode: 'quick' as const,
    createdAt: baseTime - (questions.length - i) * 1000,
  }));
}

/**
 * Un tour en base peut contenir plusieurs questions collées (` --- `) dans un seul champ `question`.
 * → plusieurs bulles utilisateur, la dernière garde la synthèse / réponses du tour.
 */
function turnToPastSnapshots(debateId: string, turn: ConvTurn, turnIndex: number): ChatTurnSnapshot[] {
  const parts = splitMergedQuestionParts(turn.question ?? '');
  if (parts.length <= 1) {
    return [recordToSnapshot(debateId, turn, `${debateId}-stored-${turnIndex}`)];
  }
  const baseTime = Number.isFinite(Date.parse(turn.completed_at))
    ? new Date(turn.completed_at).getTime()
    : Date.now();
  const leads = legacyQuestionOnlySnapshots(debateId, parts.slice(0, -1), baseTime).map((snap, j) => ({
    ...snap,
    id: `${debateId}-turn${turnIndex}-q${j}`,
  }));
  const lastQ = parts[parts.length - 1]!.trim();
  const mainTurn: ConvTurn = { ...turn, question: lastQ };
  const main = recordToSnapshot(debateId, mainTurn, `${debateId}-stored-${turnIndex}-main`);
  return [...leads, main];
}

/**
 * Découpe un débat chargé depuis l’API : tours passés → historique du panneau, dernier tour → useDebate.
 * Gère aussi les lignes legacy où seul `question` contient le fil fusionné (`---`).
 */
export function splitDebateForChatPanel(db: Debate): {
  turnHistory: ChatTurnSnapshot[];
  latestDebateSlice: Debate;
} {
  const turns = db.conversation_turns;
  const mergedParts = splitMergedQuestionParts(db.question ?? '');

  if (turns && turns.length > 1) {
    const last = turns[turns.length - 1]!;
    const historyExpanded = turns
      .slice(0, -1)
      .flatMap((t, i) => turnToPastSnapshots(db.id, t, i));
    const lastExpanded = turnToPastSnapshots(db.id, last, turns.length - 1);
    const turnHistory = [...historyExpanded, ...lastExpanded.slice(0, -1)];
    const finalSnap = lastExpanded[lastExpanded.length - 1]!;
    const latestTurnRecord: ConvTurn = {
      ...last,
      question: finalSnap.question,
    };
    const latestDebateSlice: Debate = {
      ...db,
      question: latestTurnRecord.question,
      ai_responses: latestTurnRecord.ai_responses,
      consensus_score: latestTurnRecord.consensus_score,
      has_disagreement: latestTurnRecord.has_disagreement,
      disagreement_details: latestTurnRecord.disagreement_details,
      synthesis: latestTurnRecord.synthesis,
      conversation_turns: [latestTurnRecord],
    };
    return { turnHistory, latestDebateSlice };
  }

  if (turns?.length === 1 && mergedParts.length >= 2) {
    const last = turns[0]!;
    const lastPart = mergedParts[mergedParts.length - 1]!;
    const historyQs = mergedParts.slice(0, -1);
    const baseTime = Number.isFinite(Date.parse(last.completed_at))
      ? new Date(last.completed_at).getTime()
      : Date.now();
    const turnHistory = legacyQuestionOnlySnapshots(db.id, historyQs, baseTime);
    const displayQuestion = lastPart.trim();

    const latestDebateSlice: Debate = {
      ...db,
      question: displayQuestion,
      ai_responses: last.ai_responses,
      consensus_score: last.consensus_score,
      has_disagreement: last.has_disagreement,
      disagreement_details: last.disagreement_details,
      synthesis: last.synthesis,
      conversation_turns: [
        {
          ...last,
          question: displayQuestion,
        },
      ],
    };
    return { turnHistory, latestDebateSlice };
  }

  /** 1 tour JSON mais plusieurs questions dans `turn.question` (sans fil dans la colonne `question`). */
  if (turns?.length === 1) {
    const expanded = turnToPastSnapshots(db.id, turns[0]!, 0);
    if (expanded.length > 1) {
      const finalSnap = expanded[expanded.length - 1]!;
      const latestTurnRecord: ConvTurn = {
        ...turns[0]!,
        question: finalSnap.question,
      };
      const latestDebateSlice: Debate = {
        ...db,
        question: latestTurnRecord.question,
        ai_responses: latestTurnRecord.ai_responses,
        consensus_score: latestTurnRecord.consensus_score,
        has_disagreement: latestTurnRecord.has_disagreement,
        disagreement_details: latestTurnRecord.disagreement_details,
        synthesis: latestTurnRecord.synthesis,
        conversation_turns: [latestTurnRecord],
      };
      return { turnHistory: expanded.slice(0, -1), latestDebateSlice };
    }
  }

  if (!turns?.length && mergedParts.length >= 2) {
    const lastQ = mergedParts[mergedParts.length - 1]!;
    const historyQs = mergedParts.slice(0, -1);
    const baseTime = db.updated_at
      ? new Date(db.updated_at).getTime()
      : db.created_at
        ? new Date(db.created_at).getTime()
        : Date.now();
    const turnHistory = legacyQuestionOnlySnapshots(db.id, historyQs, baseTime);
    const latestDebateSlice: Debate = {
      ...db,
      question: lastQ,
    };
    return { turnHistory, latestDebateSlice };
  }

  return { turnHistory: [], latestDebateSlice: db };
}
