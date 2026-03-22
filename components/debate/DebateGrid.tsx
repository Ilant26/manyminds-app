'use client';

import { AIResponseCard } from './AIResponseCard';
import type { AIResponse } from '@/types';

interface DebateGridProps {
  responses: AIResponse[];
  /** Chat: each model row is collapsed until opened. */
  collapsibleRows?: boolean;
}

export function DebateGrid({ responses, collapsibleRows = false }: DebateGridProps) {
  return (
    <div className={collapsibleRows ? 'space-y-2' : 'space-y-3'}>
      {responses.map((r, i) => (
        <AIResponseCard
          key={r.model}
          response={r}
          index={i}
          variant="list"
          collapsible={collapsibleRows}
        />
      ))}
    </div>
  );
}
