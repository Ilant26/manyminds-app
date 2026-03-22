import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { getProjects } from '@/lib/db/projects';
import { getUserByClerkId } from '@/lib/db/users';
import type { ProjectsPageClientProps } from './projects-page-types';

function asSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function loadProjectsPageData(): Promise<ProjectsPageClientProps> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return {
      serverSignedIn: false,
      serverProjectsPrefetched: false,
      initialProjects: [],
    };
  }

  try {
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return {
        serverSignedIn: true,
        serverProjectsPrefetched: false,
        initialProjects: [],
      };
    }

    const rows = await getProjects(user.id);
    const initialProjects = rows.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at ?? new Date().toISOString(),
    }));

    return {
      serverSignedIn: true,
      serverProjectsPrefetched: true,
      initialProjects: asSerializable(initialProjects),
    };
  } catch (err) {
    console.error('[loadProjectsPageData]', err);
    return {
      serverSignedIn: true,
      serverProjectsPrefetched: false,
      initialProjects: [],
    };
  }
}
