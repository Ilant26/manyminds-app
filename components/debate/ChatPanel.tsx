'use client';

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDebate, type DebateStatus } from '@/hooks/useDebate';
import { useChatPanelsContext } from '@/contexts/ChatPanelsContext';
import { useVoice } from '@/hooks/useVoice';
import { useQuota } from '@/hooks/useQuota';
import { QuestionInput } from '@/components/debate/QuestionInput';
import {
  ConsultingModelsStatus,
  DebateIndeterminateBar,
} from '@/components/debate/ConsultingModelsStatus';
import { ManymindsAnswer } from '@/components/debate/ManymindsAnswer';
import { DisagreementFlag } from '@/components/debate/DisagreementFlag';
import { DemoFrame } from '@/components/debate/DemoFrame';
import { DeepModeModal } from '@/components/debate/DeepModeModal';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { Loader2, Maximize2, Minimize2, RefreshCw, X } from 'lucide-react';
import { cn, isChatRoutePath } from '@/lib/utils';
import { createEmptyPanelSnapshotRecord } from '@/lib/chat-panel-empty-snapshot';
import { formatChatPanelThreadForLinkedContext } from '@/lib/format-chat-panel-thread-for-sync';
import { splitMergedQuestionParts } from '@/lib/debate-question-merge-split';
import { splitDebateForChatPanel } from '@/lib/debate-panel-hydrate';
import type { ChatTurnSnapshot, Debate } from '@/types';

const PANEL_SNAPSHOT_VERSION = 2;

function coerceRestoredDebateStatus(
  raw: DebateStatus | undefined,
  debate: { synthesis?: string; ai_responses?: unknown[] } | undefined
): DebateStatus {
  if (raw === 'done' || raw === 'error') return raw;
  if (raw === 'loading' || raw === 'streaming') {
    if (debate?.synthesis?.trim()) return 'done';
    if ((debate?.ai_responses?.length ?? 0) > 0) return 'done';
    return 'idle';
  }
  return 'idle';
}

interface ChatPanelProps {
  panelId: string;
  initialDebateId?: string | null;
  initialQuestion?: string;
  /** Dernière synthèse persistée dans le workspace (SSR) — évite un panneau vide en attendant GET /api/debate. */
  initialSynthesis?: string | null;
  defaultProjectId?: string | null;
  showClose: boolean;
  onClose: () => void;
  onDebateStart: (debateId: string | null, question: string) => void;
  linkedContext?: string | null;
  onSynthesisReady?: (synthesis: string) => void;
  /** Fil complet (tous les tours) pour le panneau synchronisé. */
  onLinkedThreadReady?: (fullThreadText: string) => void;
  onTransmit?: () => void;
  /** Si omis, dérivé du contexte workspace (fullscreenPanelId). */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

function PastDebateTurn({
  turn,
  canExportPdf,
}: {
  turn: ChatTurnSnapshot;
  canExportPdf: boolean;
}) {
  return (
    <div className="space-y-4 border-b border-neutral-100 pb-6 last:border-b-0">
      {turn.question ? (
        <div className="flex w-full justify-end">
          <div className="max-w-[80%] rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 break-words">
            {turn.question}
          </div>
        </div>
      ) : null}
      {turn.synthesis ? (
        <ManymindsAnswer
          synthesis={turn.synthesis}
          debateId={turn.debateId}
          canExportPdf={canExportPdf}
          mode={turn.mode}
          consensusScore={turn.consensusScore}
          responses={turn.responses}
          disagreements={turn.disagreements}
        />
      ) : null}
      {!turn.synthesis && turn.disagreements.length > 0 ? (
        <DisagreementFlag disagreements={turn.disagreements} />
      ) : null}
    </div>
  );
}

export function ChatPanel({
  panelId,
  initialDebateId,
  initialQuestion,
  initialSynthesis,
  defaultProjectId,
  showClose,
  onClose,
  onDebateStart,
  linkedContext,
  onSynthesisReady,
  onLinkedThreadReady,
  onTransmit,
  isFullscreen: isFullscreenProp,
  onToggleFullscreen: onToggleFullscreenProp,
}: ChatPanelProps) {
  const pathname = usePathname();
  const isChatRoute = isChatRoutePath(pathname);
  const {
    reportPanelSnapshot,
    storageReady,
    fullscreenPanelId,
    toggleFullscreen,
  } = useChatPanelsContext();
  const isFullscreen =
    isFullscreenProp ?? (fullscreenPanelId != null && fullscreenPanelId === panelId);
  const isHiddenByFullscreen =
    fullscreenPanelId != null && fullscreenPanelId !== panelId;
  const handleToggleFullscreen =
    onToggleFullscreenProp ?? (() => toggleFullscreen(panelId));
  /**
   * Après lecture workspace (contexte) + chaîne d’hydratation panneau (layout) :
   * évite ~1 frame / flash avec fil LS partiel (ex. questions sans réponses).
   */
  const [chatSessionPaintReady, setChatSessionPaintReady] = useState(false);
  const panelStorageKey = `mm_chat_panel_state_${panelId}`;

  const [fullscreenEnter, setFullscreenEnter] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenEnter(false);
      return;
    }
    setFullscreenEnter(false);
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setFullscreenEnter(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);
  /** Position du scroll du fil (restaurée au refresh). */
  const messageScrollLsKey = `mm_chat_panel_msg_scroll_v1_${panelId}`;
  /** Même onglet : survit aux écrasements LS avant que le fil ait sa hauteur finale (retour /chat). */
  const sessionScrollKey = `mm_chat_panel_scroll_ss_v1_${panelId}`;
  /**
   * Jamais `initialQuestion` ici : c’est la question « workspace » (titre / sync), pas le brouillon.
   * Sinon au retour sur /chat le composer affiche cette chaîne ~1 s puis se vide quand `/api/debate` répond.
   */
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');
  const [showDeepModal, setShowDeepModal] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  /** Chat: individual model answers hidden until user expands the section. */
  const [individualModelsOpen, setIndividualModelsOpen] = useState(false);
  /** Tours terminés dans ce panneau (défilable au-dessus du tour en cours). */
  const [turnHistory, setTurnHistory] = useState<ChatTurnSnapshot[]>([]);
  const [lastSubmitted, setLastSubmitted] = useState('');
  /**
   * True après Close jusqu’à ce que le workspace parent soit bien vide (évite `initialQuestion` stale).
   */
  const [ignoreWorkspaceBootstrap, setIgnoreWorkspaceBootstrap] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Haut de la zone de réponse du tour courant — on aligne le scroll ici pour montrer le début, pas la fin. */
  const answerTopAnchorRef = useRef<HTMLDivElement>(null);
  /** Si false, le streaming ne force plus le scroll (lecture de l’historique). */
  const nearBottomRef = useRef(true);
  const prevLoadingForScrollRef = useRef(false);
  /** Cible lue dans LS au montage / changement de panneau. */
  const scrollRestoreTargetRef = useRef<number | null>(null);
  /** Une fois la restauration appliquée (ou rien à restaurer). */
  const didApplyScrollRestoreRef = useRef(false);
  /** Après GET /api/debate ou cache : défiler en bas du fil (fin de conversation), pas le haut de la réponse. */
  const preferScrollThreadEndAfterLoadRef = useRef(false);
  const messageScrollPersistTimeoutRef = useRef<number | null>(null);
  /**
   * Dernière position du fil (scroll) — au démontage / changement de route, `scrollRef` est souvent déjà null,
   * donc on ne peut pas relire le DOM ; sans ça le retour sur /chat remet la vue en haut (1ʳᵉ question).
   */
  const lastMessageScrollTopRef = useRef(0);
  const didHydrateFromLocalRef = useRef(false);
  /** Évite de ré-exécuter l’hydratation LS/workspace quand `initialSynthesis` / props parent bougent (ex. sync 500ms) — sinon `restorePersistedSnapshot` écrase le stream en cours. */
  const panelHydrationKeyRef = useRef<string | null>(null);
  /** Faux quand on ferme un panneau : sinon le cleanup au démontage réécrit le LS et « ressuscite » la conversation. */
  const shouldPersistOnUnmountRef = useRef(true);
  const latestSnapshotRef = useRef<{
    v?: number;
    mode: 'quick' | 'deep';
    question: string;
    lastSubmitted: string;
    turnHistory?: ChatTurnSnapshot[];
    debateStatus?: DebateStatus;
    debateError?: string | null;
    debate: {
      id: string | null;
      question: string;
      ai_responses: any[];
      consensus_score: number;
      has_disagreement: boolean;
      disagreement_details: any[];
      synthesis: string;
    };
  } | null>(null);

