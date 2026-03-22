import { auth } from '@clerk/nextjs/server';
import { getDebateByIdForUser } from '@/lib/db/debates';
import { getUserByClerkId } from '@/lib/db/users';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const user = await getUserByClerkId(userId);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const debate = await getDebateByIdForUser(id, user.id);
  if (!debate) {
    return Response.json({ error: 'Debate not found' }, { status: 404 });
  }

  return Response.json(debate);
}
