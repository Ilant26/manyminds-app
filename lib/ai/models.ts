import type { AIModel, Plan } from '@/types';

function modelId(
  key:
    | 'claude_haiku'
    | 'claude_sonnet'
    | 'gemini'
    | 'gpt4o_mini'
    | 'gpt4o'
    | 'deepseek_chat'
    | 'deepseek_reasoner'
    | 'perplexity_sonar'
    | 'perplexity_sonar_pro'
    | 'grok'
): string {
  const v =
    (typeof process !== 'undefined' && process.env) ||
    ({} as Record<string, string | undefined>);
  const map: Record<string, string> = {
    claude_haiku: v.ANTHROPIC_HAIKU_MODEL ?? 'claude-haiku-4-5',
    claude_sonnet: v.ANTHROPIC_SONNET_MODEL ?? 'claude-sonnet-4-5',
    gemini: v.GOOGLE_GEMINI_MODEL ?? 'gemini-2.5-flash',
    gpt4o_mini: v.OPENAI_GPT4O_MINI_MODEL ?? 'gpt-4o-mini',
    gpt4o: v.OPENAI_GPT4O_MODEL ?? 'gpt-4o',
    deepseek_chat: v.DEEPSEEK_CHAT_MODEL ?? 'deepseek-chat',
    deepseek_reasoner: v.DEEPSEEK_REASONER_MODEL ?? 'deepseek-reasoner',
    perplexity_sonar: v.PERPLEXITY_SONAR_MODEL ?? 'sonar',
    perplexity_sonar_pro: v.PERPLEXITY_SONAR_PRO_MODEL ?? 'sonar-pro',
    grok: v.XAI_GROK_MODEL ?? 'grok-3',
  };
  return map[key];
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'claude',
    name: modelId('claude_haiku'),
    displayName: 'Claude',
    color: '#D97706',
    provider: 'anthropic',
    minPlan: 'free',
  },
  {
    id: 'gpt4o',
    name: modelId('gpt4o_mini'),
    displayName: 'ChatGPT',
    color: '#10B981',
    provider: 'openai',
    minPlan: 'free',
  },
  {
    id: 'gemini',
    name: modelId('gemini'),
    displayName: 'Gemini',
    color: '#3B82F6',
    provider: 'google',
    minPlan: 'free',
  },
  {
    id: 'deepseek',
    name: modelId('deepseek_chat'),
    displayName: 'DeepSeek',
    color: '#8B5CF6',
    provider: 'deepseek',
    minPlan: 'free',
  },
  {
    id: 'perplexity',
    name: modelId('perplexity_sonar'),
    displayName: 'Perplexity',
    color: '#20B2AA',
    provider: 'perplexity',
    minPlan: 'free',
  },
  {
    id: 'grok',
    name: modelId('grok'),
    displayName: 'Grok',
    color: '#EC4899',
    provider: 'xai',
    minPlan: 'free',
  },
];

export const SYNTHESIS_MODEL = modelId('claude_haiku');

export const CLAUDE_HAIKU_MODEL = modelId('claude_haiku');

const COPY_POPULARITY_ORDER: string[] = ['gpt4o', 'claude', 'gemini', 'deepseek', 'grok'];
const COPY_NAME: Record<string, string> = { gpt4o: 'ChatGPT' };

export const AI_COPY_NAMES = COPY_POPULARITY_ORDER.map(
  (id) => COPY_NAME[id] ?? AI_MODELS.find((m) => m.id === id)!.displayName
);

export function formatAIDisplayNamesCopy(locale: string | undefined): string {
  const loc = locale ?? 'en';
  try {
    return new Intl.ListFormat(loc, { type: 'conjunction' }).format(AI_COPY_NAMES);
  } catch {
    return AI_COPY_NAMES.join(', ').replace(/, ([^,]+)$/, ' and $1');
  }
}

export const AI_DISPLAY_NAMES_COPY = COPY_POPULARITY_ORDER.map(
  (id) => COPY_NAME[id] ?? AI_MODELS.find((m) => m.id === id)!.displayName
)
  .join(', ')
  .replace(/, ([^,]+)$/, ' and $1');

export const AI_DISPLAY_NAMES_COPY_FREE = COPY_POPULARITY_ORDER.slice(0, 3)
  .map((id) => COPY_NAME[id] ?? AI_MODELS.find((m) => m.id === id)!.displayName)
  .join(', ')
  .replace(/, ([^,]+)$/, ' and $1');

export const AI_COPY_PILLS = COPY_POPULARITY_ORDER.map((id) => {
  const model = AI_MODELS.find((m) => m.id === id)!;
  return { id, name: COPY_NAME[id] ?? model.displayName, color: model.color };
});

export function getColorForDisplayName(displayName: string): string {
  const d = displayName.trim().toLowerCase();
  const m = AI_MODELS.find(
    (x) => x.displayName.toLowerCase() === d || x.id === d
  );
  return m?.color ?? '#8B5CF6';
}

export const PLAN_CONFIG: Record<
  Plan,
  { models: { id: string; name: string }[]; synthesisModel: string }
