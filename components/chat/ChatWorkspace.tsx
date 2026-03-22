/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useChatPanelsContext } from '@/contexts/ChatPanelsContext';
import { ChatPanel } from '@/components/debate/ChatPanel';
import { SyncButton } from '@/components/debate/SyncButton';
import { SyncAnimation } from '@/components/debate/SyncAnimation';
import { conversationListLabel } from '@/lib/conversation-title';
import {
  getChatPanelDebateTitleFromStorage,
  getChatPanelSnapshotPreview,
} from '@/lib/chat-panel-snapshot-label';
import { cn, isChatRoutePath } from '@/lib/utils';

/**
 * useSearchParams seul dans ce sous-arbre + Suspense : le shell du chat (panneaux) s’affiche tout de suite.
 */
function ChatWorkspaceUrlBinder({
  onProjectId,
}: {
  onProjectId: (projectId: string | null) => void;
}) {
  const pathname = usePathname();
  const isChatRoute = isChatRoutePath(pathname);
  const searchParams = useSearchParams();
  const {
    panels,
    addPanel,
    openReplaceModal,
    replaceModal,
    updatePanelDebateId,
  } = useChatPanelsContext();
  const processedIncomingRef = useRef<string | null>(null);

  const projectId = searchParams.get('projectId');
  const incomingDebateId = searchParams.get('debateId');
  const incomingQuestion = searchParams.get('question') ?? '';

  useLayoutEffect(() => {
    onProjectId(isChatRoute ? projectId : null);
  }, [isChatRoute, projectId, onProjectId]);

  useLayoutEffect(() => {
    if (!isChatRoute) return;
    if (!incomingDebateId) {
      processedIncomingRef.current = null;
      return;
    }
    const key = `${incomingDebateId}::${incomingQuestion}`;
    if (processedIncomingRef.current === key) return;

    if (panels.some((p) => p.debateId === incomingDebateId)) {
      processedIncomingRef.current = key;
      return;
    }

    if (panels.length === 1 && !panels[0]?.debateId && !panels[0]?.question) {
      updatePanelDebateId(panels[0].id, incomingDebateId, incomingQuestion);
      processedIncomingRef.current = key;
      return;
    }

    if (panels.length === 2) {
      if (!replaceModal.open || replaceModal.newDebateId !== incomingDebateId) {
        openReplaceModal(incomingDebateId, incomingQuestion);
      }
      processedIncomingRef.current = key;
      return;
    }

    addPanel(incomingDebateId, incomingQuestion);
    processedIncomingRef.current = key;
  }, [
    addPanel,
    openReplaceModal,
    incomingDebateId,
    incomingQuestion,
    isChatRoute,
    panels,
    replaceModal.open,
    replaceModal.newDebateId,
    updatePanelDebateId,
  ]);

  return null;
}

