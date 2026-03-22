import { auth } from '@clerk/nextjs/server';
import { getHistory } from '@/lib/db/debates';
import { getUserByClerkId } from '@/lib/db/users';

const DEBATES_CACHE_TTL_MS = 15_000;
const debatesCache = new Map<string, { ts: number; value: unknown }>();

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const search = searchParams.get('search') ?? undefined;
  const project_id = searchParams.get('project_id') ?? undefined;

  // Cache hit should not require fetching the DB user (speed up navigation).
  // `userId` here is the Clerk id.
  const cacheKey = `history:${userId}:${project_id ?? 'all'}:${limit}:${offset}:${search ?? ''}`;
  const cached = debatesCache.get(cacheKey);
  if (cached && Date.now() - cached.ts <= DEBATES_CACHE_TTL_MS) {
    return Response.json(cached.value as any);
  }

  const user = await getUserByClerkId(userId);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const { debates, total } = await getHistory(user.id, { limit, offset, search, project_id });
  const value = { debates, total };
  try {
    debatesCache.set(cacheKey, { ts: Date.now(), value });
  } catch {
    // ignore cache set failures
  }
  return Response.json(value);
}
