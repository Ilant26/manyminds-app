'use client';

import { ManymindsAnswer } from '@/components/debate/ManymindsAnswer';
import { DemoFrame } from '@/components/debate/DemoFrame';
import type { Debate } from '@/types';

export function DebateView({
  debate,
  canExportPdf,
}: {
  debate: Debate;
  canExportPdf: boolean;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <DemoFrame>
        <h1 className="text-lg font-semibold text-neutral-900">{debate.question}</h1>
        <ManymindsAnswer
          synthesis={debate.synthesis}
          debateId={debate.id}
          canExportPdf={canExportPdf}
          consensusScore={
            typeof debate.consensus_score === 'number' ? debate.consensus_score : -1
          }
          responses={debate.ai_responses}
          disagreements={debate.disagreement_details ?? []}
        />
      </DemoFrame>
    </div>
  );
}
