import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { getHistory } from '@/lib/db/debates';
import { getProjects } from '@/lib/db/projects';
import { getUserByClerkId } from '@/lib/db/users';
import type { HistoryPageClientProps } from './history-page-types';

/** Props Client Components : JSON strict (évite 500 RSC si valeurs non sérialisables). */
function asSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function loadHistoryPageData(): Promise<HistoryPageClientProps> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return {
      serverSignedIn: false,
      serverHistoryPrefetched: false,
      initialDebates: [],
      initialTotal: 0,
    };
  }

  try {
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return {
        serverSignedIn: true,
        serverHistoryPrefetched: false,
        initialDebates: [],
        initialTotal: 0,
      };
    }

    const [{ debates, total }, projectRows] = await Promise.all([
      getHistory(user.id, { limit: 30 }),
      getProjects(user.id),
    ]);

    const initialProjects = projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at ?? new Date().toISOString(),
    }));

    return {
      serverSignedIn: true,
      serverHistoryPrefetched: true,
      initialDebates: asSerializable(debates),
      initialTotal: total,
      initialProjects: asSerializable(initialProjects),
    };
  } catch (err) {
    console.error('[loadHistoryPageData]', err);
    return {
      serverSignedIn: true,
      serverHistoryPrefetched: false,
      initialDebates: [],
      initialTotal: 0,
    };
  }
}
