import type { ChatTurnSnapshot } from '@/types';

/** Limite de prudence pour ne pas exploser le corps de requête / le prompt. */
const MAX_LINKED_THREAD_CHARS = 120_000;

const TRUNC_MID_MARKER =
  '\n\n… [portion centrale omise — limite de taille du contexte synchronisé] …\n\n';

/**
 * Repli quand `panelLinkedThreads` est encore vide (race au moment du sync / 1er paint) :
 * au moins question + synthèse du workspace, même format que le fil complet.
 */
export function formatMinimalLinkedContextFromPanelMeta(
  question: string,
  synthesis: string
): string | null {
  const q = question.trim();
  const syn = synthesis.trim();
  if (!q && !syn) return null;
  const parts: string[] = ['### Tour 1'];
  if (q) parts.push(`**Question (panneau lié) :**\n${q}`);
  if (syn) parts.push(`**Synthèse ManyMinds :**\n${syn}`);
  return parts.join('\n').trim();
}

type PanelStreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

/**
 * Texte envoyé au panneau synchronisé : tous les tours terminés + le tour en cours (question / synthèse).
 */
export function formatChatPanelThreadForLinkedContext(
  turnHistory: ChatTurnSnapshot[],
  lastSubmitted: string,
  synthesis: string,
  status: PanelStreamStatus
): string {
  const parts: string[] = [];
  let n = 1;

  for (const turn of turnHistory) {
    const q = turn.question?.trim() ?? '';
    const syn = turn.synthesis?.trim() ?? '';
    if (!q && !syn) continue;
    parts.push(`### Tour ${n}`);
    if (q) parts.push(`**Question (panneau lié) :**\n${q}`);
    if (syn) parts.push(`**Synthèse ManyMinds :**\n${syn}`);
    parts.push('');
    n++;
  }

  const qCur = lastSubmitted.trim();
  const synCur = (synthesis ?? '').trim();
  const lastHist = turnHistory[turnHistory.length - 1];
  const dupLast =
    lastHist != null &&
    (lastHist.question?.trim() ?? '') === qCur &&
    (lastHist.synthesis?.trim() ?? '') === synCur;

  const hasActiveRound =
    status === 'loading' ||
    status === 'streaming' ||
    status === 'done' ||
    status === 'error' ||
    (status === 'idle' && (Boolean(qCur && synCur) || Boolean(qCur && turnHistory.length > 0)));

  if (hasActiveRound && (qCur || synCur || status === 'loading' || status === 'streaming') && !dupLast) {
    parts.push(`### Tour ${n}`);
    if (qCur) parts.push(`**Question (panneau lié) :**\n${qCur}`);
    if (synCur) {
      parts.push(`**Synthèse ManyMinds :**\n${synCur}`);
    } else if (status === 'loading' || status === 'streaming') {
      parts.push('**Synthèse ManyMinds :** _(en cours…)_');
    }
    parts.push('');
  }

  let out = parts.join('\n').trim();

  if (out.length > MAX_LINKED_THREAD_CHARS) {
    const budget = MAX_LINKED_THREAD_CHARS - TRUNC_MID_MARKER.length;
    const headLen = Math.max(0, Math.floor(budget / 2));
    const tailLen = Math.max(0, budget - headLen);
    if (headLen + tailLen >= out.length) {
      out = out.slice(0, MAX_LINKED_THREAD_CHARS);
    } else {
      out =
        out.slice(0, headLen) + TRUNC_MID_MARKER + out.slice(out.length - tailLen);
    }
  }

  return out;
}
