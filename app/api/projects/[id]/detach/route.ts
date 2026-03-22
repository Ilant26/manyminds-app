import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getUserByClerkId } from '@/lib/db/users';
import { detachDebatesFromProject } from '@/lib/db/debates';

const bodySchema = z.object({
  debate_ids: z.array(z.string().min(1)).min(1).max(50),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await getUserByClerkId(userId);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  await detachDebatesFromProject({
    user_id: user.id,
    project_id: params.id,
    debate_ids: body.debate_ids,
  });

  return Response.json({ ok: true });
}

