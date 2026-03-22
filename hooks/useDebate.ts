'use client';

import { useCallback, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import {
  isBareFollowUpSignal,
  lastSubstantiveUserQuestionFromMerged,
} from '@/lib/debate-question-merge-split';
import type {
  AIResponse,
  Debate,
  DebateStreamEvent,
  DisagreementDetail,
} from '@/types';

export type DebateStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export interface DebateState {
  status: DebateStatus;
  question: string;
  /** Titre liste / historique (colonne `title` côté API). */
  debateTitle: string | null;
  responses: AIResponse[];
  consensusScore: number;
  hasDisagreement: boolean;
  disagreements: DisagreementDetail[];
  synthesis: string;
  debateId: string | null;
  error: string | null;
}

const initialState: DebateState = {
  status: 'idle',
  question: '',
  debateTitle: null,
  responses: [],
  /** -1 = pas encore calculé (évite un faux « 0 % » avant l’événement consensus). */
  consensusScore: -1,
  hasDisagreement: false,
  disagreements: [],
  synthesis: '',
  debateId: null,
  error: null,
};

type SynthesisProgressEvent =
  | { type: 'synthesis_step'; text: string }
  | { type: 'synthesis_chunk'; text: string }
  | { type: 'synthesis_done'; text: string };

type StreamEvent = DebateStreamEvent | SynthesisProgressEvent;

/** Id serveur réel (pas le marqueur anonyme) — conservé pendant loading/streaming pour tous les tours suivants. */
function isPersistableDebateId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.length > 0 && id !== 'anonymous';
}