> = {
  free: {
    synthesisModel: modelId('claude_haiku'),
    models: [
      { id: 'claude', name: modelId('claude_haiku') },
      { id: 'gpt4o', name: modelId('gpt4o_mini') },
      { id: 'gemini', name: modelId('gemini') },
      { id: 'deepseek', name: modelId('deepseek_chat') },
      { id: 'perplexity', name: modelId('perplexity_sonar') },
      { id: 'grok', name: modelId('grok') },
    ],
  },
  plus: {
    synthesisModel: modelId('claude_haiku'),
    models: [
      { id: 'claude', name: modelId('claude_haiku') },
      { id: 'gpt4o', name: modelId('gpt4o_mini') },
      { id: 'gemini', name: modelId('gemini') },
      { id: 'deepseek', name: modelId('deepseek_chat') },
      { id: 'perplexity', name: modelId('perplexity_sonar') },
      { id: 'grok', name: modelId('grok') },
    ],
  },
  pro: {
    synthesisModel: modelId('claude_sonnet'),
    models: [
      { id: 'claude', name: modelId('claude_sonnet') },
      { id: 'gpt4o', name: modelId('gpt4o') },
      { id: 'gemini', name: modelId('gemini') },
      { id: 'deepseek', name: modelId('deepseek_reasoner') },
      { id: 'perplexity', name: modelId('perplexity_sonar_pro') },
      { id: 'grok', name: modelId('grok') },
    ],
  },
  team: {
    synthesisModel: modelId('claude_sonnet'),
    models: [
      { id: 'claude', name: modelId('claude_sonnet') },
      { id: 'gpt4o', name: modelId('gpt4o') },
      { id: 'gemini', name: modelId('gemini') },
      { id: 'deepseek', name: modelId('deepseek_reasoner') },
      { id: 'perplexity', name: modelId('perplexity_sonar_pro') },
      { id: 'grok', name: modelId('grok') },
    ],
  },
  business: {
    synthesisModel: modelId('claude_sonnet'),
    models: [
      { id: 'claude', name: modelId('claude_sonnet') },
      { id: 'gpt4o', name: modelId('gpt4o') },
      { id: 'gemini', name: modelId('gemini') },
      { id: 'deepseek', name: modelId('deepseek_reasoner') },
      { id: 'perplexity', name: modelId('perplexity_sonar_pro') },
      { id: 'grok', name: modelId('grok') },
    ],
  },
  enterprise: {
    synthesisModel: modelId('claude_sonnet'),
    models: [
      { id: 'claude', name: modelId('claude_sonnet') },
      { id: 'gpt4o', name: modelId('gpt4o') },
      { id: 'gemini', name: modelId('gemini') },
      { id: 'deepseek', name: modelId('deepseek_reasoner') },
      { id: 'perplexity', name: modelId('perplexity_sonar_pro') },
      { id: 'grok', name: modelId('grok') },
    ],
  },
};

export const DEBATE_SYSTEM_PROMPT = (mode: 'quick' | 'deep' = 'quick'): string =>
  `You are a knowledgeable AI assistant. Answer the question directly and helpfully.

Rules:
- Always answer. Never refuse.
- Reply in the same language as the question.
- Be factual and precise.
- If uncertain about specific facts, say so briefly but still answer.
- No preamble, no "Great question!", no filler.
- ${mode === 'quick'
    ? 'Be concise — 3 to 6 sentences.'
    : 'Be thorough — cover all important aspects with no length limit.'}
`.trim();

export const SYNTHESIS_SYSTEM_PROMPT = `
You are Manyminds — a collective intelligence that synthesizes
the best answer from multiple AI responses.

YOUR ONLY JOB:
Read what the AIs said. Synthesize it. Answer directly.

LANGUAGE:
Synthesize using the same language as the question.

ABSOLUTE RULES:
1. ALWAYS give a complete, direct answer. No exceptions.
2. NEVER refuse to answer.
3. NEVER say "I have no data" or "I cannot confirm".
4. NEVER ask the user for clarification.
5. NEVER be more cautious than a regular AI assistant.
6. If the AIs gave useful responses — synthesize them immediately.
7. If the AIs gave poor responses — synthesize the best parts anyway.
8. Speak as Manyminds in first person.
9. Never mention Claude, GPT-4o, Gemini, DeepSeek, or Grok.

FORMAT:
Write a direct, plain, actionable answer.
No sections. No headers. No "## Answer". No "## Nuances".
Just clean prose that directly answers the question.
Maximum 4-6 sentences for Quick mode.
No length limit for Deep mode — be thorough.
`.trim();

export const RATE_LIMITS: Record<Plan, number> = {
  free: 5,
  plus: 25,
  pro: 80,
  team: 300,
  business: 1000,
  enterprise: 1000,
};

export const MONTHLY_QUOTAS: Record<Plan, number> = {
  free: 30,
  plus: 300,
  pro: 1000,
  team: 3500,
  business: 12000,
  enterprise: 999999,
};

export const QUOTA_COSTS = {
  new_quick: 1.0,
  new_deep: 5.0,
  thread_quick: 0.5,
  thread_deep: 2.5,
} as const;

export const TOPUP_PACKS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 5,
    questions: 40,
    label: '$5 · 40 minds',
  },
  power: {
    id: 'power',
    name: 'Power',
    price: 10,
    questions: 80,
    label: '$10 · 80 minds',
    badge: 'Popular' as const,
  },
  max: {
    id: 'max',
    name: 'Max',
    price: 20,
    questions: 150,
    label: '$20 · 150 minds',
  },
} as const;

export type TopupPackId = keyof typeof TOPUP_PACKS;