  const { isAtLimit } = useQuota();

  const {
    status,
    responses,
    consensusScore,
    hasDisagreement,
    disagreements,
    synthesis,
    debateId,
    debateTitle,
    error: debateError,
    /** Texte de la question du tour courant côté `useDebate` (stream / restauration). */
    question: debatePromptQuestion,
    run,
    reset,
    hydrateFromDebate,
    restorePersistedSnapshot,
  } = useDebate();

  /** Dernière synthèse pour le panneau lié (2 panneaux) — évite setPanels à chaque token. */
  const synthesisForPartnerRef = useRef(synthesis);
  synthesisForPartnerRef.current = synthesis;

  const linkedThreadForPartnerRef = useRef('');
  linkedThreadForPartnerRef.current = formatChatPanelThreadForLinkedContext(
    turnHistory,
    lastSubmitted,
    synthesis,
    status
  );

  /** Évite `setPanelLinkedThreads` en rafale si le texte formaté est identique (réf. deps / re-renders parent). */
  const lastPushedPartnerLinkedThreadRef = useRef<string | null>(null);
  const prevLastSubmittedForPartnerPushRef = useRef(lastSubmitted);

  /** Parent (`ChatWorkspace`) passe souvent des inline handlers → ne pas les mettre en deps des effets (boucle infinie). */
  const onSynthesisReadyRef = useRef(onSynthesisReady);
  onSynthesisReadyRef.current = onSynthesisReady;
  const onLinkedThreadReadyRef = useRef(onLinkedThreadReady);
  onLinkedThreadReadyRef.current = onLinkedThreadReady;
  const onDebateStartRef = useRef(onDebateStart);
  onDebateStartRef.current = onDebateStart;
  const hasPartnerSynthesisCb = Boolean(onSynthesisReady);
  const hasPartnerLinkedThreadCb = Boolean(onLinkedThreadReady);

  /**
   * Bulle « question posée » : `lastSubmitted` peut rester vide sur le panneau 2 après hydrate
   * (LS / workspace) alors que `useDebate.question` ou `initialQuestion` sont renseignés.
   */
  const visibleSubmittedQuestion =
    lastSubmitted.trim() ||
    debatePromptQuestion.trim() ||
    (ignoreWorkspaceBootstrap ? '' : (initialQuestion ?? '').trim());

  /**
   * Plusieurs questions dans un seul champ → une bulle par segment **sauf** si `turnHistory`
   * affiche déjà les tours passés : sinon on dupliquerait chaque question (historique + zone courante).
   */
  const submittedQuestionBubbles = useMemo(() => {
    const t = visibleSubmittedQuestion.trim();
    if (!t) return [];
    const parts = splitMergedQuestionParts(t);
    if (parts.length >= 2) {
      if (turnHistory.length > 0) {
        return [parts[parts.length - 1]!.trim()].filter(Boolean);
      }
      return parts;
    }
    return [t];
  }, [visibleSubmittedQuestion, turnHistory.length]);

  /** Le parent vide le slot après `onDebateStart(null,'')` — on peut à nouveau se fier aux props (ex. ouverture historique). */
  useEffect(() => {
    const parentEmpty =
      initialDebateId == null &&
      !(initialQuestion ?? '').trim() &&
      !(initialSynthesis ?? '').trim();
    if (ignoreWorkspaceBootstrap && parentEmpty) {
      setIgnoreWorkspaceBootstrap(false);
    }
  }, [
    ignoreWorkspaceBootstrap,
    initialDebateId,
    initialQuestion,
    initialSynthesis,
  ]);

  /** Réaligne la persistance / titre panneau quand l’état débat porte la question mais pas le state local. */
  useEffect(() => {
    if (lastSubmitted.trim()) return;
    const dq = debatePromptQuestion.trim();
    if (!dq) return;
    if (
      status !== 'done' &&
      status !== 'streaming' &&
      status !== 'loading' &&
      status !== 'error'
    ) {
      return;
    }
    setLastSubmitted(dq);
  }, [ignoreWorkspaceBootstrap, lastSubmitted, debatePromptQuestion, status]);

  const applyServerDebate = useCallback((data: Debate) => {
    const { turnHistory: th, latestDebateSlice } = splitDebateForChatPanel(data);
    setTurnHistory(th);
    hydrateFromDebate(latestDebateSlice);
    setLastSubmitted(latestDebateSlice.question ?? '');
    setQuestion('');
    preferScrollThreadEndAfterLoadRef.current = true;
  }, [hydrateFromDebate]);

  const loading = status === 'loading' || status === 'streaming';
  /**
   * Voile sur la zone messages : à la 1ʳᵉ question, la bulle grise (et le chevauchement avec la pilule)
   * restaient visibles pendant la phase « Distilling… » (réponses déjà là, synthèse pas encore streamée).
   * On masque le fil jusqu’au premier texte de synthèse — même moment où `ConsultingModelsStatus` se retire.
   */
  const showFirstQuestionConsultingVeil =
    turnHistory.length === 0 && loading && !synthesis.trim();
  /**
   * Ne pas utiliser useDeferredValue ici : au 2ᵉ message, l’état est remis à zéro mais la valeur
   * différée reste celle du tour précédent → ancienne question / réponse « fantômes » pendant le chargement.
   */
  const uiSynthesis = synthesis;
  const uiResponses = responses;
  const done = status === 'done';
  const parentWorkspaceHintsActive =
    !ignoreWorkspaceBootstrap &&
    (Boolean((initialQuestion ?? '').trim()) ||
      Boolean(initialDebateId) ||
      Boolean((initialSynthesis ?? '').trim()));
  const hasStarted =
    loading ||
    done ||
    Boolean(lastSubmitted.trim()) ||
    Boolean(debatePromptQuestion.trim()) ||
    turnHistory.length > 0 ||
    parentWorkspaceHintsActive;

