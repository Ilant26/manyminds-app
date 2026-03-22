import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/db/client';
import { getUserByClerkId } from '@/lib/db/users';

const bodySchema = z
  .object({
    debate_id: z.string().min(1),
    /** Preferred: list label only; does not change `question` (thread context). */
    title: z.string().min(1).max(200).optional(),
    /** @deprecated use `title`; kept for older clients */
    question: z.string().min(1).max(2000).optional(),
  })
  .refine((b) => Boolean(b.title?.trim() || b.question?.trim()), {
    message: 'title or question required',
  });

export async function POST(req: Request) {
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

  const nextTitle = (body.title ?? body.question ?? '').trim().slice(0, 200);
  if (!nextTitle) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('debates')
    .update({ title: nextTitle })
    .eq('id', body.debate_id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 });

  return Response.json({ ok: true });
}
