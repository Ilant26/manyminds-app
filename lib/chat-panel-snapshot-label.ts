import { deriveConversationTitleFromQuestion } from '@/lib/conversation-title';

/** Extrait un libellé depuis un snapshot (mémoire ou JSON parsé). */
function formatStoredTitle(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return t.length <= 120 ? t : `${t.slice(0, 117)}…`;
}

export function deriveLabelFromPanelSnapshotRecord(
  snap: Record<string, unknown> | null | undefined
): string | null {
  if (!snap || typeof snap !== 'object') return null;
  const debate = snap.debate as Record<string, unknown> | undefined;
  const rawTitle = debate?.title;
  if (typeof rawTitle === 'string') {
    const tit = formatStoredTitle(rawTitle);
    if (tit) return tit;
  }
  const last =
    typeof snap.lastSubmitted === 'string' ? snap.lastSubmitted : '';
  const q = typeof snap.question === 'string' ? snap.question : '';
  const dq =
    typeof debate?.question === 'string' ? String(debate.question) : '';
  const combined = (last || q || dq).trim();
  if (!combined) return null;
  return deriveConversationTitleFromQuestion(combined);
}

/** Titre « historique » persisté (`debate.title`), si présent. */
export function getChatPanelDebateTitleFromStorage(
  panelId: string
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`mm_chat_panel_state_${panelId}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as {
      debate?: { title?: string | null };
    };
    const t = saved.debate?.title;
    if (typeof t !== 'string' || !t.trim()) return null;
    const out = formatStoredTitle(t);
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Libellé court depuis le snapshot local du panneau (`mm_chat_panel_state_*`),
 * quand `panels[].question` n’est pas encore rempli côté contexte.
 */
export function getChatPanelSnapshotPreview(panelId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`mm_chat_panel_state_${panelId}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as {
      lastSubmitted?: string;
      question?: string;
      debate?: { question?: string };
    };
    return deriveLabelFromPanelSnapshotRecord(
      saved as Record<string, unknown>
    );
  } catch {
    return null;
  }
}
