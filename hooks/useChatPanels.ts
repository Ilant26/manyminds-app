'use client';

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { ChatWorkspacePayload } from '@/lib/chat-workspace-schema';
import { parseWorkspacePayload } from '@/lib/chat-workspace-schema';
import type { ChatWorkspaceSsrBootstrap } from '@/lib/chat-workspace-bootstrap-types';
import { createEmptyPanelSnapshotRecord } from '@/lib/chat-panel-empty-snapshot';
import { deriveLabelFromPanelSnapshotRecord } from '@/lib/chat-panel-snapshot-label';
import {
  extractPartnerMemoryTurnsFromSnapshot,
  fingerprintPartnerMemoryTurns,
  getPartnerPanelSnapshot,
  PARTNER_MEMORY_SUMMARY_THRESHOLD,
  resolvePartnerLinkedContext,
  type PartnerMemoryTurn,
} from '@/lib/linked-context-from-panel-snapshot';

export interface Panel {
  id: string;
  debateId: string | null;
  question: string;
  synthesis: string | null;
  /** Historique Q/R (mise à jour avec `updatePanelSynthesis`, fusion sur la même question en stream). */
  turns?: PartnerMemoryTurn[];
}

const CHAT_PANELS_STORAGE_KEY = 'mm_chat_panels_state_v1';
/** Préférence plein écran : localStorage (survit navigation + refresh ; sessionStorage en secours / migration). */
const MM_CHAT_FULLSCREEN_LS_KEY = 'mm_chat_fullscreen_panel_id_v1';
const MM_CHAT_FULLSCREEN_SS_LEGACY_KEY = 'mm_chat_fullscreen_panel_id_v1';
const PANELS_SNAPSHOT_VERSION = 2;

function persistMmFullscreenPanelId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage.setItem(MM_CHAT_FULLSCREEN_LS_KEY, id);
    } else {
      window.localStorage.removeItem(MM_CHAT_FULLSCREEN_LS_KEY);
    }
    try {
      window.sessionStorage.removeItem(MM_CHAT_FULLSCREEN_SS_LEGACY_KEY);
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

function readStoredFullscreenPanelId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromLs = window.localStorage.getItem(MM_CHAT_FULLSCREEN_LS_KEY);
    if (fromLs) return fromLs;
    const fromSs = window.sessionStorage.getItem(MM_CHAT_FULLSCREEN_SS_LEGACY_KEY);
    if (fromSs) {
      window.localStorage.setItem(MM_CHAT_FULLSCREEN_LS_KEY, fromSs);
      window.sessionStorage.removeItem(MM_CHAT_FULLSCREEN_SS_LEGACY_KEY);
      return fromSs;
    }
  } catch {
    // ignore
  }
  return null;
}

type PanelsStoragePayload = {
  v?: number;
  panels: Panel[];
  isSynced?: boolean;
};

/**
 * Applique les snapshots distants seulement si la clé LS n’existe pas encore.
 * Sinon on écrase l’état local (navigateur) avec une version serveur potentiellement plus vieille.
 */
function applyRemoteSnapshotsOnlyMissingLocalKeys(
  snapshots: Record<string, unknown> | undefined
) {
  if (!snapshots || typeof window === 'undefined') return;
  for (const [id, snap] of Object.entries(snapshots)) {
    const key = `mm_chat_panel_state_${id}`;
    if (window.localStorage.getItem(key) != null) continue;
    try {
      window.localStorage.setItem(key, JSON.stringify(snap));
    } catch {
      // ignore
    }
  }
}

/** Snapshot complet d’un panneau : priorité au LS (ChatPanel y écrit en continu). */
function buildPanelSnapshotsForPersist(
  panelIds: string[],
  memory: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of panelIds) {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`mm_chat_panel_state_${id}`);
        if (raw) {
          out[id] = JSON.parse(raw) as unknown;
          continue;
        }
      } catch {
        // ignore
      }
    }
    if (memory[id] != null) out[id] = memory[id];
  }
  return out;
}

/** Métadonnées workspace alignées sur le snapshot LS (question / débat / synthèse). */
function derivePanelFromSnapshotJson(snap: unknown, fallback: Panel): Panel {
  if (!snap || typeof snap !== 'object') return fallback;
  const s = snap as Record<string, unknown>;
  const debate = s.debate as Record<string, unknown> | undefined;
  const lastSubmitted =
    typeof s.lastSubmitted === 'string' ? s.lastSubmitted.trim() : '';
  const debateIdRaw = debate?.id;
  const debateId =
    typeof debateIdRaw === 'string' && debateIdRaw.length > 0 ? debateIdRaw : null;
  const synthesisRaw = debate?.synthesis;
  const synthesis =
    typeof synthesisRaw === 'string' && synthesisRaw.length > 0
      ? synthesisRaw
      : null;
  const dq = typeof debate?.question === 'string' ? debate.question.trim() : '';
  const question = lastSubmitted || dq || fallback.question;
  return {
    id: fallback.id,
    debateId: debateId ?? fallback.debateId,
    question,
    synthesis: synthesis ?? fallback.synthesis,
    turns: fallback.turns,
  };
}

