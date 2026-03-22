import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getUserByClerkId } from '@/lib/db/users';
import { deleteProject, renameProject } from '@/lib/db/projects';

const patchSchema = z.object({ name: z.string().min(1).max(60) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await getUserByClerkId(userId);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  await renameProject(user.id, params.id, body.name.trim());
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await getUserByClerkId(userId);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  // Detach all debates first (safety).
  // (Our deleteProject already does this; this is just to keep behavior robust.)
  await deleteProject(user.id, params.id);
  return Response.json({ ok: true });
}