/** Panneaux de chat — rendu uniquement sur la route /chat par ChatPanelsProvider. */
export function ChatWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const isChatRoute = isChatRoutePath(pathname);
  const [urlProjectId, setUrlProjectId] = useState<string | null>(null);
  const {
    panels,
    canAddPanel,
    addPanel,
    removePanel,
    replacePanel,
    replaceModal,
    closeReplaceModal,
    updatePanelDebateId,
    updatePanelSynthesis,
    updatePanelLinkedThread,
    getPartnerLinkedContext,
    isSynced,
    sync,
    unsync,
    transmitting,
    notifyTransmitting,
    getPanelLabelFromSnapshotMemory,
    getPanelDebateTitleFromMemory,
    persistWorkspaceFromLocalStorageNow,
  } = useChatPanelsContext();

  /** Quitter /chat : figer l’état réel (LS) avant démontage des ChatPanel — revient identique ensuite. */
  useEffect(() => {
    return () => {
      persistWorkspaceFromLocalStorageNow();
    };
  }, [persistWorkspaceFromLocalStorageNow]);

  const replaceModalPanelLabel = useCallback(
    (panel: { id: string; debateId: string | null; question: string }) => {
      const persistedTitle =
        getPanelDebateTitleFromMemory(panel.id) ??
        getChatPanelDebateTitleFromStorage(panel.id);
      const fromState = conversationListLabel({
        title: persistedTitle ?? undefined,
        question: panel.question ?? '',
      });
      if (fromState.trim()) return fromState;
      const fromMemory = getPanelLabelFromSnapshotMemory(panel.id);
      if (fromMemory) return fromMemory;
      const fromStorage = getChatPanelSnapshotPreview(panel.id);
      if (fromStorage) return fromStorage;
      return panel.debateId ? 'Saved conversation' : 'New conversation';
    },
    [
      getPanelDebateTitleFromMemory,
      getPanelLabelFromSnapshotMemory,
    ]
  );

  /** Retire `debateId` / `question` de l’URL — évite que le binder rouvre le modal ou rejoue l’intent. */
  const stripIncomingDebateQueryParams = useCallback(() => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    params.delete('debateId');
    params.delete('question');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router]);

  const cancelReplaceAndClearOpenIntent = useCallback(() => {
    closeReplaceModal();
    stripIncomingDebateQueryParams();
  }, [closeReplaceModal, stripIncomingDebateQueryParams]);

  /** Slot à remplacer : choix explicite + bouton « Replace » (évite les clics ambigus). */
  const [replaceSlotPick, setReplaceSlotPick] = useState<string | null>(null);
  useEffect(() => {
    setReplaceSlotPick(null);
  }, [
    replaceModal.open,
    replaceModal.newDebateId,
    replaceModal.newQuestion,
  ]);

  const handleDebateStart = useCallback(
    (panelId: string, debateId: string | null, question: string) => {
      updatePanelDebateId(panelId, debateId, question);
    },
    [updatePanelDebateId]
  );

  /** Libellés modal Replace : si texte identique, on différencie par id / débat. */
  const replaceModalSlotLabels = useMemo(() => {
    const bases = panels.map((p) => ({
      panel: p,
      base: replaceModalPanelLabel(p),
    }));
    const n = bases.length;
    const countSame = (base: string) =>
      bases.reduce((acc, b) => acc + (b.base === base ? 1 : 0), 0);
    return bases.map(({ panel, base }) => {
      const ambiguous = n >= 2 && countSame(base) > 1;
      const slotHint =
        panel.id === 'panel-1'
          ? 'Slot 1'
          : panel.id === 'panel-2'
            ? 'Slot 2'
            : panel.id;
      const idLine = panel.debateId?.trim()
        ? `Debate ${panel.debateId.slice(0, 10)}…`
        : `Workspace ${slotHint}`;
      return {
        panel,
        title: ambiguous ? `${base} · ${slotHint}` : base,
        subtitle: idLine,
      };
    });
  }, [panels, replaceModalPanelLabel]);

  const hasTwoPanels = panels.length === 2;
  const chatProjectId = isChatRoute ? urlProjectId : null;

  return (
    <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden p-4">
      <Suspense fallback={null}>
        <ChatWorkspaceUrlBinder onProjectId={setUrlProjectId} />
      </Suspense>
      {/*
        Clé stable par panneau : si on incluait debateId, chaque nouveau débat remontait tout le
        ChatPanel → useDebate repartait vide et « Voir le détail » n’affichait plus les réponses IA.
      */}
      <div
        className={cn(
          'flex min-h-0 min-w-0 w-full flex-1 overflow-hidden',
          hasTwoPanels
            ? 'flex-col items-stretch gap-4 lg:flex-row lg:items-stretch'
            : 'flex-col gap-0'
        )}
      >
        {panels.map((panel, index) => (
          <Fragment key={panel.id}>
            {/*
              flex + flex-col + min-h-0 : sans ça, le ChatPanel reste en hauteur « contenu »
              et dépasse le viewport (coupure en bas, pas de scroll interne).
            */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ChatPanel
                key={panel.id}
                panelId={panel.id}
                initialDebateId={panel.debateId}
                initialQuestion={panel.question}
                initialSynthesis={panel.synthesis}
                defaultProjectId={chatProjectId}
                showClose={hasTwoPanels}
                onClose={() => removePanel(panel.id)}
                onDebateStart={(debateId, question) =>
                  handleDebateStart(panel.id, debateId, question)
                }
                linkedContext={
                  hasTwoPanels && isSynced
                    ? getPartnerLinkedContext(
                        index === 0 ? panels[1]! : panels[0]!
                      )
                    : null
                }
                onSynthesisReady={
                  hasTwoPanels
                    ? (synthesis) => updatePanelSynthesis(panel.id, synthesis)
                    : undefined
                }
                onLinkedThreadReady={
                  hasTwoPanels && isSynced
                    ? (text: string) => updatePanelLinkedThread(panel.id, text)
                    : undefined
                }
                onTransmit={hasTwoPanels ? notifyTransmitting : undefined}
              />
            </div>
            {hasTwoPanels && index === 0 ? (
              <div className="relative flex min-h-0 w-[140px] shrink-0 items-start justify-center self-stretch overflow-visible py-2 lg:-mx-4 lg:py-0">
                <div className="relative pt-2.5 lg:pt-3">
                  <div className="relative inline-flex">
                    <div className="pointer-events-none absolute inset-0 z-0">
                      <SyncAnimation active={isSynced} transmitting={transmitting} />
                    </div>
                    <div className="relative z-10">
                      <SyncButton
                        isSynced={isSynced}
                        onSync={sync}
                        onUnsync={unsync}
                        disabled={!hasTwoPanels}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>

      {isChatRoute && canAddPanel ? (
        <button
          type="button"
          onClick={() => addPanel()}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
      ) : null}

      {isChatRoute && replaceModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-neutral-900">Replace which conversation?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Both chat slots are in use. Pick which one to replace with this conversation. The other
              stays saved in History (and in its project if it belongs to one)—nothing is deleted.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {replaceModalSlotLabels.map(({ panel, title, subtitle }, index) => (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => setReplaceSlotPick(panel.id)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm transition',
                    replaceSlotPick === panel.id
                      ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                      : 'border-neutral-200 hover:border-violet-300 hover:bg-violet-50'
                  )}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Chat {index + 1}
                  </span>
                  <span className="mt-1 block font-medium text-neutral-900">{title}</span>
                  <span className="mt-0.5 block text-[11px] text-neutral-500">{subtitle}</span>
                </button>
              ))}
              <div className="mt-2 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
                <button
                  type="button"
                  disabled={
                    replaceSlotPick == null ||
                    replaceModal.newDebateId == null ||
                    String(replaceModal.newDebateId).trim() === ''
                  }
                  onClick={() => {
                    if (replaceSlotPick == null) return;
                    const slot = replaceSlotPick;
                    const nid = replaceModal.newDebateId;
                    if (nid == null || String(nid).trim() === '') return;
                    const nq = replaceModal.newQuestion ?? '';
                    flushSync(() => {
                      replacePanel(slot, nid, nq);
                    });
                    stripIncomingDebateQueryParams();
                  }}
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-sm font-bold text-white transition',
                    replaceSlotPick == null
                      ? 'cursor-not-allowed bg-neutral-300'
                      : 'bg-neutral-900 hover:bg-neutral-800'
                  )}
                >
                  Replace selected chat
                </button>
                <button
                  type="button"
                  onClick={cancelReplaceAndClearOpenIntent}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
