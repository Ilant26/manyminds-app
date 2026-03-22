'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/stripe/plans';
import type { Plan } from '@/types';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan: Plan;
  onSelectPlan?: (priceId: string) => void;
}

export function UpgradeModal({
  open,
  onClose,
  currentPlan,
  onSelectPlan,
}: UpgradeModalProps) {
  const t = useTranslations('marketing');
  const tCommon = useTranslations('common');
  const tUpgrade = useTranslations('upgrade');

  if (!open) return null;

  const paidPlans = PLANS.filter((p) => p.id !== 'free');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#2d2d2a] bg-[#0a0a08] p-8 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-[#888885] hover:bg-[#1a1a18] hover:text-[#f5f5f3]"
          aria-label={tCommon('close')}
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold text-[#f5f5f3]">
          {t('pricing')}
        </h2>
        <p className="mt-2 text-[#888885]">
          {t('monthly')} / {t('annual')} toggle — choose your plan.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {paidPlans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 ${
                plan.id === 'pro'
                  ? 'border-[#e8ff47]/50 bg-[#e8ff47]/5'
                  : 'border-[#2d2d2a] bg-[#1a1a18]'
              }`}
            >
              {plan.id === 'pro' && (
                <span className="mb-2 block text-xs font-semibold text-[#e8ff47]">
                  {t('mostPopular')}
                </span>
              )}
              <h3 className="text-lg font-bold text-[#f5f5f3]">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-[#f5f5f3]">
                ${plan.price_monthly}
                <span className="text-sm font-normal text-[#888885]">{t('perMonth')}</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#888885]">
                {plan.features.slice(0, 3).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full bg-[#e8ff47] text-[#0a0a08] hover:bg-[#e8ff47]/90"
                disabled={currentPlan === plan.id}
                onClick={() => {
                  if (plan.id === currentPlan) return;
                  const priceId = plan.stripe_price_id_monthly;
                  if (onSelectPlan && priceId) onSelectPlan(priceId);
                  else if (priceId) {
                    window.location.href = `/api/checkout?priceId=${priceId}`;
                  }
                }}
              >
                {currentPlan === plan.id ? tUpgrade('currentPlan') : tCommon('upgrade')}
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/pricing" className="text-sm text-[#e8ff47] hover:underline">
            View full pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
