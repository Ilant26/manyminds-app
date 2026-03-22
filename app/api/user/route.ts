import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getOrCreateDbUser } from '@/lib/db/clerk-sync';
import { MONTHLY_QUOTAS } from '@/lib/ai/models';

const USER_CACHE_TTL_MS = 15_000;
const userCache = new Map<string, { ts: number; value: unknown }>();

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.ts <= USER_CACHE_TTL_MS) {
    return Response.json(cached.value as any);
  }

  const user = await getOrCreateDbUser(userId);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const value = {
    id: user.id,
    email: user.email,
    plan: user.plan,
    requests_used: user.requests_used,
    requests_limit: MONTHLY_QUOTAS[(user.plan ?? 'free') as keyof typeof MONTHLY_QUOTAS] ?? user.requests_limit,
  };

  try {
    userCache.set(userId, { ts: Date.now(), value });
  } catch {
    // ignore cache set failures
  }

  return Response.json(value);
}

const patchSchema = z.object({
  // preferences placeholder for future
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getOrCreateDbUser(userId);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    patchSchema.parse(body);
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  return Response.json({ ok: true });
}
