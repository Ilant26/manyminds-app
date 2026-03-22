'use client';

import { GitBranch } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CONSENSUS_FALLBACK_DISAGREEMENT_TOPIC } from '@/lib/consensus-ui';
import type { DisagreementDetail } from '@/types';

interface DisagreementFlagProps {
  disagreements: DisagreementDetail[];
}

export function DisagreementFlag({ disagreements }: DisagreementFlagProps) {
  const t = useTranslations('debate');
  if (disagreements.length === 0) return null;

  const onlyFallbackOverlap = disagreements.every(
    (d) => d.topic === CONSENSUS_FALLBACK_DISAGREEMENT_TOPIC
  );

  return (
    <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/40 to-stone-50/80 p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100/80 text-violet-600"
          aria-hidden
        >
          <GitBranch className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-800">
            {onlyFallbackOverlap ? t('disagreementTitleFallback') : t('disagreementTitle')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            {onlyFallbackOverlap ? t('disagreementLeadFallback') : t('disagreementLead')}
          </p>
        </div>
      </div>
      <ul className="ml-0 space-y-3 border-t border-violet-100/60 pt-3 sm:ml-11">
        {disagreements.map((d, i) =>
          d.topic === CONSENSUS_FALLBACK_DISAGREEMENT_TOPIC ? (
            <li key={i} className="text-sm leading-relaxed text-neutral-700">
              <span className="font-medium text-violet-900/90">{t('disagreementFallbackTitle')}</span>
              <p className="mt-1 text-neutral-600">{t('disagreementFallbackBody')}</p>
            </li>
          ) : (
            <li
              key={i}
              className="rounded-lg border border-white/60 bg-white/50 px-3 py-2.5 text-sm leading-relaxed text-neutral-700 shadow-sm"
            >
              <span className="font-medium text-violet-900/85">{d.topic}</span>
              {d.description ? (
                <span className="mt-1 block text-neutral-600">{d.description}</span>
              ) : null}
            </li>
          )
        )}
      </ul>
    </div>
  );
}
