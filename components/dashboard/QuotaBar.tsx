'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface QuotaBarProps {
  used: number;
  limit: number;
  pct: number;
  isNear80: boolean;
  onUpgradeClick?: () => void;
}

export function QuotaBar({
  used,
  limit,
  pct,
  isNear80,
  onUpgradeClick,
}: QuotaBarProps) {
  const t = useTranslations('dashboard');
  const barColor =
    pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{t('debatesUsed', { used, limit })}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <motion.div
          className={`h-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {isNear80 && (
        <Link
          href="/pricing"
          onClick={onUpgradeClick}
          className="block rounded-lg bg-amber-500/15 px-3 py-2 text-center text-sm font-medium text-amber-700"
        >
          Upgrade for more conversations →
        </Link>
      )}
    </div>
  );
}