function parseSseLine(line: string): unknown | null {
  const t = line.trim();
  if (!t.startsWith('data: ')) return null;
  const raw = t.slice(6).trim();
  if (!raw || raw === '[DONE]') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function useDebate() {
  const [state, setState] = useState<DebateState>(initialState);
  const [synthesisStep, setSynthesisStep] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const persistedDebateIdRef = useRef<string | null>(null);
  /** Toujours la dernière valeur React — évite un `run` obsolète (deps useCallback) sans `debate_id`. */
  const latestDebateIdRef = useRef<string | null>(null);
  const latestSynthesisRef = useRef('');
  const latestDebateTitleRef = useRef<string | null>(null);
  /** Dernier message utilisateur « réel » (hors ponctuelle seule . / ? / …) — suivi sans debate_id côté API (ex. anonyme). */
  const latestCompletedUserMessageRef = useRef('');
  latestDebateIdRef.current = state.debateId;
  latestSynthesisRef.current = state.synthesis;
  latestDebateTitleRef.current = state.debateTitle;

  const hydrateFromDebate = useCallback((debate: Debate) => {
    setSynthesisStep('');
    persistedDebateIdRef.current = isPersistableDebateId(debate.id) ? debate.id : null;
    latestCompletedUserMessageRef.current = lastSubstantiveUserQuestionFromMerged(debate.question);
    const rawTitle = debate.title?.trim();
    setState({
      status: 'done',
      question: debate.question ?? '',
      debateTitle: rawTitle && rawTitle.length > 0 ? rawTitle : null,
      responses: debate.ai_responses ?? [],
      consensusScore:
        typeof debate.consensus_score === 'number' && debate.consensus_score >= 0
          ? debate.consensus_score
          : -1,
      hasDisagreement: Boolean(debate.has_disagreement),
      disagreements: debate.disagreement_details ?? [],
      synthesis: debate.synthesis ?? '',
      debateId: debate.id,
      error: null,
    });
  }, []);

  const run = useCallback(
    async (
      question: string,
      opts?: {
        projectId?: string;
        mode?: 'quick' | 'deep' | 'thread_deep';
        memoryContext?: string;
      }
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const prevSynthesis = latestSynthesisRef.current;
      const requestedMode = opts?.mode ?? 'quick';
      const currentDebateId =
        persistedDebateIdRef.current ??
        (isPersistableDebateId(latestDebateIdRef.current)
          ? latestDebateIdRef.current
          : null);

      let outboundQuestion = question;
      if (isBareFollowUpSignal(question) && !currentDebateId) {
        const pq = latestCompletedUserMessageRef.current.trim();
        const ps = latestSynthesisRef.current.trim();
        if (pq || ps) {
          outboundQuestion = `The user only sent punctuation (e.g. "?" or ".") with no other words—often because the answer felt cut off, they forgot a full question, or they need clarification. Use the previous question and the previous ManyMinds consensus answer below to infer what they want, then respond helpfully.\n\nPrevious question:\n${pq || '(none)'}\n\nPrevious answer:\n${ps || '(none)'}`;
        }
      }
      if (!isBareFollowUpSignal(question)) {
        latestCompletedUserMessageRef.current = question.trim();
      }

      setSynthesisStep('');
      const keepDebateTitle =
        currentDebateId &&
        isPersistableDebateId(latestDebateIdRef.current) &&
        latestDebateIdRef.current === currentDebateId
          ? latestDebateTitleRef.current
          : null;
      setState({
        ...initialState,
        /** Garde l’id pendant un suivi : évite effets (sync panneau) qui croient à une « nouvelle » conversation. */
        debateId: currentDebateId,
        status: 'loading',
        question,
        debateTitle: keepDebateTitle,
      });

      track('debate_started', {});

      const flags = { receivedTerminal: false };

      const applyEvent = (event: StreamEvent) => {
        if (event.type === 'ai_response') {
          setState((s) => ({
            ...s,
            status: 'streaming',
            responses: [
              ...s.responses,
              {
                model: event.model,
                displayName: event.displayName,
                content: event.content,
                latency_ms: event.latency_ms,
                ...(event.error && { error: event.error }),
              },
            ],
          }));
        } else if (event.type === 'consensus') {
          setState((s) => ({
            ...s,
            consensusScore: event.score,
            hasDisagreement: event.has_disagreement,
            disagreements: event.disagreements,
          }));
        } else if (event.type === 'synthesis_step') {
          setSynthesisStep(event.text);
        } else if (event.type === 'synthesis_chunk') {
          setState((s) => ({
            ...s,
            synthesis: s.synthesis + (s.synthesis ? '\n\n' : '') + event.text,
          }));
        } else if (event.type === 'synthesis_done') {
          setSynthesisStep('');
          setState((s) => ({ ...s, synthesis: event.text }));
        } else if (event.type === 'synthesis') {
          setState((s) => ({ ...s, synthesis: event.content }));
        } else if (event.type === 'done') {
          flags.receivedTerminal = true;
          if (isPersistableDebateId(event.debate_id)) {
            persistedDebateIdRef.current = event.debate_id;
          }
          setState((s) => {
            track('debate_completed', {
              debate_id: event.debate_id,
              consensus_score: s.consensusScore,
              response_count: s.responses.length,
            });
            return {
              ...s,
              status: 'done',
              debateId: event.debate_id,
              error: null,
            };
          });
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('mm_quota_changed'));
            }
          } catch {
            // ignore
          }
        } else if (event.type === 'error') {
          flags.receivedTerminal = true;
          setState((s) => ({
            ...s,
            status: 'error',
            error: event.message,
          }));
        }
      };

      try {
        const res = await fetch('/api/debate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            question: outboundQuestion,
            mode: requestedMode,
            input_language: 'en',
            ...(opts?.projectId ? { project_id: opts.projectId } : {}),
            ...(requestedMode === 'thread_deep' ? { context: prevSynthesis } : {}),
            ...(currentDebateId ? { debate_id: currentDebateId } : {}),
            memoryContext: opts?.memoryContext ?? null,
          }),
        });

        if (res.status === 429) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setState((s) => ({
            ...s,
            status: 'error',
            error:
              data?.error === 'ANONYMOUS_LIMIT'
                ? 'ANONYMOUS_LIMIT'
                : 'QUOTA_EXCEEDED',
          }));
          return;
        }

        if (!res.ok || !res.body) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: 'Request failed',
          }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const parsed = parseSseLine(line);
            if (parsed && typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
              applyEvent(parsed as StreamEvent);
            }
          }
        }

        // Dernière ligne souvent sans \n final : sans ça, `done` n'est jamais vu → UI bloquée.
        if (buffer.trim()) {
          for (const line of buffer.split(/\r?\n/)) {
            const parsed = parseSseLine(line);
            if (parsed && typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
              applyEvent(parsed as StreamEvent);
            }
          }
        }

        if (!flags.receivedTerminal) {
          setSynthesisStep('');
          setState((s) => ({
            ...s,
            status: s.synthesis.trim() ? 'done' : 'error',
            error: s.synthesis.trim() ? null : 'Stream interrupted',
          }));
        }
      } catch (e) {
        const aborted =
          (e instanceof DOMException && e.name === 'AbortError') ||
          (e instanceof Error && e.name === 'AbortError');
        if (aborted) {
          return;
        }
        setState((s) => ({
          ...s,
          status: 'error',
          error: 'Network error',
        }));
      } finally {
        if (abortRef.current === ac) {
          abortRef.current = null;
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    persistedDebateIdRef.current = null;
    latestCompletedUserMessageRef.current = '';
    setSynthesisStep('');
    setState(initialState);
  }, []);

  /** Restauration depuis localStorage (fermeture navigateur / onglet). */
  const restorePersistedSnapshot = useCallback((snap: DebateState) => {
    setSynthesisStep('');
    persistedDebateIdRef.current = isPersistableDebateId(snap.debateId)
      ? snap.debateId
      : null;
    latestCompletedUserMessageRef.current = lastSubstantiveUserQuestionFromMerged(snap.question);
    setState(snap);
  }, []);

  return {
    ...state,
    synthesisStep,
    hydrateFromDebate,
    restorePersistedSnapshot,
    run,
    reset,
  };
}
