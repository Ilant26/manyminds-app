'use client';

import { useState } from 'react';
import { PricingCard } from '@/components/marketing/PricingCard';
import { PLANS } from '@/lib/stripe/plans';

const COMPARISON_ROWS = [
  { feature: 'AI providers', values: ['6', '6', '6', '6', '6'] },
  { feature: 'Premium models', values: ['x', 'x', 'v', 'v', 'v'] },
  { feature: 'Personal memory', values: ['5', 'inf', 'inf', 'inf', 'inf'] },
  { feature: 'Projects and PDF export', values: ['x', 'v', 'v', 'v', 'v'] },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <>
      {/* Section 1: Pricing — fond noir */}
      <section className="border-t border-white/10 bg-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white sm:text-5xl">
              Smarter than any. Cheaper than all.
            </h2>
            <p className="mt-4 text-sm text-white/70 sm:text-base">
              One subscription. Every leading AI — working together.
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 rounded-xl bg-neutral-800/80 p-1">
              <button
                onClick={() => setAnnual(false)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  !annual ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  annual ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Annual <span className="ml-1 text-xs text-violet-400">-20%</span>
              </button>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PLANS.map((p) => (
              <PricingCard key={p.id} plan={p} annual={annual} isPopular={p.id === 'pro'} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Compare in detail — comme avant (fond clair, tableau encadré) */}
      <section className="border-t border-neutral-200 bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h3 className="text-center text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Powered by all the best. Built for every stage.
          </h3>
          <p className="mt-4 text-center text-sm text-neutral-500 sm:text-base">
            Every plan includes all AI providers. Upgrade for their most powerful versions.
          </p>
          <div className="mt-12 overflow-x-auto rounded-2xl border-2 border-neutral-300 bg-white shadow-xl shadow-violet-500/50">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b-2 border-neutral-300 bg-neutral-100">
                  <th className="px-4 py-4 text-center text-base font-semibold text-neutral-600">Feature</th>
                  <th className="px-4 py-4 text-center text-base font-semibold text-neutral-900">Free</th>
                  <th className="px-4 py-4 text-center text-base font-semibold text-neutral-900">Plus</th>
                  <th className="px-4 py-4 text-center text-base font-semibold text-neutral-900">Pro</th>
                  <th className="px-4 py-4 text-center text-base font-semibold text-neutral-900">Team</th>
                  <th className="px-4 py-4 text-center text-base font-semibold text-neutral-900">Business</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-200 last:border-0">
                    <td className="px-4 py-4 text-center text-base text-neutral-700">{row.feature}</td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        className={`px-4 py-4 text-center text-base ${
                          v === 'v'
                            ? 'font-semibold text-violet-600'
                            : v === 'x'
                            ? 'text-neutral-400'
                            : v === 'inf'
                            ? 'font-normal text-neutral-700'
                            : 'text-neutral-700'
                        }`}
                      >
                        {v === 'v' ? '✓' : v === 'x' ? '✗' : v === 'inf' ? '∞' : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
