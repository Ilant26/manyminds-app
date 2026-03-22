'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { PricingCard } from '@/components/marketing/PricingCard';
import { PLANS } from '@/lib/stripe/plans';
import type { Plan } from '@/types';
import { FreeAccountModal } from '@/components/shared/FreeAccountModal';

const TOPUPS = [
  { id: 'starter', name: 'Starter', price: 5, credits: 40, isPopular: false },
  { id: 'power', name: 'Power', price: 10, credits: 80, isPopular: true },
  { id: 'max', name: 'Max', price: 20, credits: 150, isPopular: false },
] as const;

export function PlanBillingModal({
  open,
  onClose,
  plan,
  used,
  limit,
  isAnonymous,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  used: number;
  limit: number;
  isAnonymous: boolean;
}) {
  if (!open) return null;

  const [annual, setAnnual] = useState(true);
  const [showFreeAccount, setShowFreeAccount] = useState(false);
  const ratio = limit > 0 ? used / limit : 0;
  const progress = Math.max(0, Math.min(1, ratio));
  const progressPct = Math.round(progress * 100);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl max-h-[98vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-center text-2xl font-bold text-neutral-900">Plan</h2>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* 1) Usage */}
          <section className="mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <h3 className="text-lg font-semibold text-neutral-900 text-center">Usage</h3>

            <div className="mt-2 flex items-start gap-4">
              <PlanBadge plan={isAnonymous ? 'free' : plan} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-sm text-neutral-600 whitespace-nowrap tabular-nums">
                {used} / {limit} {isAnonymous ? 'conversations (last 24h)' : 'conversations this month'}
              </span>

              <div className="w-full">
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-violet-600"
                    style={{ width: `${progressPct}%` }}
                    aria-hidden
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-neutral-500">
                  <span className="whitespace-nowrap">{progressPct}% used</span>
                  <span className="whitespace-nowrap">{Math.max(0, limit - used)} left</span>
                </div>
              </div>
            </div>
            </div>
          </section>

          {/* 2) Subscriptions */}
          <section className="mt-2 rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="relative flex items-center justify-center">
              <h3 className="text-lg font-semibold text-neutral-900 text-center">Subscriptions</h3>
              <div className="absolute right-0 flex items-center gap-2 rounded-xl bg-neutral-100 p-1">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    !annual ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    annual ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Annual{' '}
                  <span className="ml-1 rounded-md bg-violet-100 px-2 py-0.5 text-[12px] font-semibold text-violet-900">
                    -20%
                  </span>
                </button>
              </div>
            </div>

            <div
              className={`relative mt-4 grid grid-cols-6 gap-2 ${isAnonymous ? 'select-none' : ''}`}
            >
              {PLANS.map((p) => (
                <PricingCard
                  key={p.id}
                  plan={p}
                  annual={annual}
                  isPopular={p.id === 'pro'}
                  currentPlan={plan}
                  isAnonymous={isAnonymous}
                  onAnonymousAction={() => setShowFreeAccount(true)}
                />
              ))}
            </div>
          </section>

          {/* 3) Topups */}
          <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3">
            <h3 className="text-lg font-semibold text-neutral-900 text-center">Top-ups</h3>
            <p className="mt-1 text-center text-sm text-neutral-600">
              Add credits instantly without changing your subscription.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {TOPUPS.map((tp) => (
                <div
                  key={tp.id}
                  className={`relative flex min-h-[165px] flex-col rounded-2xl border p-4 shadow-sm ${
                    tp.isPopular
                      ? 'border-violet-400/80 bg-gradient-to-b from-violet-500/5 via-white to-white ring-1 ring-violet-400/70'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  {tp.isPopular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700 shadow-sm shadow-violet-400/30">
                      Popular
                    </span>
                  ) : null}

                  <h4 className="text-base font-semibold text-neutral-900">{tp.name}</h4>
                  <div className="mt-4 text-3xl font-bold text-neutral-900">
                    ${tp.price}
                    <span className="ml-2 text-sm font-semibold text-neutral-500">/ pack</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-neutral-600">
                    {tp.credits} credits
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isAnonymous) {
                        setShowFreeAccount(true);
                        return;
                      }
                      // No top-up checkout flow yet; sending user to billing management.
                      window.open('https://billing.stripe.com/p/login/test', '_blank', 'noopener,noreferrer');
                    }}
                    className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800"
                    title={isAnonymous ? 'Sign in to top up' : 'Manage top up'}
                  >
                    Top up
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <FreeAccountModal open={showFreeAccount} onClose={() => setShowFreeAccount(false)} />
      </div>
    </div>
  );
}

