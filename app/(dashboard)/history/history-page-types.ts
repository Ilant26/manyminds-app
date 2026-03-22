import type { Debate } from '@/types';

export type HistoryProjectStub = { id: string; name: string; created_at: string };

export type HistoryPageClientProps = {
  serverSignedIn: boolean;
  serverHistoryPrefetched: boolean;
  initialDebates: Debate[];
  initialTotal: number;
  initialProjects?: HistoryProjectStub[];
};
