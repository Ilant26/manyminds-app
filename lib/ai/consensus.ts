import Anthropic from '@anthropic-ai/sdk';
import type { AIResponse, DisagreementDetail } from '@/types';

/**
 * Même famille que les appels débat (Haiku), surchargeable.
 * L’ancien ID `claude-3-5-haiku-20241022` est souvent retiré côté Anthropic → 404.
 */
function judgeModelId(): string {
  return (
    process.env.ANTHROPIC_CONSENSUS_JUDGE_MODEL?.trim() ||
    process.env.ANTHROPIC_HAIKU_MODEL?.trim() ||
    'claude-haiku-4-5'
  );
}

export interface ConsensusResult {
  score: number;
  disagreements: DisagreementDetail[];
}

function buildContext(responses: AIResponse[]): string {
  return responses
    .filter((r) => !r.error && r.content.trim())
    .map((r) => `[${r.displayName}]: ${r.content}`)
    .join('\n\n');
}

/** Si le juge échoue (API, JSON invalide, clé manquante), on n’invente pas de pourcentage. */
function consensusUnavailable(): ConsensusResult {
  return { score: -1, disagreements: [] };
}

/**
 * Claude renvoie parfois du JSON entouré de ```json … ``` ou du texte avant/après.
 */
function parseJudgeJson(raw: string): {
  score: number;
  disagreements: DisagreementDetail[];
} | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```/m);
  if (fence) text = fence[1].trim();

  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed: unknown = tryParse(text);
  if (!parsed) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = tryParse(text.slice(start, end + 1));
    }
  }

  if (!parsed || typeof parsed !== 'object' || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const score = Number(o.score);
  if (!Number.isFinite(score)) return null;
  const rawList = Array.isArray(o.disagreements) ? o.disagreements : [];

  const cleaned: DisagreementDetail[] = rawList
    .filter((d): d is Record<string, unknown> => d !== null && typeof d === 'object')
    .map((d) => ({
      topic: String(d.topic ?? ''),
      models_for: Array.isArray(d.models_for)
        ? d.models_for.map((x) => String(x))
        : [],
      models_against: Array.isArray(d.models_against)
        ? d.models_against.map((x) => String(x))
        : [],
      description: String(d.description ?? ''),
    }));

  return { score, disagreements: cleaned };
}

export async function calculateConsensus(
  responses: AIResponse[]
): Promise<ConsensusResult> {
  const valid = responses.filter((r) => !r.error && r.content.trim());
  if (valid.length === 0) {
    return { score: -1, disagreements: [] };
  }

  // Un seul modèle : accord trivial, pas d’appel API.
  if (valid.length === 1) {
    return { score: 100, disagreements: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[consensus] ANTHROPIC_API_KEY manquante — score d’accord désactivé.');
    }
    return consensusUnavailable();
  }

  const context = buildContext(responses);
  const modelNames = valid.map((r) => r.displayName).join(', ');
  const model = judgeModelId();

  const prompt = `You are a consensus judge. Given the following AI responses to the same question, output a JSON object with exactly two keys:
- "score": number 0-100 indicating agreement level (100 = full agreement, 0 = total disagreement).
- "disagreements": array of objects, each with: "topic" (string), "models_for" (array of model display names), "models_against" (array), "description" (string). If score >= 60, disagreements can be empty [].

Responses:
${context}

Models that answered: ${modelNames}

Output only valid JSON, no markdown or extra text.`;

  try {
    const anthropic = new Anthropic({
      apiKey,
      maxRetries: 2,
      timeout: 55_000,
    });
    const r = await anthropic.messages.create({
      model,
      max_tokens: 1200,
      system: 'You output only valid JSON. No markdown code blocks, no explanation before or after.',
      messages: [{ role: 'user', content: prompt }],
    });
    const block = r.content[0];
    const text = block && block.type === 'text' ? block.text : '';
    const parsed = parseJudgeJson(text || '{}');
    if (!parsed) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[consensus] JSON juge invalide (extrait):', (text || '').slice(0, 200));
      }
      return consensusUnavailable();
    }

    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    return { score, disagreements: parsed.disagreements };
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[consensus] Appel Anthropic échoué:', msg, { model });
    }
    return consensusUnavailable();
  }
}
