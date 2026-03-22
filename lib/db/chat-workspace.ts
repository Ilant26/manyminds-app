import { getSupabaseServer } from '@/lib/db/client';

export async function getChatWorkspaceByUserId(
  userId: string
): Promise<{ payload: unknown; updated_at: string } | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('user_chat_workspace')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    payload: data.payload ?? {},
    updated_at: data.updated_at as string,
  };
}

export async function upsertChatWorkspace(
  userId: string,
  payload: unknown
): Promise<void> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const { error } = await supabase.from('user_chat_workspace').upsert(
    {
      user_id: userId,
      payload,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
