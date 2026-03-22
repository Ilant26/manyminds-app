'use client';

import { useEffect, useMemo, useState } from 'react';
import { AI_MODELS } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import type { AIResponse } from '@/types';

const DISPLAY_ORDER = AI_MODELS.map((m) => m.displayName);
const ROTATE_MS = 2200;

interface ConsultingModelsStatusProps {
  active: boolean;
  responses: AIResponse[];
  synthesis?: string;
}

/**
 * Thin violet progress bar — above the composer (see ChatPanel).
 */
export function DebateIndeterminateBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none mb-3 h-0.5 w-full shrink-0 overflow-hidden rounded-full bg-neutral-100/90"
      aria-hidden
    >
      <div className="h-full w-[35%] rounded-full bg-gradient-to-r from-transparent via-violet-500/75 to-transparent motion-reduce:animate-none motion-safe:animate-mm-bar-slide" />
    </div>
  );
}

type PhrasePart = { kind: 'text'; value: string } | { kind: 'em'; value: string };

const PHASE2_AND_3_LINES = [
  'Cross-checking answers across AIs',
  'Aligning what each AI said',
  'Building your final answer',
  'Distilling the most relevant takeaways',
] as const;

/**
 * Loading copy: consult AIs one by one → cross-check → final answer (English).
 */
export function ConsultingModelsStatus({
  active,
  responses,
  synthesis = '',
}: ConsultingModelsStatusProps) {
  const [tick, setTick] = useState(0);
  const completed = useMemo(
    () => new Set(responses.map((r) => r.displayName).filter(Boolean)),
    [responses]
  );
  const focusName = useMemo(
    () => DISPLAY_ORDER.find((n) => !completed.has(n)) ?? null,
    [completed]
  );
  const allAnswered = completed.size >= DISPLAY_ORDER.length;
  const hasSynth = Boolean(synthesis?.trim());

  useEffect(() => {
    if (!active || hasSynth) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [active, hasSynth]);

  const phraseParts = useMemo((): PhrasePart[] => {
    if (allAnswered && !hasSynth) {
      const line = PHASE2_AND_3_LINES[tick % PHASE2_AND_3_LINES.length] ?? PHASE2_AND_3_LINES[0];
      return [{ kind: 'text', value: line }];
    }

    if (!allAnswered && !hasSynth) {
      if (responses.length === 0) {
        return [{ kind: 'text', value: 'Reaching out to AIs' }];
      }
      if (focusName) {
        return [
          { kind: 'text', value: 'Consulting ' },
          { kind: 'em', value: focusName },
        ];
      }
      return [{ kind: 'text', value: 'Reaching out to AIs' }];
    }

    return [{ kind: 'text', value: 'Reaching out to AIs' }];
  }, [allAnswered, hasSynth, responses.length, focusName, tick]);

  if (!active || hasSynth) return null;

  return (
    <div
      className="pointer-events-none absolute right-5 top-2 z-20 sm:right-7 sm:top-2.5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          'flex max-w-[min(calc(100vw-2.5rem),19rem)] items-start gap-2.5 rounded-2xl sm:max-w-[21rem]',
          /* Fond opaque + pas de backdrop-blur : évite le « double » gris derrière la pilule */
          'border-2 border-violet-400/70 bg-white px-3 py-2',
          /* Halo blanc fort + léger relief violet */
          'shadow-[0_0_28px_rgba(255,255,255,0.95),0_0_52px_rgba(255,255,255,0.85),0_0_80px_rgba(255,255,255,0.55),0_4px_20px_rgba(109,40,217,0.18)]'
        )}
      >
        <span
          className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-violet-300 border-t-violet-600 motion-safe:animate-spin"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-neutral-800">
          {phraseParts.map((part, i) =>
            part.kind === 'em' ? (
              <span key={i} className="font-bold text-violet-700">
                {part.value}
              </span>
            ) : (
              <span key={i} className="text-neutral-900">
                {part.value}
              </span>
            )
          )}
          <span
            className="ml-0.5 inline-block min-w-[1.1em] font-bold text-violet-600 motion-safe:animate-mm-thinking-dots"
            aria-hidden
          >
            …
          </span>
        </p>
      </div>
    </div>
  );
}
