import {
  formatChatPanelThreadForLinkedContext,
  formatMinimalLinkedContextFromPanelMeta,
} from '@/lib/format-chat-panel-thread-for-sync';
import type { ChatTurnSnapshot } from '@/types';

type PanelStreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

function isPanelStreamStatus(s: unknown): s is PanelStreamStatus {
  return (
    s === 'idle' ||
    s === 'loading' ||
    s === 'streaming' ||
    s === 'done' ||
    s === 'error'
  );
}

function coerceTurnHistory(raw: unknown): ChatTurnSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean) as ChatTurnSnapshot[];
}

/**
 * Reconstruit le même texte que `onLinkedThreadReady` à partir d’un snapshot panneau (mémoire ou LS).
 */
export function formatLinkedContextFromPanelSnapshot(snap: unknown): string | null {
  if (!snap || typeof snap !== 'object') return null;
  const s = snap as Record<string, unknown>;
  const turnHistory = coerceTurnHistory(s.turnHistory);
  const lastSubmitted = typeof s.lastSubmitted === 'string' ? s.lastSubmitted : '';
  const debate = s.debate as Record<string, unknown> | undefined;
  const synthesis = typeof debate?.synthesis === 'string' ? debate.synthesis : '';
  const status = isPanelStreamStatus(s.debateStatus) ? s.debateStatus : 'idle';

  const out = formatChatPanelThreadForLinkedContext(
    turnHistory,
    lastSubmitted,
    synthesis,
    status
  );
  return out.trim().length > 0 ? out : null;
}

