'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PricingCard } from '@/components/marketing/PricingCard';
import { PLANS } from '@/lib/stripe/plans';
import { useQuota } from '@/hooks/useQuota';

export default function UpgradePage() {
  const t = useTranslations('marketing');
  const { plan, isAnonymous } = useQuota();
  const [annual, setAnnual] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold text-neutral-900">Upgrade</h1>
      {isAnonymous ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
          You’re browsing in anonymous mode. Plans are visible, but upgrades and billing actions are disabled.
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            !annual ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          {t('monthly')}
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            annual ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          {t('annual')}
        </button>
      </div>
      <div className={`relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4 ${isAnonymous ? 'select-none' : ''}`}>
        {PLANS.map((p) => (
          <PricingCard
            key={p.id}
            plan={p}
            annual={annual}
            isPopular={p.id === 'pro'}
            currentPlan={plan}
          />
        ))}
        {isAnonymous ? (
          <div className="absolute inset-0 z-10 cursor-not-allowed rounded-2xl bg-transparent" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
