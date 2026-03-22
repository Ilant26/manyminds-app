import { getSupabaseServer } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) return Response.json({ count: 0 });
    return Response.json({ count: count ?? 0 });
  } catch {
    return Response.json({ count: 0 });
  }
}
