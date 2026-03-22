'use client';

import { useTranslations } from 'next-intl';
import type { Plan } from '@/types';

const PLAN_COLORS: Record<Plan, string> = {
  free: 'bg-zinc-600 text-zinc-200',
  plus: 'bg-emerald-600/80 text-white',
  pro: 'bg-violet-600/80 text-white',
  team: 'bg-amber-600/80 text-white',
  business: 'bg-sky-600/80 text-white',
  enterprise: 'bg-rose-600/80 text-white',
};

export function PlanBadge({ plan }: { plan: Plan }) {
  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}
    >
      {label}
    </span>
  );
}
