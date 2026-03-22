import { auth } from '@clerk/nextjs/server';
import { getOrCreateDbUser } from '@/lib/db/clerk-sync';
import {
  assertWorkspaceBodySize,
  chatWorkspacePayloadSchema,
  parseWorkspacePayload,
} from '@/lib/chat-workspace-schema';
import { getChatWorkspaceByUserId, upsertChatWorkspace } from '@/lib/db/chat-workspace';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getOrCreateDbUser(userId);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const row = await getChatWorkspaceByUserId(user.id);
  const payload = row?.payload != null ? parseWorkspacePayload(row.payload) : null;

  return Response.json({
    payload: payload ?? null,
    updated_at: row?.updated_at ?? null,
  });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getOrCreateDbUser(userId);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = chatWorkspacePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid workspace payload' }, { status: 400 });
  }

  const json = JSON.stringify(parsed.data);
  if (!assertWorkspaceBodySize(json)) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    await upsertChatWorkspace(user.id, parsed.data);
  } catch (e) {
    console.error('upsertChatWorkspace', e);
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e && typeof e === 'object' && 'code' in e
        ? String((e as { code?: unknown }).code ?? '')
        : '';
    const missingTable =
      code === '42P01' ||
      /user_chat_workspace/i.test(msg) &&
        (/does not exist/i.test(msg) || /schema cache/i.test(msg) || /Could not find the table/i.test(msg));
    if (missingTable) {
      return Response.json(
        {
          error: 'Workspace sync unavailable',
          hint: 'Apply Supabase migration 005_user_chat_workspace.sql (table user_chat_workspace).',
        },
        { status: 503 }
      );
    }
    return Response.json({ error: 'Save failed' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