  /** Plein écran : pas sur l’écran initial (props workspace seules) ; après 1er envoi / historique / chargement débat. */
  const showFullscreenButton =
    loading ||
    done ||
    Boolean(lastSubmitted.trim()) ||
    Boolean(debatePromptQuestion.trim()) ||
    turnHistory.length > 0;

  useLayoutEffect(() => {
    didApplyScrollRestoreRef.current = false;
    if (typeof window === 'undefined') {
      scrollRestoreTargetRef.current = null;
      return;
    }
    /**
     * Prendre le max entre sessionStorage, snapshot et clé dédiée : un démontage (Strict Mode,
     * ou sortie /chat avant fin de restore) peut écrire "0" en session alors que le snapshot LS
     * garde la vraie position — sinon le 1er lu gagnait et le scroll remontait en haut au retour.
     */
    const candidates: number[] = [];
    try {
      const ss = window.sessionStorage.getItem(sessionScrollKey);
      if (ss != null && ss !== '') {
        const v = parseInt(ss, 10);
        if (!Number.isNaN(v) && v >= 0) candidates.push(v);
      }
    } catch {
      // ignore
    }
    try {
      const snapRaw = window.localStorage.getItem(panelStorageKey);
      if (snapRaw) {
        const snap = JSON.parse(snapRaw) as { messageScrollTop?: unknown };
        if (
          typeof snap.messageScrollTop === 'number' &&
          !Number.isNaN(snap.messageScrollTop) &&
          snap.messageScrollTop >= 0
        ) {
          candidates.push(Math.round(snap.messageScrollTop));
        }
      }
    } catch {
      // ignore
    }
    try {
      const raw = window.localStorage.getItem(messageScrollLsKey);
      if (raw != null && raw !== '') {
        const p = parseInt(raw, 10);
        if (!Number.isNaN(p) && p >= 0) candidates.push(p);
      }
    } catch {
      // ignore
    }
    const n = candidates.length === 0 ? null : Math.max(...candidates);
    scrollRestoreTargetRef.current = n;
    if (n != null && n >= 0) {
      lastMessageScrollTopRef.current = n;
    }
  }, [messageScrollLsKey, panelStorageKey, sessionScrollKey]);

  const showCloseButton = (hasStarted || showClose) && !isFullscreen;
  const isPlusOrAbove = true; // PDF export free for everyone (UI flag)

  /** Source de vérité pour la persistance : mis à jour chaque render sans déclencher d’effet. */
  const persistSourceRef = useRef({
    mode,
    question,
    lastSubmitted,
    turnHistory,
    status,
    debateError,
    debateId,
    debateTitle,
    responses,
    consensusScore,
    hasDisagreement,
    disagreements,
    synthesis,
  });
  persistSourceRef.current = {
    mode,
    question,
    lastSubmitted,
    turnHistory,
    status,
    debateError,
    debateId,
    debateTitle,
    responses,
    consensusScore,
    hasDisagreement,
    disagreements,
    synthesis,
  };

  /** Snapshot JSON pour localStorage — toujours lu depuis `persistSourceRef` (y compris pagehide en plein stream). */
  const writePanelToLocalStorageSync = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;
      const s = persistSourceRef.current;
      const restoreT = scrollRestoreTargetRef.current;
      const pendingRestore =
        restoreT != null && restoreT > 0 && !didApplyScrollRestoreRef.current;

