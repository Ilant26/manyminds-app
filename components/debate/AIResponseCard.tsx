'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIResponse } from '@/types';
import { MarkdownLite } from './MarkdownLite';

type AIResponseCardVariant = 'grid' | 'list';

interface AIResponseCardProps {
  response: AIResponse;
  index?: number;
  variant?: AIResponseCardVariant;
  /** List rows: header only until expanded (errors start expanded). */
  collapsible?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  ChatGPT: '#10B981',
  Claude: '#D97706',
  Gemini: '#3B82F6',
  DeepSeek: '#8B5CF6',
  Perplexity: '#06B6D4',
  Grok: '#EC4899',
};

export function AIResponseCard({
  response,
  index = 0,
  variant = 'grid',
  collapsible = false,
}: AIResponseCardProps) {
  const t = useTranslations('debate');
  const providerColor =
    response.error ? '#ef4444' : PROVIDER_COLORS[response.displayName] ?? 'rgb(139 92 246)';

  const isList = variant === 'list';
  const [rowOpen, setRowOpen] = useState(() => Boolean(response.error));

  if (collapsible && isList) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
        style={{ borderLeftWidth: 3, borderLeftColor: providerColor }}
      >
        <button
          type="button"
          onClick={() => setRowOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-neutral-50/80"
          aria-expanded={rowOpen}
        >
          <span className="text-xs font-semibold text-neutral-900">{response.displayName}</span>
          <div className="flex shrink-0 items-center gap-2">
            {!response.error && (
              <span className="hidden text-[11px] text-neutral-400 sm:inline">
                {t('latency', { ms: response.latency_ms })}
              </span>
            )}
            <ChevronDown
              className={cn('h-4 w-4 text-neutral-500 transition-transform', rowOpen && 'rotate-180')}
              aria-hidden
            />
          </div>
        </button>
        {rowOpen ? (
          <div className="border-t border-neutral-100 px-3 py-3">
            {response.error ? (
              <p className="text-sm text-red-600">{response.error}</p>
            ) : (
              <MarkdownLite text={response.content} className="text-neutral-900" />
            )}
          </div>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={
        isList
          ? 'rounded-xl border border-neutral-100 bg-neutral-50 p-3 shadow-sm transition-all'
          : 'rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-violet-300'
      }
      style={
        isList
          ? { borderLeftWidth: 3, borderLeftColor: providerColor, borderTopWidth: 1 }
          : { borderTopWidth: 3, borderTopColor: providerColor }
      }
    >
      <div className={isList ? 'mb-1 flex items-center justify-between gap-2' : 'mb-2 flex items-center justify-between'}>
        <span
          className={isList ? 'text-xs font-semibold text-neutral-500' : 'font-semibold text-neutral-900'}
        >
          {response.displayName}
        </span>
        {!response.error && !isList && (
          <span className="text-xs text-neutral-500">
            {t('latency', { ms: response.latency_ms })}
          </span>
        )}
      </div>
      {response.error ? (
        <p className={isList ? 'text-sm text-red-600' : 'text-sm text-red-500'}>{response.error}</p>
      ) : (
        <MarkdownLite
          text={response.content}
          className={isList ? 'text-neutral-900' : 'leading-relaxed text-neutral-900'}
        />
      )}
    </motion.div>
  );
}
