import 'server-only';

import { getChatWorkspaceByUserId } from '@/lib/db/chat-workspace';
import { parseWorkspacePayload } from '@/lib/chat-workspace-schema';
import type { ChatWorkspaceSsrBootstrap } from '@/lib/chat-workspace-bootstrap-types';

function cloneJson<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

/**
 * Charge le workspace chat depuis Supabase pour le premier rendu (évite un flash « chat vide » au refresh).
 */
export async function loadChatWorkspaceBootstrapForUser(
  appUserId: string
): Promise<ChatWorkspaceSsrBootstrap | null> {
  try {
    const row = await getChatWorkspaceByUserId(appUserId);
    if (!row?.payload) return null;
    const parsed = parseWorkspacePayload(row.payload);
    if (!parsed?.panels?.length) return null;

    const panels = parsed.panels
      .slice(0, 2)
      .map((p) => ({
        id: p.id,
        debateId: p.debateId ?? null,
        question: p.question ?? '',
        synthesis: p.synthesis ?? null,
      }));

    const isSynced = parsed.isSynced === true && panels.length >= 2;

    let panelSnapshots: Record<string, unknown> | undefined;
    if (
      parsed.panelSnapshots &&
      typeof parsed.panelSnapshots === 'object' &&
      Object.keys(parsed.panelSnapshots).length > 0
    ) {
      panelSnapshots = cloneJson(parsed.panelSnapshots) as Record<string, unknown>;
    }

    return { panels, isSynced, panelSnapshots };
  } catch {
    return null;
  }
}
