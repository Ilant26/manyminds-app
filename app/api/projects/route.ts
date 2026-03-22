import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createUser, getUserByClerkId } from '@/lib/db/users';
import { createProject, getProjects } from '@/lib/db/projects';

const PROJECTS_CACHE_TTL_MS = 15_000;
const projectsCache = new Map<string, { ts: number; value: unknown }>();

async function getOrCreateDbUser(clerkId: string) {
  let user = await getUserByClerkId(clerkId);
  if (user) return user;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkId).catch(() => null);
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `user-${clerkId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@manyminds.local`;

  await createUser({ clerk_id: clerkId, email });
  user = await getUserByClerkId(clerkId);
  return user;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Cache hit should not require fetching the DB user (speed up navigation).
  // `userId` here is the Clerk id.
  const cacheKey = `projects:${userId}`;
  const cached = projectsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts <= PROJECTS_CACHE_TTL_MS) {
    return Response.json(cached.value as any);
  }

  const user = await getOrCreateDbUser(userId);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const projects = await getProjects(user.id);
  const value = { projects };
  try {
    projectsCache.set(cacheKey, { ts: Date.now(), value });
  } catch {
    // ignore cache set failures
  }
  return Response.json(value);
}

const createSchema = z.object({ name: z.string().min(1).max(60) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getOrCreateDbUser(userId);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const project = await createProject(user.id, body.name.trim());
  return Response.json({ project });
}