function readPanelSnapshotsFromLocalStorage(panelIds: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof window === 'undefined') return out;
  for (const id of panelIds) {
    try {
      const raw = window.localStorage.getItem(`mm_chat_panel_state_${id}`);
      if (raw) out[id] = JSON.parse(raw) as unknown;
    } catch {
      // ignore
    }
  }
  return out;
}

const DEFAULT_PANELS: Panel[] = [
  { id: 'panel-1', debateId: null, question: '', synthesis: null },
];

/** 2ᵉ slot : id fixe (pas `Date.now`) pour que LS / sync distante / `mm_chat_panel_state_*` restent alignés. */
const SECOND_PANEL_ID = 'panel-2';

function normalizePanelsFromBootstrap(
  bootstrap: ChatWorkspaceSsrBootstrap | null
): Panel[] {
  if (!bootstrap?.panels?.length) return DEFAULT_PANELS;
  const restored = bootstrap.panels.filter((p) => typeof p?.id === 'string');
  if (restored.length === 0) return DEFAULT_PANELS;
  return restored.slice(0, 2).map((p) => ({
    id: p.id,
    debateId: p.debateId ?? null,
    question: p.question ?? '',
    synthesis: p.synthesis ?? null,
  }));
}

function cloneSnapshots(
  snapshots: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!snapshots || typeof snapshots !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(snapshots)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Lecture LS — à n’utiliser que dans useLayoutEffect (pas dans useState) pour l’hydratation Next. */
function readInitialWorkspaceFromLocalStorage(): {
  panels: Panel[];
  isSynced: boolean;
} {
  if (typeof window === 'undefined') {
    return { panels: DEFAULT_PANELS, isSynced: false };
  }
  try {
    const raw = window.localStorage.getItem(CHAT_PANELS_STORAGE_KEY);
    if (!raw) {
      return { panels: DEFAULT_PANELS, isSynced: false };
    }
    const parsed = JSON.parse(raw) as PanelsStoragePayload;
    const restored = (parsed?.panels ?? []).filter((p) => typeof p?.id === 'string');
    if (restored.length === 0) {
      return { panels: DEFAULT_PANELS, isSynced: false };
    }
    const panels = restored.slice(0, 2).map((p) => ({
      id: p.id,
      debateId: p.debateId ?? null,
      question: p.question ?? '',
      synthesis: p.synthesis ?? null,
    }));
    const isSynced = parsed.isSynced === true && restored.length >= 2;
    return { panels, isSynced };
  } catch {
    return { panels: DEFAULT_PANELS, isSynced: false };
  }
}

/** Même disposition / métadonnées panneaux : compare les panneaux avant/après sync distante. */
function panelsWorkspaceEqual(a: Panel[], b: Panel[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!y || x.id !== y.id) return false;
    if (x.debateId !== y.debateId) return false;
    if ((x.question ?? '') !== (y.question ?? '')) return false;
    if ((x.synthesis ?? '') !== (y.synthesis ?? '')) return false;
  }
  return true;
}

export interface UseChatPanelsOptions {
  /** Connecté Clerk : sync cross-appareils via Supabase. */
  syncRemote?: boolean;
  /**
   * `false` hors route /chat : évite `JSON.stringify` énorme (snapshots × panneaux) qui fige le thread
   * et rend la sidebar / la navigation inutilisables.
   */
  workspaceRouteActive?: boolean;
  /** Workspace préchargé côté serveur (1er rendu = contenu DB, sans attendre GET /api). */
  workspaceSsr?: ChatWorkspaceSsrBootstrap | null;
}

