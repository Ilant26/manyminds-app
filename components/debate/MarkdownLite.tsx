'use client';

import type { ReactNode } from 'react';
import { preprocessReadableModelText } from '@/lib/format-model-response';
import { cn } from '@/lib/utils';

/** Transforme `**texte**` en gras sans afficher les astérisques. */
function parseInlineBold(s: string): ReactNode {
  if (!s.includes('**')) return s;
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      <strong key={`b-${key++}`} className="font-bold text-neutral-900">
        {m[1]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length > 0 ? <>{parts}</> : s;
}

/**
 * Affiche un texte type synthèse : lignes `## Titre` en titre noir gras (sans #),
 * `**gras**` rendu en gras, pas de marqueurs markdown visibles.
 */
export function MarkdownLite({
  text,
  className,
  /** Retirer [1][2] et fusionner les retours à la ligne « doux » (défaut : oui). */
  preprocess = true,
}: {
  text: string;
  className?: string;
  preprocess?: boolean;
}) {
  const raw = preprocess ? preprocessReadableModelText(text) : text;
  const lines = raw.split('\n');
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed text-neutral-900', className)}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const h = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (h) {
          return (
            <p key={i} className="font-bold text-neutral-900">
              {parseInlineBold(h[2])}
            </p>
          );
        }
        if (trimmed === '') {
          return <div key={i} className="h-1 shrink-0" aria-hidden />;
        }
        return (
          <p key={i} className="text-neutral-900">
            {parseInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
