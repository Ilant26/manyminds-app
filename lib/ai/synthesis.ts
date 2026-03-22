import Anthropic from '@anthropic-ai/sdk';
import type { AIResponse } from '@/types';
import { SYNTHESIS_MODEL } from './models';

export const SYNTHESIS_SYSTEM_PROMPT = `
You are ManyMinds — synthesize the best answer from multiple AI responses.
Be direct, complete, and actionable. No preamble, no filler.
Write in clean prose. Use markdown only when it adds clarity.
`.trim();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Quick: max_tokens 600, max 1 automatic continuation only if stop_reason === 'max_tokens'.
 * Deep: max_tokens 4000, max 3 automatic continuations only if stop_reason === 'max_tokens'.
 * Stop as soon as stop_reason !== 'max_tokens'. Continuations append seamlessly (invisible to
 * the user); no extra credits are charged for these internal calls.
 */
const QUICK_SYNTHESIS_MAX_TOKENS = 600;
const QUICK_SYNTHESIS_MAX_CONTINUATIONS = 1;
const DEEP_SYNTHESIS_MAX_TOKENS = 4000;
const DEEP_SYNTHESIS_MAX_CONTINUATIONS = 3;

function extractText(
  msg: Awaited<ReturnType<typeof anthropic.messages.create>>
): string {
  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Anthropic only. Appends continuation chunks only while stop_reason === 'max_tokens',
 * up to maxContinuations extra calls; stops immediately if stop_reason !== 'max_tokens'.
 */
async function anthropicTextWithContinuations(params: {
  model: string;
  maxTokens: number;
  maxContinuations: number;
  userPrompt: string;
  system?: string;
}): Promise<string> {
  const { model, maxTokens, maxContinuations, userPrompt, system } = params;

  let msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: userPrompt }],
  });

  let full = extractText(msg);
  let stopReason = msg.stop_reason;
  let continuationsUsed = 0;

  while (stopReason === 'max_tokens' && continuationsUsed < maxContinuations) {
    continuationsUsed += 1;
    msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: full },
        {
          role: 'user',
          content:
            'Continue exactly from the end. Output only the continuation, with no repetition.',
        },
      ],
    });
    const piece = extractText(msg);
    full += piece ? (full ? '\n\n' : '') + piece : '';
    stopReason = msg.stop_reason;
  }

  return full.trim();
}

function buildContext(responses: AIResponse[]): string {
  return responses
    .filter((r) => !r.error && r.content.trim())
    .map((r) => `[${r.displayName}]\n${r.content}`)
    .join('\n\n---\n\n');
}

function parseSectionTitles(raw: string): string[] {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  const jsonStr = fence ? fence[1].trim() : t;
  try {
    const v = JSON.parse(jsonStr) as unknown;
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      return (v as string[]).slice(0, 5);
    }
  } catch {
    // fall through
  }
  return ['Overview', 'Key Points', 'Analysis', 'Conclusion'];
}

/** Quick synthesis — 600 tokens, max 1 automatic continuation */
export async function generateSynthesis(
  question: string,
  responses: AIResponse[],
  synthesisModel?: string
): Promise<string> {
  const valid = responses.filter((r) => !r.error && r.content.trim());
  if (valid.length === 0) {
    return 'No AI responses were available to synthesize. Please try again.';
  }

  const context = buildContext(responses);
  const userPrompt = `Question: ${question}
AI analyses:
${context}

Synthesize the responses. Speak as Manyminds. Do not name any AI.`;

  const languageDirective =
    '\nLanguage directive: Synthesize using the exact same language as the question text (do not translate).';

  return anthropicTextWithContinuations({
    model: synthesisModel ?? SYNTHESIS_MODEL,
    maxTokens: QUICK_SYNTHESIS_MAX_TOKENS,
    maxContinuations: QUICK_SYNTHESIS_MAX_CONTINUATIONS,
    userPrompt,
    system: SYNTHESIS_SYSTEM_PROMPT + languageDirective,
  });
}

/** Deep synthesis — multi-step; plan + sections use 4000 tokens, max 3 continuations each */
export async function* generateDeepSynthesisStream(
  responses: AIResponse[],
  question: string,
  synthesisModel: string = SYNTHESIS_MODEL
): AsyncGenerator<{ type: 'step' | 'content' | 'done'; text: string }> {
  const valid = responses.filter((r) => !r.error && r.content.trim());
  if (valid.length === 0) {
    yield {
      type: 'done',
      text: 'No AI responses were available to synthesize. Please try again.',
    };
    return;
  }

  const context = buildContext(valid);
  const languageDirective =
    '\n\nLanguage: Write using the exact same language as the original question (do not translate).';

  yield { type: 'step', text: 'Analyzing perspectives...' };

  const planUserPrompt = `You are analyzing responses from multiple AI models to create a comprehensive document.

Question: "${question}"

AI Responses:
${context}

Create a structured outline for a comprehensive answer. Return ONLY a JSON array of section titles.
Example: ["Introduction", "Market Analysis", "Key Findings", "Recommendations", "Conclusion"]
Return maximum 5 sections. Return ONLY the JSON array, nothing else.${languageDirective}`;

  const planText = await anthropicTextWithContinuations({
    model: synthesisModel,
    maxTokens: DEEP_SYNTHESIS_MAX_TOKENS,
    maxContinuations: DEEP_SYNTHESIS_MAX_CONTINUATIONS,
    userPrompt: planUserPrompt,
  });

  const sections = parseSectionTitles(planText || '[]');

  yield { type: 'step', text: 'Structuring document...' };

  let fullDocument = '';

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    yield { type: 'step', text: `Writing ${section}...` };

    const sectionPrompt = `You are writing section "${section}" of a comprehensive document.

Original question: "${question}"

AI Responses from multiple models:
${context}

${fullDocument ? `Document written so far:\n${fullDocument}\n\n` : ''}

Write ONLY the "${section}" section. Be thorough, specific, and actionable.
Use markdown formatting (## for title, ### for subsections, bullet points where relevant).
Do not repeat what was already written. Continue naturally from the previous sections.${languageDirective}`;

    const sectionText = await anthropicTextWithContinuations({
      model: synthesisModel,
      maxTokens: DEEP_SYNTHESIS_MAX_TOKENS,
      maxContinuations: DEEP_SYNTHESIS_MAX_CONTINUATIONS,
      userPrompt: sectionPrompt,
    });

    fullDocument += (fullDocument ? '\n\n' : '') + sectionText;
    yield { type: 'content', text: sectionText };
  }

  yield { type: 'done', text: fullDocument };
}
