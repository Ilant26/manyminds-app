import { auth } from '@clerk/nextjs/server';
import { getSupabaseServer } from '@/lib/db/client';

/**
 * Compteur d’essais **sans compte** (par IP). Réservé aux visiteurs non connectés.
 * Les abonnements et quotas réels sont appliqués ailleurs : `auth()` + DB sur `/api/debate`, `/api/user`, etc.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (userId) {
    return Response.json(
      { error: 'SIGNED_IN', message: 'Use GET /api/user for quota when signed in.' },
      { status: 403 }
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const supabase = getSupabaseServer();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = 2;

  const { count } = await supabase
    .from('anonymous_usage')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since);

  return Response.json({ used: count ?? 0, limit });
}

