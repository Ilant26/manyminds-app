import { getSupabaseServer } from '@/lib/db/client';
import type { Plan } from '@/types';

export interface AIModelConfig {
  provider: string;
  model_id: string;
  display_name: string;
  min_plan: string;
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
  strengths: string[];
  max_tokens: number;
  supports_vision: boolean;
  supports_search: boolean;
  priority: number;
}

const PLAN_ORDER: string[] = ['free', 'plus', 'pro', 'team', 'business', 'enterprise'];

function planLevel(plan: string): number {
  return PLAN_ORDER.indexOf(plan);
}

export async function getModelsForPlan(plan: Plan): Promise<AIModelConfig[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('ai_models_config')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!data) return [];

  return (data as AIModelConfig[]).filter((m) => planLevel(m.min_plan) <= planLevel(plan));
}

export async function detectCategory(question: string): Promise<string> {
  const supabase = getSupabaseServer();
  const { data: rules } = await supabase.from('routing_rules').select('*');

  if (!rules) return 'general';

  const q = question.toLowerCase();
  for (const rule of rules as any[]) {
    const keywords: string[] = Array.isArray(rule.keywords) ? rule.keywords : [];
    const category: string | undefined = rule.category;
    if (!category) continue;

    for (const k of keywords) {
      if (typeof k === 'string' && q.includes(k.toLowerCase())) return category;
    }
  }
  return 'general';
}

export async function getOptimalModels(
  question: string,
  plan: Plan,
  mode: 'quick' | 'deep' = 'quick'
): Promise<AIModelConfig[]> {
  const [allModels, category, rules] = await Promise.all([
    getModelsForPlan(plan),
    detectCategory(question),
    getRoutingRules(),
  ]);

  const rule = rules.find((r) => r.category === category) as any | undefined;

  if (!rule || category === 'general') return allModels;

  const preferredProviders: string[] = Array.isArray(rule.preferred_models)
    ? rule.preferred_models
    : [];

  return allModels.sort((a, b) => {
    const aPreferred = preferredProviders.includes(a.provider) ? 1 : 0;
    const bPreferred = preferredProviders.includes(b.provider) ? 1 : 0;
    return bPreferred - aPreferred;
  });
}

async function getRoutingRules(): Promise<any[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.from('routing_rules').select('*');
  return (data ?? []) as any[];
}

export async function getMaxTokens(
  model: AIModelConfig,
  mode: 'quick' | 'deep',
  question: string
): Promise<number> {
  if (mode === 'quick') return 300;

  const LONG_FORM_KEYWORDS = [
    'complet',
    'complete',
    'détaillé',
    'detailed',
    'exhaustif',
    'business plan',
    'étude de marché',
    'market analysis',
    'rapport',
    'long',
    'approfondi',
    'comprehensive',
    'full',
    'entier',
    'entire',
    'thèse',
    'thesis',
    'dissertation',
    'stratégie',
    'strategy',
  ];

  const isLongForm = LONG_FORM_KEYWORDS.some((k) => question.toLowerCase().includes(k));

  return isLongForm ? model.max_tokens : Math.min(2000, model.max_tokens);
}