export function useChatPanels(options: UseChatPanelsOptions = {}) {
  const { syncRemote = false, workspaceRouteActive = true, workspaceSsr } = options;

  /**
   * Valeur figée au 1er rendu client (alignée SSR) : ne pas réagir si la prop change après coup.
   */
  const [ssrBootstrap] = useState<ChatWorkspaceSsrBootstrap | null>(
    () => workspaceSsr ?? null
  );

  /**
   * Avec bootstrap serveur : panneaux DB dès le 1er paint. Sinon DEFAULT_PANELS ; LS appliqué
   * dans useLayoutEffect seulement si une clé `mm_chat_panels_state_v1` existe (évite d’écraser le SSR).
   */
  const [panels, setPanels] = useState<Panel[]>(() =>
    normalizePanelsFromBootstrap(ssrBootstrap)
  );
  /** `true` après lecture LS dans useLayoutEffect (même valeur SSR + 1er rendu client). */
  const [storageReady, setStorageReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(!syncRemote);
  const storageReadyRef = useRef(false);
  storageReadyRef.current = storageReady;
  const remoteReadyRef = useRef(!syncRemote);
  remoteReadyRef.current = remoteReady;

  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  /** Évite de relancer la synthèse mémoire à chaque tick de `synthesis` (stream). */
  const panelsStableKey = useMemo(
    () => panels.map((p) => `${p.id}:${p.debateId ?? ''}`).join('|'),
    [panels]
  );

  const [isSynced, setIsSynced] = useState(() => ssrBootstrap?.isSynced ?? false);
  const isSyncedRef = useRef(isSynced);
  isSyncedRef.current = isSynced;

  const panelSnapshotsRef = useRef<Record<string, unknown>>(
    cloneSnapshots(ssrBootstrap?.panelSnapshots)
  );

  const [replaceModal, setReplaceModal] = useState<{
    open: boolean;
    newDebateId?: string;
    newQuestion?: string;
  }>({ open: false });

  const [fullscreenPanelId, setFullscreenPanelId] = useState<string | null>(null);

  const enterFullscreen = useCallback((id: string) => {
    persistMmFullscreenPanelId(id);
    setFullscreenPanelId(id);
  }, []);

  const exitFullscreen = useCallback(() => {
    persistMmFullscreenPanelId(null);
    setFullscreenPanelId(null);
  }, []);

  const toggleFullscreen = useCallback((id: string) => {
    setFullscreenPanelId((prev) => {
      const next = prev === id ? null : id;
      persistMmFullscreenPanelId(next);
      return next;
    });
  }, []);

  const [transmitting, setTransmitting] = useState(false);
  /** Fil complet (tous les tours) exposé au panneau synchronisé — clé = panel id. */
  const [panelLinkedThreads, setPanelLinkedThreads] = useState<Record<string, string>>({});
  /** Contexte partenaire résumé (sync + > 5 tours) — complété par `/api/summarize-context`. */
  const [smartPartnerLinkedContext, setSmartPartnerLinkedContext] = useState<
    Record<string, string>
  >({});
  const smartPartnerFetchKeyRef = useRef<Record<string, string>>({});
  const transmittingTimeoutRef = useRef<number | null>(null);
  const remoteSaveTimeoutRef = useRef<number | null>(null);
  /** Évite JSON.stringify(localStorage) à chaque chunk de synthèse (2 panneaux → UI figée). */
  const flushPanelsDebounceRef = useRef<number | null>(null);

  const canAddPanel = panels.length < 2;

  const openReplaceModal = useCallback((newDebateId?: string, newQuestion?: string) => {
    setReplaceModal({ open: true, newDebateId, newQuestion });
  }, []);

  // Quand la sync distante s’active (ex. Clerk vient de charger), bloquer les PUT jusqu’au GET.
  useEffect(() => {
    if (!syncRemote) {
      remoteReadyRef.current = true;
      setRemoteReady(true);
      return;
    }
    remoteReadyRef.current = false;
    setRemoteReady(false);
  }, [syncRemote]);

  /** Masque le grip de la sidebar uniquement sur /chat en plein écran (hors chat : pas de classe). */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const cls = 'mm-chat-fullscreen';
    if (fullscreenPanelId && workspaceRouteActive) root.classList.add(cls);
    else root.classList.remove(cls);
    return () => root.classList.remove(cls);
  }, [fullscreenPanelId, workspaceRouteActive]);

  // Client uniquement : snapshots SSR → LS si absent (ChatPanel lit le LS au paint).
  // Puis LS global seulement s’il existe, sinon on garde l’état SSR / DEFAULT.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const snaps = ssrBootstrap?.panelSnapshots;
      if (snaps && typeof snaps === 'object') {
        for (const [id, snap] of Object.entries(snaps)) {
          const key = `mm_chat_panel_state_${id}`;
          if (!window.localStorage.getItem(key)) {
            try {
              window.localStorage.setItem(key, JSON.stringify(snap));
            } catch {
              // quota / mode privé
            }
          }
        }
      }

      const raw = window.localStorage.getItem(CHAT_PANELS_STORAGE_KEY);
      if (raw) {
        const w = readInitialWorkspaceFromLocalStorage();
        setPanels(w.panels);
        setIsSynced(w.isSynced);
        for (const p of w.panels) {
          try {
            const ls = window.localStorage.getItem(`mm_chat_panel_state_${p.id}`);
            if (ls) {
              panelSnapshotsRef.current[p.id] = JSON.parse(ls) as unknown;
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setStorageReady(true);
    }
  }, [ssrBootstrap]);

  /**
   * Sur /chat : aligner le state sur localStorage. En `useEffect` (pas layout) pour tour **après**
   * le layout qui hydrate `panels` depuis LS — sinon `panels` est encore l’ancien tableau et on
   * pouvait effacer à tort un plein écran `panel-2`.
   */
  useEffect(() => {
    if (!workspaceRouteActive || !storageReady || typeof window === 'undefined') return;
    const raw = readStoredFullscreenPanelId();
    if (!raw) return;
    if (!panels.some((p) => p.id === raw)) {
      persistMmFullscreenPanelId(null);
      setFullscreenPanelId(null);
      return;
    }
    setFullscreenPanelId((prev) => (prev === raw ? prev : raw));
  }, [workspaceRouteActive, storageReady, panels]);

  useEffect(() => {
    if (!syncRemote || !storageReady) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/workspace');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { payload: unknown | null };
        const remote =
          data.payload != null ? parseWorkspacePayload(data.payload) : null;

        if (remote && remote.panels.length > 0) {
          const nextPanels = remote.panels.map((p) => ({
            id: p.id,
            debateId: p.debateId ?? null,
            question: p.question ?? '',
            synthesis: p.synthesis ?? null,
          }));
          const nextSynced = remote.isSynced === true && remote.panels.length >= 2;

          applyRemoteSnapshotsOnlyMissingLocalKeys(
            remote.panelSnapshots as Record<string, unknown> | undefined
          );
          const remSnaps = (remote.panelSnapshots ?? {}) as Record<string, unknown>;
          const fromLs = readPanelSnapshotsFromLocalStorage(
            nextPanels.map((p) => p.id)
          );
          const mergedPanels = nextPanels.map((p) =>
            derivePanelFromSnapshotJson(fromLs[p.id] ?? remSnaps[p.id], p)
          );
          for (const id of mergedPanels.map((p) => p.id)) {
            const s = fromLs[id] ?? remSnaps[id];
            if (s != null) panelSnapshotsRef.current[id] = s;
          }

          const sameMeta =
            panelsWorkspaceEqual(panelsRef.current, mergedPanels) &&
            nextSynced === isSyncedRef.current;

          if (!sameMeta) {
            setPanels(mergedPanels);
            setIsSynced(nextSynced);
          }
        } else {
          const localPayload: ChatWorkspacePayload = {
            v: PANELS_SNAPSHOT_VERSION,
            panels: panelsRef.current.map((p) => ({
              id: p.id,
              debateId: p.debateId,
              question: p.question,
              synthesis: p.synthesis,
            })),
            isSynced:
              panelsRef.current.length >= 2 ? isSyncedRef.current : false,
            panelSnapshots: readPanelSnapshotsFromLocalStorage(
              panelsRef.current.map((p) => p.id)
            ),
          };
          const hasMeaningful =
            localPayload.panels.length > 1 ||
            localPayload.panels.some(
              (p) => p.debateId || (p.question ?? '').trim().length > 0
            ) ||
            Object.keys(localPayload.panelSnapshots ?? {}).length > 0;
          if (hasMeaningful) {
            await fetch('/api/chat/workspace', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localPayload),
            });
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          remoteReadyRef.current = true;
          setRemoteReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncRemote, storageReady]);

  const addPanel = useCallback(
    (debateId?: string, question?: string) => {
      if (panelsRef.current.length >= 2) {
        openReplaceModal(debateId, question);
        return;
      }
      setPanels((prev) => {
        if (prev.length >= 2) return prev;
        return [
          ...prev,
          {
            id: SECOND_PANEL_ID,
            debateId: debateId ?? null,
            question: question ?? '',
            synthesis: null,
          },
        ];
      });
    },
    [openReplaceModal]
  );

  const removePanel = useCallback((id: string) => {
    delete panelSnapshotsRef.current[id];
    setPanelLinkedThreads((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSmartPartnerLinkedContext((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    delete smartPartnerFetchKeyRef.current[id];
    setPanels((prev) => {
      if (prev.length <= 1) return prev;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(`mm_chat_panel_state_${id}`);
        }
      } catch {
        // ignore
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const closeReplaceModal = useCallback(() => {
    setReplaceModal({ open: false });
  }, []);

  const updatePanelDebateId = useCallback(
    (id: string, debateId: string | null, question: string) => {
      setPanels((prev) => {
        const next = prev.map((p) =>
          p.id === id
            ? {
                ...p,
                debateId,
                question,
                /** Sinon la synthèse liée (2 panneaux) reste en prop et le panneau ne se « vide » pas au reset. */
                ...(debateId === null ? { synthesis: null, turns: undefined } : {}),
              }
            : p
        );
        panelsRef.current = next;
        return next;
      });

      if (debateId === null) {
        const clearedPanels = panelsRef.current;
        setPanelLinkedThreads((prev) => {
          if (!(id in prev)) return prev;
          const nextThreads = { ...prev };
          delete nextThreads[id];
          return nextThreads;
        });
        setSmartPartnerLinkedContext((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        delete smartPartnerFetchKeyRef.current[id];
        const emptySnap = createEmptyPanelSnapshotRecord();
        panelSnapshotsRef.current[id] = emptySnap;
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              `mm_chat_panel_state_${id}`,
              JSON.stringify(emptySnap)
            );
            window.localStorage.setItem(
              CHAT_PANELS_STORAGE_KEY,
              JSON.stringify({
                v: PANELS_SNAPSHOT_VERSION,
                panels: clearedPanels,
                isSynced:
                  clearedPanels.length >= 2 ? isSyncedRef.current : false,
              })
            );
          }
        } catch {
          // ignore
        }

        if (syncRemote && remoteReadyRef.current && typeof window !== 'undefined') {
          if (remoteSaveTimeoutRef.current) {
            window.clearTimeout(remoteSaveTimeoutRef.current);
            remoteSaveTimeoutRef.current = null;
          }
          const clearedIds = clearedPanels.map((p) => p.id);
          const panelSnapshots = buildPanelSnapshotsForPersist(
            clearedIds,
            panelSnapshotsRef.current
          );
          const body: ChatWorkspacePayload = {
            v: PANELS_SNAPSHOT_VERSION,
            panels: clearedPanels.map((p) =>
              derivePanelFromSnapshotJson(panelSnapshots[p.id], p)
            ).map((p) => ({
              id: p.id,
              debateId: p.debateId,
              question: p.question,
              synthesis: p.synthesis,
            })),
            isSynced:
              clearedPanels.length >= 2 ? isSyncedRef.current : false,
            panelSnapshots,
          };
          fetch('/api/chat/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }).catch(() => {});
        }
      }
    },
    [syncRemote]
  );

  const updatePanelSynthesis = useCallback((id: string, synthesis: string) => {
    setPanels((prev) => {
      const cur = prev.find((p) => p.id === id);
      if (cur && (cur.synthesis ?? '') === (synthesis ?? '')) return prev;
      return prev.map((p) => {
        if (p.id !== id) return p;
        const q = (p.question ?? '').trim();
        const prevTurns = [...(p.turns ?? [])];
        const last = prevTurns[prevTurns.length - 1];
        let nextTurns: PartnerMemoryTurn[];
        if (last && (last.question === q || (!q && last.question))) {
          const qKeep = q || last.question;
          nextTurns = [...prevTurns.slice(0, -1), { question: qKeep, synthesis }];
        } else {
          nextTurns = [...prevTurns, { question: q, synthesis }];
        }
        return { ...p, synthesis, turns: nextTurns };
      });
    });
  }, []);

  const updatePanelLinkedThread = useCallback((id: string, text: string) => {
    setPanelLinkedThreads((prev) => {
      if ((prev[id] ?? '') === text) return prev;
      return { ...prev, [id]: text };
    });
  }, []);

  const queueRemoteSave = useCallback(() => {
    if (!syncRemote || !remoteReadyRef.current) return;
    if (remoteSaveTimeoutRef.current) {
      window.clearTimeout(remoteSaveTimeoutRef.current);
    }
    remoteSaveTimeoutRef.current = window.setTimeout(() => {
      remoteSaveTimeoutRef.current = null;
      const ids = panelsRef.current.map((p) => p.id);
      const panelSnapshots = buildPanelSnapshotsForPersist(
        ids,
        panelSnapshotsRef.current
      );
      const panelsForPut = panelsRef.current.map((p) =>
        derivePanelFromSnapshotJson(panelSnapshots[p.id], p)
      );
      const body: ChatWorkspacePayload = {
        v: PANELS_SNAPSHOT_VERSION,
        panels: panelsForPut.map((p) => ({
          id: p.id,
          debateId: p.debateId,
          question: p.question,
          synthesis: p.synthesis,
        })),
        isSynced:
          panelsForPut.length >= 2 ? isSyncedRef.current : false,
        panelSnapshots,
      };
      fetch('/api/chat/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, 1000);
  }, [syncRemote]);

  /**
   * Remplace un slot : met à jour panelsRef + LS tout de suite (évite course avec le binder URL),
   * puis pousse le workspace distant sans attendre le debounce.
   */
  const replacePanel = useCallback(
    (targetId: string, newDebateId?: string, newQuestion?: string) => {
      const emptySnap = createEmptyPanelSnapshotRecord();
      delete panelSnapshotsRef.current[targetId];
      panelSnapshotsRef.current[targetId] = emptySnap;

      setPanelLinkedThreads((prev) => {
        if (!(targetId in prev)) return prev;
        const nextThreads = { ...prev };
        delete nextThreads[targetId];
        return nextThreads;
      });

      setSmartPartnerLinkedContext((prev) => {
        if (!(targetId in prev)) return prev;
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      delete smartPartnerFetchKeyRef.current[targetId];

      setPanels((prev) => {
        const next = prev.map((p) =>
          p.id === targetId
            ? {
                ...p,
                debateId: newDebateId ?? null,
                question: newQuestion ?? '',
                synthesis: null,
                turns: undefined,
              }
            : p
        );
        panelsRef.current = next;
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(`mm_chat_panel_msg_scroll_v1_${targetId}`);
            window.localStorage.setItem(
              `mm_chat_panel_state_${targetId}`,
              JSON.stringify(emptySnap)
            );
            window.localStorage.setItem(
              CHAT_PANELS_STORAGE_KEY,
              JSON.stringify({
                v: PANELS_SNAPSHOT_VERSION,
                panels: next,
                isSynced: next.length >= 2 ? isSyncedRef.current : false,
              })
            );
          }
        } catch {
          // ignore
        }
        return next;
      });

      setReplaceModal({ open: false });

      if (syncRemote && remoteReadyRef.current && typeof window !== 'undefined') {
        if (remoteSaveTimeoutRef.current) {
          window.clearTimeout(remoteSaveTimeoutRef.current);
          remoteSaveTimeoutRef.current = null;
        }
        const ids = panelsRef.current.map((p) => p.id);
        const panelSnapshots = buildPanelSnapshotsForPersist(
          ids,
          panelSnapshotsRef.current
        );
        const panelsForPut = panelsRef.current.map((p) =>
          derivePanelFromSnapshotJson(panelSnapshots[p.id], p)
        );
        const body: ChatWorkspacePayload = {
          v: PANELS_SNAPSHOT_VERSION,
          panels: panelsForPut.map((p) => ({
            id: p.id,
            debateId: p.debateId,
            question: p.question,
            synthesis: p.synthesis,
          })),
          isSynced:
            panelsForPut.length >= 2 ? isSyncedRef.current : false,
          panelSnapshots,
        };
        fetch('/api/chat/workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(() => {});
      }
    },
    [syncRemote]
  );

  /** Ne pas utiliser de setState ici : 2 panneaux × debounce déclenchait un re-render global à chaque frappe. */
  const reportPanelSnapshot = useCallback(
    (panelId: string, snapshot: Record<string, unknown>) => {
      panelSnapshotsRef.current[panelId] = snapshot;
      queueRemoteSave();
    },
    [queueRemoteSave]
  );

  const getPanelLabelFromSnapshotMemory = useCallback((panelId: string) => {
    return deriveLabelFromPanelSnapshotRecord(
      panelSnapshotsRef.current[panelId] as Record<string, unknown> | undefined
    );
  }, []);

  const getPanelDebateTitleFromMemory = useCallback((panelId: string): string | null => {
    const snap = panelSnapshotsRef.current[panelId];
    if (!snap || typeof snap !== 'object') return null;
    const d = (snap as Record<string, unknown>).debate as
      | Record<string, unknown>
      | undefined;
    const t = d?.title;
    if (typeof t !== 'string' || !t.trim()) return null;
    const out = t.trim();
    return out.length <= 120 ? out : `${out.slice(0, 117)}…`;
  }, []);

  /**
   * Sync ON + partenaire avec plus de 5 tours (hors stream) : résumé via API.
   */
  useEffect(() => {
    if (
      !isSynced ||
      panelsRef.current.length < 2 ||
      typeof window === 'undefined' ||
      !storageReady
    ) {
      return;
    }
    const ac = new AbortController();
    (async () => {
      const panelList = panelsRef.current;
      if (panelList.length < 2) return;
      for (const partner of panelList) {
        if (ac.signal.aborted) return;
        const snap = getPartnerPanelSnapshot(partner.id, panelSnapshotsRef.current);
        const snapObj =
          snap && typeof snap === 'object' ? (snap as Record<string, unknown>) : null;
        const partnerStatus = snapObj?.debateStatus;
        if (partnerStatus === 'loading' || partnerStatus === 'streaming') {
          continue;
        }
        const turns = extractPartnerMemoryTurnsFromSnapshot(snap);
        if (turns.length <= PARTNER_MEMORY_SUMMARY_THRESHOLD) {
          setSmartPartnerLinkedContext((prev) => {
            if (!(partner.id in prev)) return prev;
            const next = { ...prev };
            delete next[partner.id];
            return next;
          });
          delete smartPartnerFetchKeyRef.current[partner.id];
          continue;
        }
        const fp = fingerprintPartnerMemoryTurns(turns);
        if (smartPartnerFetchKeyRef.current[partner.id] === fp) continue;
        try {
          const res = await fetch('/api/summarize-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turns }),
            signal: ac.signal,
          });
          const data = (await res.json()) as { context?: unknown };
          const ctx = typeof data.context === 'string' ? data.context : '';
          if (ctx.trim()) {
            smartPartnerFetchKeyRef.current[partner.id] = fp;
            setSmartPartnerLinkedContext((prev) => ({ ...prev, [partner.id]: ctx }));
          }
        } catch {
          /* repli : texte brut dans getPartnerLinkedContext */
        }
      }
    })();
    return () => ac.abort();
  }, [isSynced, panelsStableKey, panelLinkedThreads, storageReady]);

  /**
   * Contexte du panneau partenaire pour la sync : priorité au fil React (stream),
   * sinon snapshot mémoire / LS. Si sync + > 5 tours et résumé prêt : version résumée.
   */
  const getPartnerLinkedContext = useCallback(
    (partner: Panel): string | null => {
      const plain = resolvePartnerLinkedContext(
        partner,
        panelLinkedThreads,
        panelSnapshotsRef.current
      );
      if (!isSynced) return plain;
      const snap = getPartnerPanelSnapshot(partner.id, panelSnapshotsRef.current);
      const snapObj =
        snap && typeof snap === 'object' ? (snap as Record<string, unknown>) : null;
      const st = snapObj?.debateStatus;
      if (st === 'loading' || st === 'streaming') {
        return plain;
      }
      const turns = extractPartnerMemoryTurnsFromSnapshot(snap);
      if (turns.length <= PARTNER_MEMORY_SUMMARY_THRESHOLD) return plain;
      const smart = smartPartnerLinkedContext[partner.id]?.trim();
      return smart ? smart : plain;
    },
    [panelLinkedThreads, smartPartnerLinkedContext, isSynced]
  );

  const sync = useCallback(() => {
    setIsSynced(true);
    setTransmitting(true);
    if (transmittingTimeoutRef.current) {
      window.clearTimeout(transmittingTimeoutRef.current);
    }
    transmittingTimeoutRef.current = window.setTimeout(() => setTransmitting(false), 1200);
  }, []);

  const unsync = useCallback(() => {
    setIsSynced(false);
    setTransmitting(false);
    setPanelLinkedThreads({});
    setSmartPartnerLinkedContext({});
    smartPartnerFetchKeyRef.current = {};
    if (transmittingTimeoutRef.current) {
      window.clearTimeout(transmittingTimeoutRef.current);
      transmittingTimeoutRef.current = null;
    }
  }, []);

  const notifyTransmitting = useCallback(() => {
    if (!isSynced) return;
    setTransmitting(true);
    if (transmittingTimeoutRef.current) {
      window.clearTimeout(transmittingTimeoutRef.current);
    }
    transmittingTimeoutRef.current = window.setTimeout(() => setTransmitting(false), 1200);
  }, [isSynced]);

  const flushPanelsToStorage = useCallback(() => {
    if (!storageReadyRef.current) return;
    try {
      if (typeof window !== 'undefined') {
        const ids = panelsRef.current.map((p) => p.id);
        const snaps = buildPanelSnapshotsForPersist(
          ids,
          panelSnapshotsRef.current
        );
        const panelsForStore = panelsRef.current.map((p) =>
          derivePanelFromSnapshotJson(snaps[p.id], p)
        );
        const payload: PanelsStoragePayload = {
          v: PANELS_SNAPSHOT_VERSION,
          panels: panelsForStore,
          isSynced:
            panelsForStore.length >= 2 ? isSyncedRef.current : false,
        };
        window.localStorage.setItem(CHAT_PANELS_STORAGE_KEY, JSON.stringify(payload));
      }
    } catch {
      // ignore
    }
  }, []);

  /** À la sortie du chat / onglet : LS + serveur = contenu réel des panneaux (priorité aux snapshots LS). */
  const persistWorkspaceFromLocalStorageNow = useCallback(() => {
    flushPanelsToStorage();
    if (!syncRemote || !remoteReadyRef.current || typeof window === 'undefined') return;
    const ids = panelsRef.current.map((p) => p.id);
    const panelSnapshots = buildPanelSnapshotsForPersist(
      ids,
      panelSnapshotsRef.current
    );
    const panelsForPut = panelsRef.current.map((p) =>
      derivePanelFromSnapshotJson(panelSnapshots[p.id], p)
    );
    for (const id of ids) {
      if (panelSnapshots[id] != null) {
        panelSnapshotsRef.current[id] = panelSnapshots[id];
      }
    }
    const body: ChatWorkspacePayload = {
      v: PANELS_SNAPSHOT_VERSION,
      panels: panelsForPut.map((p) => ({
        id: p.id,
        debateId: p.debateId,
        question: p.question,
        synthesis: p.synthesis,
      })),
      isSynced:
        panelsForPut.length >= 2 ? isSyncedRef.current : false,
      panelSnapshots,
    };
    try {
      fetch('/api/chat/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [syncRemote, flushPanelsToStorage]);

  useEffect(() => {
    if (!storageReady) return;
    if (flushPanelsDebounceRef.current) {
      window.clearTimeout(flushPanelsDebounceRef.current);
    }
    flushPanelsDebounceRef.current = window.setTimeout(() => {
      flushPanelsDebounceRef.current = null;
      flushPanelsToStorage();
    }, 450);
    return () => {
      if (flushPanelsDebounceRef.current) {
        window.clearTimeout(flushPanelsDebounceRef.current);
        flushPanelsDebounceRef.current = null;
      }
    };
  }, [panels, storageReady, isSynced, flushPanelsToStorage]);

  useEffect(() => {
    if (!syncRemote || !remoteReady || !workspaceRouteActive) return;
    queueRemoteSave();
    return () => {
      if (remoteSaveTimeoutRef.current) {
        window.clearTimeout(remoteSaveTimeoutRef.current);
        remoteSaveTimeoutRef.current = null;
      }
    };
  }, [syncRemote, remoteReady, panels, isSynced, queueRemoteSave, workspaceRouteActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHide = () => {
      persistWorkspaceFromLocalStorageNow();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [persistWorkspaceFromLocalStorageNow]);

  useEffect(() => {
    if (panels.length < 2 && isSynced) {
      setIsSynced(false);
      setTransmitting(false);
      setPanelLinkedThreads({});
      setSmartPartnerLinkedContext({});
      smartPartnerFetchKeyRef.current = {};
    }
  }, [panels.length, isSynced]);

  useEffect(() => {
    return () => {
      if (transmittingTimeoutRef.current) {
        window.clearTimeout(transmittingTimeoutRef.current);
      }
      if (remoteSaveTimeoutRef.current) {
        window.clearTimeout(remoteSaveTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      panels,
      /** `false` jusqu’à lecture synchrone du workspace dans localStorage — évite un panneau vide au 1er paint. */
      storageReady,
      reportPanelSnapshot,
      persistWorkspaceFromLocalStorageNow,
      canAddPanel,
      addPanel,
      openReplaceModal,
      removePanel,
      replacePanel,
      replaceModal,
      closeReplaceModal,
      updatePanelDebateId,
      updatePanelSynthesis,
      updatePanelLinkedThread,
      panelLinkedThreads,
      isSynced,
      sync,
      unsync,
      transmitting,
      notifyTransmitting,
      getPanelLabelFromSnapshotMemory,
      getPanelDebateTitleFromMemory,
      getPartnerLinkedContext,
      fullscreenPanelId,
      enterFullscreen,
      exitFullscreen,
      toggleFullscreen,
    }),
    [
      panels,
      panelLinkedThreads,
      storageReady,
      reportPanelSnapshot,
      persistWorkspaceFromLocalStorageNow,
      getPanelLabelFromSnapshotMemory,
      getPanelDebateTitleFromMemory,
      getPartnerLinkedContext,
      canAddPanel,
      addPanel,
      openReplaceModal,
      removePanel,
      replacePanel,
      replaceModal,
      closeReplaceModal,
      updatePanelDebateId,
      updatePanelSynthesis,
      updatePanelLinkedThread,
      isSynced,
      sync,
      unsync,
      transmitting,
      notifyTransmitting,
      fullscreenPanelId,
      enterFullscreen,
      exitFullscreen,
      toggleFullscreen,
    ]
  );
}
