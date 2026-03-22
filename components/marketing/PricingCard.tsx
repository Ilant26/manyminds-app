'use client';

import type { PlanConfig } from '@/types';

interface PricingCardProps {
  plan: PlanConfig;
  annual: boolean;
  isPopular?: boolean;
  currentPlan?: string;
  isAnonymous?: boolean;
  onAnonymousAction?: () => void;
}

export function PricingCard({
  plan,
  annual,
  isPopular,
  currentPlan,
  isAnonymous = false,
  onAnonymousAction,
}: PricingCardProps) {
  const price = annual ? plan.price_annual : plan.price_monthly;
  const isPriceOnRequest = price < 0;
  const enterpriseMailto = 'mailto:contact@manyminds.io';
  const isFree = plan.id === 'free';
  const isCurrentPlan = currentPlan === plan.id;

  const openStripeCheckout = () => {
    const url = `/api/checkout?plan=${encodeURIComponent(plan.id)}&annual=${annual ? '1' : '0'}`;

    // En mode anonyme, on ouvre d'abord le popup "Free account".
    if (isAnonymous) {
      onAnonymousAction?.();
      return;
    }

    // Si c'est déjà ton plan, on pointe vers la gestion de billing au lieu de tenter de repasser checkout.
    if (isCurrentPlan) {
      window.open('https://billing.stripe.com/p/login/test', '_blank', 'noopener,noreferrer');
      return;
    }

    // Popup (souvent bloquée si non déclenchée par un clic direct).
    const w = 520;
    const h = 740;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
    const popup = window.open(
      url,
      'stripeCheckout',
      `popup=yes,width=${w},height=${h},left=${left},top=${top}`
    );
    if (!popup) {
      // Fallback si le navigateur bloque la popup.
      window.location.href = url;
    }
  };

  return (
    <div
      className={`relative flex min-h-[180px] flex-col rounded-2xl border bg-white p-4 text-center shadow-sm transition-transform transition-shadow duration-200 sm:p-4 ${
        isPopular
          ? 'border-violet-400/80 bg-gradient-to-b from-violet-500/5 via-white to-white shadow-md shadow-violet-500/25 ring-1 ring-violet-400/70 ring-offset-2 ring-offset-neutral-950'
          : 'border-neutral-200 hover:shadow-md hover:-translate-y-1'
      }`}
    >
      {isPopular && (
        <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-violet-700 shadow-sm shadow-violet-400/30">
          Popular
        </span>
      )}
      <h3 className="truncate text-sm font-semibold tracking-tight text-neutral-900">
        {plan.name}
      </h3>
      <div className="mt-2 flex justify-center">
        <div className="h-px w-10 bg-neutral-200" />
      </div>
      <div className="mt-2 whitespace-nowrap">
        {isPriceOnRequest ? (
          <span className="mb-0.5 text-sm font-semibold tracking-tight text-neutral-900">
            On demand
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap leading-none">
            <span className="text-2xl font-bold leading-none tracking-tight text-neutral-900">
              {price === 0 ? '$0' : `$${price}`}
            </span>
            {price > 0 && (
              <span className="relative top-[-2px] text-[11px] font-medium leading-none text-neutral-500">
                /mo
              </span>
            )}
          </span>
        )}
      </div>
      <p className="mt-2 min-h-[1.1rem] text-sm font-medium text-neutral-600 whitespace-nowrap">
        {!isPriceOnRequest ? `${plan.requests_limit.toLocaleString()} credits/mo` : '\u00A0'}
      </p>
      {isPriceOnRequest ? (
        <a
          href={enterpriseMailto}
          className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800"
          onClick={(e) => {
            if (isAnonymous) {
              e.preventDefault();
              onAnonymousAction?.();
            }
          }}
        >
          Contact us
        </a>
      ) : isFree ? (
        <a
          href="/chat"
          className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
          onClick={(e) => {
            if (isAnonymous) {
              e.preventDefault();
              onAnonymousAction?.();
            }
          }}
        >
          {currentPlan === plan.id ? 'Current plan' : 'Get started'}
        </a>
      ) : (
        <button
          type="button"
          onClick={openStripeCheckout}
          className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          {currentPlan === plan.id ? 'Current plan' : 'Get started'}
        </button>
      )}
    </div>
  );
}