function readPanelSnapshotFromLocalStorage(panelId: string): unknown {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(`mm_chat_panel_state_${panelId}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export type PartnerPanelMeta = {
  id: string;
  question: string;
  synthesis: string | null;
};

/** Synthèse incrémentale : déclenchée seulement si `turns.length > SUMMARY_THRESHOLD`. */
export const PARTNER_MEMORY_SUMMARY_THRESHOLD = 5;
/** Alias explicite (spec) : résumer si **strictement plus** que 5 tours. */
export const SUMMARY_THRESHOLD = PARTNER_MEMORY_SUMMARY_THRESHOLD;

/** Nombre de tours récents gardés en intégral après résumé des tours plus anciens. */
export const PARTNER_MEMORY_RECENT_TURNS = 3;
export const RECENT_TURNS_TO_KEEP = PARTNER_MEMORY_RECENT_TURNS;

export interface PartnerMemoryTurn {
  question: string;
  synthesis: string;
}

/**
 * Snapshot partenaire : mémoire (ref) puis localStorage.
 */
export function getPartnerPanelSnapshot(
  partnerId: string,
  panelSnapshotsMemory: Record<string, unknown>
): unknown {
  const m = panelSnapshotsMemory[partnerId];
  if (m != null && typeof m === 'object') return m;
  return readPanelSnapshotFromLocalStorage(partnerId);
}

/**
 * Tours Q/R pour la mémoire sync (aligné sur la logique du fil lié).
 */
export function extractPartnerMemoryTurnsFromSnapshot(snap: unknown): PartnerMemoryTurn[] {
  if (!snap || typeof snap !== 'object') return [];
  const s = snap as Record<string, unknown>;
  const turnHistory = coerceTurnHistory(s.turnHistory);
  const out: PartnerMemoryTurn[] = [];

  for (const turn of turnHistory) {
    const q = turn.question?.trim() ?? '';
    const syn = turn.synthesis?.trim() ?? '';
    if (!q && !syn) continue;
    out.push({ question: q, synthesis: syn });
  }

  const lastSubmitted = typeof s.lastSubmitted === 'string' ? s.lastSubmitted.trim() : '';
  const debate = s.debate as Record<string, unknown> | undefined;
  const synCur = typeof debate?.synthesis === 'string' ? debate.synthesis.trim() : '';
  const status = isPanelStreamStatus(s.debateStatus) ? s.debateStatus : 'idle';

  const lastHist = out[out.length - 1];
  const dupLast =
    lastHist != null &&
    lastHist.question === lastSubmitted &&
    lastHist.synthesis === synCur;

  const hasActiveRound =
    status === 'loading' ||
    status === 'streaming' ||
    status === 'done' ||
    status === 'error' ||
    (status === 'idle' &&
      (Boolean(lastSubmitted && synCur) || Boolean(lastSubmitted && out.length > 0)));

  if (
    hasActiveRound &&
    (lastSubmitted || synCur || status === 'loading' || status === 'streaming') &&
    !dupLast
  ) {
    const synForTurn =
      synCur ||
      (status === 'loading' || status === 'streaming' ? '_(en cours…)_' : '');
    if (lastSubmitted || synForTurn) {
      out.push({
        question: lastSubmitted,
        synthesis: synForTurn,
      });
    }
  }

  return out;
}

/** Texte brut de secours (API ou pas de résumé). */
export function formatPlainPartnerTurnsContext(turns: PartnerMemoryTurn[]): string {
  return turns
    .map(
      (t, i) =>
        `Turn ${i + 1}:\nQ: ${t.question}\nA: ${t.synthesis}`
    )
    .join('\n\n---\n\n');
}

export function fingerprintPartnerMemoryTurns(turns: PartnerMemoryTurn[]): string {
  if (turns.length === 0) return '0';
  const last = turns[turns.length - 1]!;
  return `${turns.length}:${last.question.length}:${last.synthesis.length}:${last.synthesis.slice(0, 120)}`;
}

/**
 * Résumé Haiku des tours anciens + tours récents en clair. À n’appeler que côté serveur (route API).
 */
export async function buildSmartContext(turns: PartnerMemoryTurn[]): Promise<string> {
  if (turns.length <= PARTNER_MEMORY_SUMMARY_THRESHOLD) {
    return formatPlainPartnerTurnsContext(turns);
  }

  if (typeof window !== 'undefined') {
    return formatPlainPartnerTurnsContext(turns);
  }

  const oldTurns = turns.slice(0, turns.length - PARTNER_MEMORY_RECENT_TURNS);
  const recentTurns = turns.slice(turns.length - PARTNER_MEMORY_RECENT_TURNS);

  const oldContext = oldTurns
    .map((t, i) => `Turn ${i + 1}: Q: ${t.question} | A: ${t.synthesis}`)
    .join('\n');

  let summary = '';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model =
    process.env.ANTHROPIC_PARTNER_SUMMARY_MODEL?.trim() ||
    process.env.ANTHROPIC_HAIKU_MODEL?.trim() ||
    'claude-haiku-4-5';

  try {
    if (apiKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey });
      const summaryMsg = await anthropic.messages.create({
        model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Summarize these conversation turns in 3-5 sentences, keeping the key facts, decisions and conclusions:\n\n${oldContext}`,
          },
        ],
      });
      const block = summaryMsg.content[0];
      summary = block?.type === 'text' ? block.text : '';
    }
  } catch {
    summary = '';
  }

  if (!summary.trim()) {
    return formatPlainPartnerTurnsContext(turns);
  }

  const recentContext = recentTurns
    .map(
      (t, i) =>
        `Recent turn ${i + 1}:\nQ: ${t.question}\nA: ${t.synthesis}`
    )
    .join('\n\n---\n\n');

  return `[Summary of earlier conversation]\n${summary.trim()}\n\n[Recent exchanges]\n${recentContext}`;
}

/**
 * Ordre : fil React à jour (stream) → snapshot mémoire → snapshot LS → métadonnées workspace.
 */
export function resolvePartnerLinkedContext(
  partner: PartnerPanelMeta,
  panelLinkedThreads: Record<string, string>,
  panelSnapshotsMemory: Record<string, unknown>
): string | null {
  const fromReact = panelLinkedThreads[partner.id]?.trim();
  if (fromReact) return fromReact;

  const fromMem = formatLinkedContextFromPanelSnapshot(panelSnapshotsMemory[partner.id]);
  if (fromMem) return fromMem;

  const fromLs = formatLinkedContextFromPanelSnapshot(
    readPanelSnapshotFromLocalStorage(partner.id)
  );
  if (fromLs) return fromLs;

  return formatMinimalLinkedContextFromPanelMeta(
    partner.question,
    partner.synthesis ?? ''
  );
}