      let messageScrollTop: number;
      if (pendingRestore) {
        /** Ne jamais lire le DOM tant que la cible n’est pas appliquée (0 / valeur courte parasite). */
        messageScrollTop = Math.round(restoreT);
        lastMessageScrollTopRef.current = messageScrollTop;
      } else {
        const scrollEl = scrollRef.current;
        if (scrollEl) {
          lastMessageScrollTopRef.current = scrollEl.scrollTop;
        }
        messageScrollTop = Math.round(lastMessageScrollTopRef.current);
      }
      const payload = {
        v: PANEL_SNAPSHOT_VERSION,
        mode: s.mode,
        question: s.question,
        lastSubmitted: s.lastSubmitted,
        turnHistory: s.turnHistory,
        debateStatus: s.status,
        debateError: s.debateError,
        /** Au F5, `scrollRef` est souvent null au flush : on garde la dernière position en mémoire + dans le snapshot. */
        messageScrollTop,
        debate: {
          id: s.debateId,
          question: s.lastSubmitted,
          ai_responses: s.responses,
          consensus_score: s.consensusScore,
          has_disagreement: s.hasDisagreement,
          disagreement_details: s.disagreements,
          synthesis: s.synthesis,
        },
      };
      latestSnapshotRef.current = payload;
      window.localStorage.setItem(panelStorageKey, JSON.stringify(payload));
      /** Toujours persister (retour /chat) — ne pas dépendre de `isChatRoute` : au démontage la closure peut encore être « sur /chat » mais la clé dédiée doit suivre. */
      try {
        window.localStorage.setItem(messageScrollLsKey, String(messageScrollTop));
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }, [messageScrollLsKey, panelStorageKey]);

  // Restore local panel state before paint (useEffect = 1 frame « vide » visible).
  useLayoutEffect(() => {
    /** Inclut `initialDebateId` : sinon fermeture / nouveau débat / 2ᵉ question ne refont jamais l’hydratation. */
    const hydrationKey = `${panelId}::${panelStorageKey}::${initialDebateId ?? ''}`;
    if (panelHydrationKeyRef.current === hydrationKey) {
      return;
    }

    const prevKey = panelHydrationKeyRef.current;
    const prevParts = (prevKey ?? '').split('::');
    const prevDebateSuffix =
      prevParts.length >= 3 ? (prevParts[prevParts.length - 1] ?? '') : '';
    const nextDebateSuffix = initialDebateId ?? '';
    const mem = persistSourceRef.current;
    /** Parent synchronise l’id enfin connu : la mémoire React a déjà le tour terminé — ne pas écraser avec un vieux LS. */
    const skipLsHydrate =
      prevDebateSuffix === '' &&
      nextDebateSuffix !== '' &&
      mem.debateId === nextDebateSuffix &&
      (mem.status === 'done' || mem.status === 'error') &&
      (Boolean(mem.synthesis?.trim()) || mem.responses.length > 0);

    if (skipLsHydrate) {
      panelHydrationKeyRef.current = hydrationKey;
      didHydrateFromLocalRef.current = true;
      return;
    }

    panelHydrationKeyRef.current = hydrationKey;
    didHydrateFromLocalRef.current = false;

    /**
     * Reset explicite (Close) : à la mise à jour `initialDebateId → null`, cet effet
     * relisait le LS (souvent réécrit par un flush) et réinjectait turnHistory + questions.
     */
    if (ignoreWorkspaceBootstrap) {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            panelStorageKey,
            JSON.stringify(createEmptyPanelSnapshotRecord())
          );
        }
      } catch {
        // ignore
      }
      return;
    }

    const seedFromWorkspaceMetadata = () => {
      const q = (initialQuestion ?? '').trim();
      const syn = (initialSynthesis ?? '').trim();
      if (!initialDebateId) return;
      setQuestion('');
      if (q.length > 0 || syn.length > 0) {
        setLastSubmitted(initialQuestion ?? '');
        restorePersistedSnapshot({
          status: 'done',
          question: initialQuestion ?? '',
          debateTitle: null,
          responses: [],
          consensusScore: -1,
          hasDisagreement: false,
          disagreements: [],
          synthesis: initialSynthesis ?? '',
          debateId: initialDebateId,
          error: null,
        });
        didHydrateFromLocalRef.current = true;
        return;
      }
      /** Lien ou remplacement avec seul `debateId` : laisser `didHydrateFromLocalRef` à false pour le GET /api/debate. */
      setLastSubmitted('');
      setTurnHistory([]);
      restorePersistedSnapshot({
        status: 'loading',
        question: '',
        debateTitle: null,
        responses: [],
        consensusScore: -1,
        hasDisagreement: false,
        disagreements: [],
        synthesis: '',
        debateId: initialDebateId,
        error: null,
      });
    };

    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(panelStorageKey)
          : null;
      if (raw) {
        const saved = JSON.parse(raw) as {
          mode?: 'quick' | 'deep';
          v?: number;
          question?: string;
          lastSubmitted?: string;
          turnHistory?: ChatTurnSnapshot[];
          debateStatus?: DebateStatus;
          debateError?: string | null;
          debate?: {
            id?: string | null;
            title?: string;
            question?: string;
            ai_responses?: any[];
            consensus_score?: number;
            has_disagreement?: boolean;
            disagreement_details?: any[];
            synthesis?: string;
          };
        };
        const savedDebateId =
          typeof saved.debate?.id === 'string' && saved.debate.id.length > 0
            ? saved.debate.id
            : null;
        if (
          initialDebateId &&
          savedDebateId &&
          savedDebateId !== initialDebateId
        ) {
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(
                panelStorageKey,
                JSON.stringify(createEmptyPanelSnapshotRecord())
              );
            }
          } catch {
            // ignore
          }
        } else {
        if (saved.mode === 'quick' || saved.mode === 'deep') setMode(saved.mode);
        if (typeof saved.question === 'string') setQuestion(saved.question);
        if (typeof saved.lastSubmitted === 'string') setLastSubmitted(saved.lastSubmitted);
        if (Array.isArray(saved.turnHistory) && saved.turnHistory.length > 0) {
          setTurnHistory(saved.turnHistory);
        }

        const hasThread =
          Boolean(saved.lastSubmitted?.trim()) ||
          (saved.debate?.ai_responses?.length ?? 0) > 0 ||
          Boolean(saved.debate?.synthesis?.trim()) ||
          Boolean(saved.debate?.id);
        const hasHistoryOnly =
          !hasThread && (saved.turnHistory?.length ?? 0) > 0;

        if (hasThread || hasHistoryOnly) {
          didHydrateFromLocalRef.current = true;
          const coerced = saved.debateError
            ? ('error' as const)
            : coerceRestoredDebateStatus(saved.debateStatus, saved.debate);
          const t = saved.debate?.title?.trim();
          restorePersistedSnapshot({
            status: coerced,
            question: saved.debate?.question ?? saved.lastSubmitted ?? '',
            debateTitle: t && t.length > 0 ? t : null,
            responses: saved.debate?.ai_responses ?? [],
            consensusScore:
              typeof saved.debate?.consensus_score === 'number' &&
              saved.debate.consensus_score >= 0
                ? saved.debate.consensus_score
                : -1,
            hasDisagreement: Boolean(saved.debate?.has_disagreement),
            disagreements: saved.debate?.disagreement_details ?? [],
            synthesis: saved.debate?.synthesis ?? '',
            debateId: saved.debate?.id ?? null,
            error: saved.debateError ?? null,
          });
          return;
        }
        }
      }
      if (!didHydrateFromLocalRef.current) {
        seedFromWorkspaceMetadata();
      }
    } catch {
      seedFromWorkspaceMetadata();
    }
  }, [
    panelId,
    panelStorageKey,
    restorePersistedSnapshot,
    initialDebateId,
    initialQuestion,
    initialSynthesis,
    ignoreWorkspaceBootstrap,
  ]);

  // Cache débat (historique → chat) avant paint, comme le snapshot panneau.
  useLayoutEffect(() => {
    if (!initialDebateId) return;
    if (ignoreWorkspaceBootstrap) return;
    if (didHydrateFromLocalRef.current) return;
    try {
      const debateCacheKey = `mm_debate_cache_v1_${initialDebateId}`;
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(debateCacheKey)
          : null;
      const parsed = raw ? (JSON.parse(raw) as { ts?: number; data?: any }) : null;
      if (parsed?.data) {
        hydrateFromDebate(parsed.data as any);
        setLastSubmitted(parsed.data?.question ?? initialQuestion ?? '');
        setQuestion('');
        preferScrollThreadEndAfterLoadRef.current = true;
      }
    } catch {
      // ignore
    }
  }, [hydrateFromDebate, initialDebateId, initialQuestion, ignoreWorkspaceBootstrap]);

  // Hydrate panel from an initial debate id when provided.
  useEffect(() => {
    if (!initialDebateId) return;
    if (didHydrateFromLocalRef.current) return;
    /** Snapshot LS déjà à jour : pas de refetch (évite flash composer + reset scroll). */
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(panelStorageKey);
        if (raw) {
          const saved = JSON.parse(raw) as {
            debate?: {
              id?: string | null;
              synthesis?: string;
              ai_responses?: unknown[];
            };
          };
          const sid = saved?.debate?.id;
          if (sid === initialDebateId) {
            const hasBody =
              Boolean(
                typeof saved.debate?.synthesis === 'string' &&
                  saved.debate.synthesis.trim()
              ) ||
              (Array.isArray(saved.debate?.ai_responses) &&
                saved.debate.ai_responses.length > 0);
            if (hasBody) return;
          }
        }
      }
    } catch {
      // ignore
    }
    let cancelled = false;
    (async () => {
      const debateCacheKey = `mm_debate_cache_v1_${initialDebateId}`;

      if (cancelled) return;

      const res = await fetch(`/api/debate/${encodeURIComponent(initialDebateId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as Debate;
      if (cancelled) return;

      applyServerDebate(data);

      try {
        window.localStorage.setItem(
          debateCacheKey,
          JSON.stringify({
            ts: Date.now(),
            data,
          })
        );
      } catch {
        // ignore cache write
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyServerDebate, initialDebateId, ignoreWorkspaceBootstrap, panelStorageKey]);

  /*
   * Persistance : données lues dans `persistSourceRef` (pas de deps sur question/responses).
   * Pendant loading/streaming : pas de stringify fréquent (gelait le thread → nav sidebar morte).
   * Sauvegarde lourde : fin de tour + backup rare + pagehide (voir effets suivants).
   */
  const flushHeavyToDisk = useCallback(() => {
    if (typeof window === 'undefined' || !isChatRoute) return;
    const schedule =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (fn: () => void) =>
            window.requestIdleCallback(() => fn(), { timeout: 10_000 })
        : (fn: () => void) => setTimeout(fn, 0);

    schedule(() => {
      try {
        writePanelToLocalStorageSync();
        const s = persistSourceRef.current;
        const streamingOrLoading = s.status === 'loading' || s.status === 'streaming';
        if (!streamingOrLoading && latestSnapshotRef.current) {
          const payload = latestSnapshotRef.current;
          try {
            reportPanelSnapshot(
              panelId,
              structuredClone(payload) as Record<string, unknown>
            );
          } catch {
            reportPanelSnapshot(
              panelId,
              JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
            );
          }
        }
      } catch {
        // ignore
      }
    });
  }, [
    isChatRoute,
    panelId,
    reportPanelSnapshot,
    writePanelToLocalStorageSync,
  ]);

  /** Hors flux : debounce léger (deps minimales — pas `question` à chaque frappe). */
  useEffect(() => {
    if (typeof window === 'undefined' || !isChatRoute) return;
    if (status === 'loading' || status === 'streaming') return;
    const id = window.setTimeout(() => flushHeavyToDisk(), 800);
    return () => window.clearTimeout(id);
  }, [isChatRoute, status, flushHeavyToDisk]);

  /** Pendant le stream : pas de stringify périodique (gelait le thread). Sauvegarde = fin + pagehide. */

  /** Fin de tour : flush pour snapshot + workspace à jour. */
  useEffect(() => {
    if (!isChatRoute) return;
    if (status !== 'done' && status !== 'error') return;
    flushHeavyToDisk();
  }, [isChatRoute, status, flushHeavyToDisk]);

  useEffect(() => {
    const flush = () => writePanelToLocalStorageSync();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [writePanelToLocalStorageSync]);

  /**
   * Snapshot au démontage : `useLayoutEffect` cleanup s’exécute **avant** que React détache le DOM,
   * donc `scrollRef.current` est encore lisible. Un `useEffect` cleanup arrivait trop tard → scrollTop 0
   * persisté → retour sur /chat remontait au premier message.
   */
  useLayoutEffect(() => {
    return () => {
      if (!shouldPersistOnUnmountRef.current) return;
      const el = scrollRef.current;
      if (el) {
        lastMessageScrollTopRef.current = Math.round(el.scrollTop);
      }
      writePanelToLocalStorageSync();
      /** Aligner sessionStorage sur le snapshot (évite 0 en session alors que LS a la bonne position). */
      try {
        const raw = window.localStorage.getItem(panelStorageKey);
        if (raw) {
          const snap = JSON.parse(raw) as { messageScrollTop?: unknown };
          if (
            typeof snap.messageScrollTop === 'number' &&
            !Number.isNaN(snap.messageScrollTop)
          ) {
            window.sessionStorage.setItem(
              sessionScrollKey,
              String(Math.round(snap.messageScrollTop))
            );
          }
        } else if (el) {
          window.sessionStorage.setItem(
            sessionScrollKey,
            String(Math.round(el.scrollTop))
          );
        }
      } catch {
        // quota / mode privé
      }
    };
  }, [panelStorageKey, sessionScrollKey, writePanelToLocalStorageSync]);

  useEffect(() => {
    return () => {
      if (messageScrollPersistTimeoutRef.current !== null) {
        window.clearTimeout(messageScrollPersistTimeoutRef.current);
        messageScrollPersistTimeoutRef.current = null;
      }
    };
  }, []);

  // Notify parent when debate id / question utile au workspace change (pas `onDebateStart` en dep : inline parent → boucle × updatePanelSynthesis).
  useEffect(() => {
    if (!debateId) return;
    onDebateStartRef.current(
      debateId,
      lastSubmitted.trim() || debatePromptQuestion.trim() || (initialQuestion ?? '').trim()
    );
  }, [debateId, lastSubmitted, debatePromptQuestion, initialQuestion]);

  const scrollAnswerTopIntoView = useCallback(() => {
    const scrollEl = scrollRef.current;
    const anchor = answerTopAnchorRef.current;
    if (!scrollEl || !anchor) return;
    const scrollRect = scrollEl.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const delta = anchorRect.top - scrollRect.top;
    const padding = 12;
    scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + delta - padding);
    lastMessageScrollTopRef.current = scrollEl.scrollTop;
  }, []);

  /** Réponse longue : montrer le début (haut du bloc), pas auto-scroll vers le bas à chaque token. */
  useLayoutEffect(() => {
    const prev = prevLoadingForScrollRef.current;
    const restoreTarget = scrollRestoreTargetRef.current;
    const scrollRestoreStillPending =
      restoreTarget != null &&
      restoreTarget >= 1 &&
      !didApplyScrollRestoreRef.current;
    /** Ne pas écraser une position à restaurer (retour /chat, F5) avec le scroll « début de réponse ». */
    if (!scrollRestoreStillPending) {
      if (loading && !prev) {
        scrollAnswerTopIntoView();
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollAnswerTopIntoView);
        });
      }
      if (!loading && prev) {
        if (!preferScrollThreadEndAfterLoadRef.current) {
          requestAnimationFrame(() => scrollAnswerTopIntoView());
        }
      }
    }
    prevLoadingForScrollRef.current = loading;
  }, [loading, scrollAnswerTopIntoView]);

  /** Fin de conversation après hydratation API / cache (remplacement de slot, ouverture historique). */
  useEffect(() => {
    if (!preferScrollThreadEndAfterLoadRef.current) return;
    if (status !== 'done' && status !== 'error') return;

    let cancelled = false;
    let cleared = false;
    const clearFlag = () => {
      if (cleared) return;
      cleared = true;
      preferScrollThreadEndAfterLoadRef.current = false;
    };

    const tryScrollEnd = () => {
      if (cancelled || !preferScrollThreadEndAfterLoadRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max < 8) return;
      el.scrollTop = max;
      lastMessageScrollTopRef.current = el.scrollTop;
      didApplyScrollRestoreRef.current = true;
      clearFlag();
    };

    tryScrollEnd();
    const delays = [0, 50, 120, 280, 600, 1200, 2000];
    const ids = delays.map((ms) => window.setTimeout(tryScrollEnd, ms));
    const failSafe = window.setTimeout(() => clearFlag(), 4500);

    return () => {
      cancelled = true;
      ids.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(failSafe);
    };
  }, [status, turnHistory.length, synthesis, debateId, responses.length]);

  /** F5 / premier paint : appliquer le scroll dès que le conteneur existe (avant paint quand c’est possible). */
  useLayoutEffect(() => {
    if (!hasStarted) return;
    if (didApplyScrollRestoreRef.current) return;
    const target = scrollRestoreTargetRef.current;
    if (target === null || target < 1) return;
    const el = scrollRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    if (target > 0 && max < 1) return;
    el.scrollTop = Math.min(target, max);
    lastMessageScrollTopRef.current = el.scrollTop;
    /**
     * Ne marquer « restauration faite » que lorsque le fil a assez de hauteur pour atteindre la cible.
     * Sinon (max << target, ex. Markdown / motion pas encore mesurés), on croyait restaurer alors qu’on
     * clampait en bas d’un contenu partiel → au retour sur /chat le panneau 1 restait visuellement en haut.
     */
    if (max >= target - 1) {
      didApplyScrollRestoreRef.current = true;
      try {
        window.sessionStorage.removeItem(sessionScrollKey);
      } catch {
        // ignore
      }
    }
  }, [
    hasStarted,
    panelId,
    turnHistory.length,
    responses.length,
    synthesis,
    status,
    debateId,
    lastSubmitted,
    sessionScrollKey,
  ]);

  /**
   * Retour sur /chat : restaurer le scroll du fil (plusieurs passes : Markdown / motion mettent du temps à prendre leur hauteur).
   */
  useEffect(() => {
    if (!hasStarted) return;
    if (didApplyScrollRestoreRef.current) return;

    const target = scrollRestoreTargetRef.current;
    if (target === null) {
      didApplyScrollRestoreRef.current = true;
      return;
    }
    if (target < 1) {
      didApplyScrollRestoreRef.current = true;
      return;
    }

    let cancelled = false;
    let rafOuter = 0;
    let rafInner = 0;
    const apply = () => {
      if (cancelled || didApplyScrollRestoreRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (target > 0 && max < 1) return;
      el.scrollTop = Math.min(target, max);
      lastMessageScrollTopRef.current = el.scrollTop;
      if (max >= target - 1) {
        didApplyScrollRestoreRef.current = true;
        try {
          window.sessionStorage.removeItem(sessionScrollKey);
        } catch {
          // ignore
        }
        writePanelToLocalStorageSync();
      }
    };

    apply();
    rafOuter = window.requestAnimationFrame(() => {
      rafInner = window.requestAnimationFrame(apply);
    });
    const t0 = window.setTimeout(apply, 0);
    const t1 = window.setTimeout(apply, 80);
    const t2 = window.setTimeout(apply, 220);
    const t3 = window.setTimeout(apply, 500);
    const t4 = window.setTimeout(apply, 900);
    const t5 = window.setTimeout(apply, 1600);
    const t6 = window.setTimeout(apply, 2800);
    /** Écrire tant que `didApply` est false pour que `pendingRestore` garde la cible ; puis seulement marquer fini. */
    const tGiveUp = window.setTimeout(() => {
      if (!cancelled) {
        writePanelToLocalStorageSync();
        didApplyScrollRestoreRef.current = true;
        try {
          window.sessionStorage.removeItem(sessionScrollKey);
        } catch {
          // ignore
        }
      }
    }, 4200);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafOuter);
      window.cancelAnimationFrame(rafInner);
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
      window.clearTimeout(t6);
      window.clearTimeout(tGiveUp);
    };
  }, [
    hasStarted,
    panelId,
    turnHistory.length,
    responses.length,
    synthesis,
    status,
    debateId,
    lastSubmitted,
    writePanelToLocalStorageSync,
    sessionScrollKey,
  ]);

  /**
   * Snapshot LS après restauration scroll (useEffect, pas useLayoutEffect) : évite d’écrire
   * `messageScrollTop: 0` avant que le fil ait été repositionné.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'done' && status !== 'error') return;
    writePanelToLocalStorageSync();
  }, [status, writePanelToLocalStorageSync]);

  const handleScrollMessages = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    lastMessageScrollTopRef.current = el.scrollTop;
    const threshold = 100;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (!isChatRoute) return;
    if (messageScrollPersistTimeoutRef.current !== null) {
      window.clearTimeout(messageScrollPersistTimeoutRef.current);
    }
    messageScrollPersistTimeoutRef.current = window.setTimeout(() => {
      messageScrollPersistTimeoutRef.current = null;
      try {
        window.localStorage.setItem(
          messageScrollLsKey,
          String(Math.round(lastMessageScrollTopRef.current))
        );
      } catch {
        // ignore
      }
    }, 150);
  }, [isChatRoute, messageScrollLsKey]);

  // Ne pas appeler `onSynthesisReady` à chaque chunk : ça faisait `setPanels` → stringify localStorage × N.
  useEffect(() => {
    const cb = onSynthesisReadyRef.current;
    if (!cb) return;
    if (status !== 'done' && status !== 'error') return;
    if (!synthesis) return;
    cb(synthesis);
  }, [status, synthesis, hasPartnerSynthesisCb]);

  useEffect(() => {
    if (!onSynthesisReadyRef.current) return;
    if (status !== 'streaming' && status !== 'loading') return;
    const id = window.setInterval(() => {
      const cb = onSynthesisReadyRef.current;
      if (cb) cb(synthesisForPartnerRef.current);
    }, 500);
    return () => clearInterval(id);
  }, [status, hasPartnerSynthesisCb]);

  useLayoutEffect(() => {
    if (lastSubmitted === prevLastSubmittedForPartnerPushRef.current) return;
    prevLastSubmittedForPartnerPushRef.current = lastSubmitted;
    lastPushedPartnerLinkedThreadRef.current = null;
  }, [lastSubmitted]);

  /** Contexte synchronisé : tout le fil (historique + tour en cours). Layout = parent à jour avant paint (moins de race avec le repli méta). */
  useLayoutEffect(() => {
    const cb = onLinkedThreadReadyRef.current;
    if (!cb) return;
    if (status === 'loading' || status === 'streaming') return;
    const next = formatChatPanelThreadForLinkedContext(
      turnHistory,
      lastSubmitted,
      synthesis,
      status
    );
    if (next === lastPushedPartnerLinkedThreadRef.current) return;
    lastPushedPartnerLinkedThreadRef.current = next;
    cb(next);
  }, [status, turnHistory, lastSubmitted, synthesis, hasPartnerLinkedThreadCb]);

  /** Dernier layout du panneau : laisser tourner l’hydratation LS / cache avant le 1er paint utile. */
  useLayoutEffect(() => {
    setChatSessionPaintReady(true);
    return () => {
      setChatSessionPaintReady(false);
    };
  }, [panelId]);

  const showSessionRecoveryOverlay =
    isChatRoute && (!storageReady || !chatSessionPaintReady);

  useEffect(() => {
    if (!onLinkedThreadReadyRef.current) return;
    if (status !== 'streaming' && status !== 'loading') return;
    const push = () => {
      const cb = onLinkedThreadReadyRef.current;
      if (!cb) return;
      const next = linkedThreadForPartnerRef.current;
      if (next === lastPushedPartnerLinkedThreadRef.current) return;
      lastPushedPartnerLinkedThreadRef.current = next;
      cb(next);
    };
    push();
    const id = window.setInterval(push, 500);
    return () => clearInterval(id);
  }, [status, hasPartnerLinkedThreadCb]);

  /** Avant un nouveau `run`, garde le tour terminé dans l’historique scrollable. */
  const appendCompletedTurnBeforeNewRun = useCallback(() => {
    // Inclure `error` : sinon une 2ᵉ question efface le tour partiel / raté sans archive.
    if (status !== 'done' && status !== 'error') return;
    const hasContent =
      responses.length > 0 ||
      Boolean(synthesis?.trim()) ||
      Boolean(lastSubmitted.trim());
    if (!hasContent) return;
    setTurnHistory((h) => [
      ...h,
      {
        id: debateId ?? `turn-${Date.now()}-${h.length}`,
        question: lastSubmitted,
        debateId,
        responses: responses.map((r) => ({ ...r })),
        consensusScore,
        hasDisagreement,
        disagreements: [...disagreements],
        synthesis,
        mode,
        createdAt: Date.now(),
      },
    ]);
  }, [
    status,
    lastSubmitted,
    debateId,
    responses,
    synthesis,
    consensusScore,
    hasDisagreement,
    disagreements,
    mode,
  ]);

  const handleTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isAtLimit) {
        setShowUpgrade(true);
        return;
      }
      appendCompletedTurnBeforeNewRun();
      nearBottomRef.current = true;
      setLastSubmitted(trimmed);
      setQuestion('');
      onTransmit?.();
      run(trimmed, {
        mode,
        memoryContext: linkedContext ?? undefined,
        ...(defaultProjectId ? { projectId: defaultProjectId } : {}),
      });
    },
    [
      appendCompletedTurnBeforeNewRun,
      run,
      mode,
      linkedContext,
      onTransmit,
      isAtLimit,
      defaultProjectId,
    ]
  );

  const { state: voiceState, start: voiceStart, stop: voiceStop } = useVoice(handleTranscript);

  const handleSubmit = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (isAtLimit) {
        setShowUpgrade(true);
        return;
      }
      appendCompletedTurnBeforeNewRun();
      nearBottomRef.current = true;
      setLastSubmitted(trimmed);
      setQuestion('');
      onTransmit?.();
      run(trimmed, {
        mode,
        memoryContext: linkedContext ?? undefined,
        ...(defaultProjectId ? { projectId: defaultProjectId } : {}),
      });
    },
    [
      appendCompletedTurnBeforeNewRun,
      run,
      isAtLimit,
      mode,
      linkedContext,
      onTransmit,
      defaultProjectId,
    ]
  );

  const handleModeChange = useCallback((nextMode: 'quick' | 'deep') => {
    if (nextMode === 'quick') {
      setMode('quick');
      return;
    }
    setShowDeepModal(true);
  }, []);

  const handleNewChat = useCallback(() => {
    setIgnoreWorkspaceBootstrap(true);
    /**
     * Sans ça : `debateId → null` change la `key` du panneau → démontage → cleanup `useLayoutEffect`
     * rappelle `writePanelToLocalStorageSync()` avec l’ancien `persistSourceRef` (reset pas encore peint)
     * et écrase le snapshot vide écrit par le parent → le chat « ne se vide jamais ».
     */
    shouldPersistOnUnmountRef.current = false;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(messageScrollLsKey);
        window.sessionStorage.removeItem(sessionScrollKey);
      }
    } catch {
      // ignore
    }
    scrollRestoreTargetRef.current = null;
    didApplyScrollRestoreRef.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    reset();
    setQuestion('');
    setMode('quick');
    setLastSubmitted('');
    setTurnHistory([]);
    setIndividualModelsOpen(false);
    onDebateStart(null, '');
  }, [messageScrollLsKey, sessionScrollKey, onDebateStart, reset]);

  const sessionRestoringOverlay =
    showSessionRecoveryOverlay ? (
      <div
        className="flex flex-col items-center justify-center gap-3"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          className="h-9 w-9 animate-spin text-violet-600"
          strokeWidth={2}
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-violet-800">
            Restoring your session…
          </p>
          <p className="text-xs text-violet-600">
            Loading your conversation. This only takes a moment.
          </p>
        </div>
      </div>
    ) : undefined;

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden',
        isHiddenByFullscreen && 'hidden',
        isFullscreen &&
          cn(
            'fixed bottom-0 right-0 top-0 z-50 m-0 box-border flex min-h-0 flex-col overflow-hidden bg-white',
            'left-[var(--mm-sidebar-width,4rem)] h-dvh min-h-0 max-h-dvh w-[calc(100vw-var(--mm-sidebar-width,4rem))] min-w-0 max-w-none',
            'motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
            'motion-reduce:scale-100 motion-reduce:opacity-100',
            fullscreenEnter ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.99]'
          )
      )}
    >
      {isFullscreen && isChatRoute ? (
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title="Exit fullscreen"
          aria-label="Exit fullscreen"
          className="pointer-events-auto fixed right-0 top-0 z-[60] flex h-8 w-8 shrink-0 items-center justify-center rounded-bl-md border-b border-l border-neutral-700/90 bg-neutral-950 text-white shadow-[0_0_18px_rgba(255,255,255,0.55),0_4px_14px_rgba(255,255,255,0.35),0_2px_8px_rgba(255,255,255,0.25)] transition hover:bg-neutral-800 hover:text-white hover:shadow-[0_0_26px_rgba(255,255,255,0.7),0_5px_18px_rgba(255,255,255,0.45),0_2px_10px_rgba(255,255,255,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          <Minimize2 className="h-3.5 w-3.5 text-white" strokeWidth={2.75} stroke="white" aria-hidden />
        </button>
      ) : null}
      <DemoFrame
        variant={isFullscreen ? 'fullscreen' : 'card'}
        hideHeader={isFullscreen}
        fullHeight={hasStarted}
        overlay={sessionRestoringOverlay}
        actions={
          isFullscreen ? undefined : (
            <div className="flex items-center gap-1">
              {isChatRoute && showFullscreenButton ? (
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  title="Fullscreen"
                  className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              ) : null}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(true)}
                  title={showClose ? 'Close this panel' : 'Close conversation'}
                  className="rounded-lg p-1.5 font-bold text-white transition hover:bg-white/10"
                >
                  <X className="h-4 w-4 stroke-[2.75] text-white" />
                </button>
              )}
            </div>
          )
        }
      >
        {!hasStarted ? (
          <div className="flex flex-col gap-4">
            {linkedContext && (
              <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs text-violet-600">
                <RefreshCw className="h-3 w-3" />
                Synced - answers enriched with other conversation
              </div>
            )}
            <h2 className="text-lg font-semibold text-neutral-900">Ask a question</h2>
            <QuestionInput
              question={question}
              onQuestionChange={setQuestion}
              onSubmit={handleSubmit}
              mode={mode}
              onModeChange={handleModeChange}
              voiceState={voiceState}
              onVoiceStart={voiceStart}
              onVoiceStop={voiceStop}
              disabled={loading}
              isAtQuota={isAtLimit}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {linkedContext && (
              <div
                className={cn(
                  isFullscreen && 'mx-auto w-full max-w-3xl px-4 sm:px-5'
                )}
              >
                <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs text-violet-600">
                  <RefreshCw className="h-3 w-3" />
                  Synced - answers enriched with other conversation
                </div>
              </div>
            )}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {showFirstQuestionConsultingVeil ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 bg-white"
                  aria-hidden
                />
              ) : null}
              <ConsultingModelsStatus
                active={loading}
                responses={uiResponses}
                synthesis={uiSynthesis}
              />
              <div
                ref={scrollRef}
                onScroll={handleScrollMessages}
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]"
              >
                <div
                  className={cn(
                    'space-y-4',
                    isFullscreen
                      ? 'mx-auto w-full max-w-3xl px-4 sm:px-5'
                      : 'pr-4'
                  )}
                >
              {turnHistory.length > 0 ? (
                <div className="mb-2 space-y-8 border-b border-neutral-200/70 pb-6">
                  {turnHistory.map((turn) => (
                    <PastDebateTurn
                      key={`${turn.id}-${turn.createdAt}`}
                      turn={turn}
                      canExportPdf={isPlusOrAbove}
                    />
                  ))}
                </div>
              ) : null}
              {submittedQuestionBubbles.length > 0 ? (
                <div className="flex w-full flex-col gap-2">
                  {submittedQuestionBubbles.map((q, i) => (
                    <div
                      key={`submitted-q-${i}-${q.length}`}
                      className="flex w-full min-w-0 justify-end"
                    >
                      <div className="max-w-[80%] rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 break-words">
                        {q}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div
                ref={answerTopAnchorRef}
                className="h-0 w-full scroll-mt-3"
                aria-hidden
              />
              {status === 'error' && debateError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                >
                  {debateError === 'QUOTA_EXCEEDED' ? (
                    <p className="font-medium">{tChat('errorQuotaExceeded')}</p>
                  ) : debateError === 'ANONYMOUS_LIMIT' ? (
                    <p className="font-medium">{tChat('errorAnonymousLimit')}</p>
                  ) : (
                    <p className="font-medium">
                      {debateError === 'Stream interrupted'
                        ? tChat('errorStreamInterrupted')
                        : debateError === 'Network error'
                          ? tChat('errorNetwork')
                          : debateError === 'Request failed'
                            ? tChat('errorRequestFailed')
                            : debateError}
                    </p>
                  )}
                </div>
              ) : null}
              {(done ||
                (synthesis.trim() !== '' &&
                  status !== 'idle' &&
                  status !== 'error') ||
                (status === 'error' && responses.length > 0) ||
                (responses.length > 0 &&
                  (status === 'loading' || status === 'streaming'))) && (
                <>
                  {/*
                    Une seule carte : taux de consensus + synthèse + actions.
                    disableMotion pendant stream : pas d’anim d’entrée à chaque mise à jour.
                  */}
                  {(synthesis.trim() ||
                    responses.length > 0 ||
                    consensusScore >= 0) && (
                    <ManymindsAnswer
                      synthesis={uiSynthesis}
                      debateId={debateId}
                      canExportPdf={isPlusOrAbove}
                      mode={mode}
                      consensusScore={consensusScore}
                      debateLoading={loading}
                      responses={responses}
                      disagreements={disagreements}
                      providersOpen={individualModelsOpen}
                      onToggleProviders={() => setIndividualModelsOpen((v) => !v)}
                      disableMotion={loading}
                    />
                  )}
                </>
              )}
                </div>
              </div>
            </div>
            <div className="mt-4 shrink-0 border-t border-neutral-100 pt-4">
              {isFullscreen ? (
                <div className="mx-auto w-full max-w-3xl px-4 sm:px-5">
                  <DebateIndeterminateBar active={loading && !uiSynthesis.trim()} />
                  <QuestionInput
                    question={question}
                    onQuestionChange={setQuestion}
                    onSubmit={handleSubmit}
                    mode={mode}
                    onModeChange={handleModeChange}
                    voiceState={voiceState}
                    onVoiceStart={voiceStart}
                    onVoiceStop={voiceStop}
                    disabled={loading}
                    isAtQuota={isAtLimit}
                  />
                </div>
              ) : (
                <>
                  <DebateIndeterminateBar active={loading && !uiSynthesis.trim()} />
                  <QuestionInput
                    question={question}
                    onQuestionChange={setQuestion}
                    onSubmit={handleSubmit}
                    mode={mode}
                    onModeChange={handleModeChange}
                    voiceState={voiceState}
                    onVoiceStart={voiceStart}
                    onVoiceStop={voiceStop}
                    disabled={loading}
                    isAtQuota={isAtLimit}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </DemoFrame>

      <DeepModeModal
        open={showDeepModal}
        onConfirm={() => {
          setMode('deep');
          setShowDeepModal(false);
        }}
        onCancel={() => {
          setMode('quick');
          setShowDeepModal(false);
        }}
      />

      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-center font-bold text-neutral-900">
              {showClose ? (
                <>
                  Close this panel{' '}?
                </>
              ) : (
                <>
                  Close this conversation{' '}?
                </>
              )}
            </h3>
            <div className="mt-2 flex flex-col gap-2 text-center text-sm text-neutral-500">
              {showClose ? (
                <>
                  <p>Are you sure{' '}?</p>
                  <p>This panel will be removed from the layout.</p>
                  <p>
                    You can open this conversation again anytime from <strong>History</strong>.
                  </p>
                </>
              ) : (
                <>
                  <p>Are you sure you want to close it{' '}?</p>
                  <p>
                    This thread stays in <strong>History</strong> whenever you need it.
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  if (showClose) {
                    shouldPersistOnUnmountRef.current = false;
                    try {
                      if (typeof window !== 'undefined') {
                        window.localStorage.removeItem(panelStorageKey);
                      }
                    } catch {
                      // ignore
                    }
                    onClose();
                  } else {
                    handleNewChat();
                  }
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                {showClose ? 'Close panel' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        currentPlan={'free'}
      />
    </div>
  );
}

