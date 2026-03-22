'use client';

import { useState } from 'react';
import { PLANS } from '@/lib/stripe/plans';
import { PricingCard } from '@/components/marketing/PricingCard';
import { Footer } from '@/components/marketing/Footer';

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-center text-5xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
          Smarter than any. Cheaper than all.
        </h1>
        <p className="mt-4 text-center text-sm text-neutral-500 sm:text-base">
          One subscription. Every leading AI — working together.
        </p>
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-2 rounded-xl bg-neutral-100 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${!annual ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${annual ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              Annual <span className="ml-1 text-xs text-violet-500">-20%</span>
            </button>
          </div>
        </div>
        <div className="mt-12 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} annual={annual} isPopular={p.id === 'pro'} />
          ))}
        </div>
        <div className="mt-24">
          <h2 className="text-center text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Powered by all the best. Built for every stage.
          </h2>
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
                {[
                  { feature: 'Credits per month', values: ['30', '300', '1,000', '3,000', '10,000'] },
                  { feature: 'AI providers', values: ['5', '5', '5', '5', '5'] },
                  { feature: 'Premium models', values: ['x', 'x', 'v', 'v', 'v'] },
                  { feature: 'Personal memory', values: ['5', 'inf', 'inf', 'inf', 'inf'] },
                  { feature: 'Projects and PDF export', values: ['x', 'v', 'v', 'v', 'v'] },
                  { feature: 'Price', values: ['$0', '$20', '$59', '$199', '$699'] },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-neutral-200 last:border-0">
                    <td className="px-4 py-4 text-center text-base text-neutral-700">{row.feature}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className={`px-4 py-4 text-center text-base ${v === 'v' ? 'text-violet-600' : v === 'x' ? 'text-neutral-400' : j === 2 ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                        {v === 'v' ? '✓' : v === 'x' ? '✗' : v === 'inf' ? '∞' : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-24 rounded-2xl bg-neutral-900 px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white">Why trust one AI when you can ask many?</h2>
          <a href="/chat" className="mt-8 inline-block rounded-xl border border-white/20 px-8 py-4 font-bold text-white hover:bg-white/10">
            Get started free
          </a>
          <p className="mt-4 text-sm text-neutral-400">No credit card. Free plan forever.</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
