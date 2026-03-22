'use client';

import { useTranslations } from 'next-intl';

const ROWS = [
  { feature: 'Multiple AIs in parallel', manyminds: true, others: false },
  { feature: 'Consensus score', manyminds: true, others: false },
  { feature: 'Synthesis answer', manyminds: true, others: false },
  { feature: 'Voice in / out', manyminds: true, others: 'Partial' },
  { feature: 'Personas (Optimist, Devil, Expert)', manyminds: true, others: false },
];

export function ComparisonTable() {
  const t = useTranslations('marketing');

  return (
    <section className="border-t border-neutral-100 bg-white px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-3xl font-bold text-neutral-900">
          {t('comparison')}
        </h2>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-6 py-4 text-sm font-semibold text-neutral-500">Feature</th>
                <th className="px-6 py-4 text-sm font-semibold text-violet-600">ManyMinds</th>
                <th className="px-6 py-4 text-sm font-semibold text-neutral-500">ChatGPT / Claude / Gemini</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={i} className="border-b border-neutral-100 last:border-0">
                  <td className="px-6 py-4 text-neutral-900">{row.feature}</td>
                  <td className="px-6 py-4">
                    {row.manyminds === true ? (
                      <span className="text-violet-600">✓</span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-neutral-400">
                    {row.others === true ? '✓' : row.others === false ? '—' : row.others}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}