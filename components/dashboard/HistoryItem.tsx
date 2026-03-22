'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { HydrationSafeDate } from '@/components/shared/HydrationSafeDate';
import { conversationListLabel, conversationTurnCount } from '@/lib/conversation-title';
import type { Debate } from '@/types';

interface HistoryItemProps {
  debate: Debate;
}

export function HistoryItem({ debate }: HistoryItemProps) {
  const date = new Date(debate.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const chatHref = (() => {
    const p = new URLSearchParams();
    p.set('debateId', debate.id);
    if (debate.project_id) p.set('projectId', debate.project_id);
    return `/chat?${p.toString()}`;
  })();

  return (
    <Link
      href={chatHref}
      className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300"
    >
      <p className="line-clamp-2 font-medium text-neutral-900">{conversationListLabel(debate)}</p>
      {conversationTurnCount(debate) > 1 ? (
        <p className="mt-0.5 text-xs text-neutral-400">
          {conversationTurnCount(debate)} échanges · une conversation
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
        <Calendar className="h-3.5 w-3.5" />
        <HydrationSafeDate iso={debate.created_at} />
        {debate.consensus_score != null && debate.consensus_score >= 0 && (
          <span className="ml-2">Consensus: {debate.consensus_score}%</span>
        )}
      </div>
    </Link>
  );
}
