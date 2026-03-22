import { getSupabaseServer } from '@/lib/db/client';

export async function trackModelHealth(
  modelId: string,
  success: boolean,
  latencyMs: number,
  errorMsg?: string
): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from('api_health').insert({
    model_id: modelId,
    status: success ? 'ok' : 'error',
    error_msg: errorMsg ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function isModelHealthy(modelId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('api_health')
    .select('status')
    .eq('model_id', modelId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return true;

  const errorRate = data.filter((d: any) => d.status === 'error').length / data.length;
  return errorRate < 0.6;
}

