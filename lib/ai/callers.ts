import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIModel, AIResponse } from '@/types';
import { preprocessReadableModelText } from '@/lib/format-model-response';
import { DEBATE_SYSTEM_PROMPT } from './models';
import { trackModelHealth } from './health-tracker';

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const XAI_BASE = 'https://api.x.ai/v1';

/**
 * Quick: max_tokens 600, max 1 automatic Anthropic continuation if stop_reason === 'max_tokens'.
 * Deep: max_tokens 4000, max 3 automatic Anthropic continuations if stop_reason === 'max_tokens'.
 * Stop continuing if stop_reason !== 'max_tokens'. Continuations append seamlessly (invisible to
 * the user); 0 extra credits charged for those internal calls.
 */
const QUICK_MAX_TOKENS = 600;
const DEEP_MAX_TOKENS = 4000;
const QUICK_ANTHROPIC_MAX_CONTINUATIONS = 1;
const DEEP_ANTHROPIC_MAX_CONTINUATIONS = 3;

function getMaxTokens(mode: 'quick' | 'deep', _question: string): number {
  if (mode === 'quick') return QUICK_MAX_TOKENS;
  return DEEP_MAX_TOKENS;
}

function extractAnthropicText(
  msg: Awaited<ReturnType<Anthropic['messages']['create']>>
): string {
  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function callAIModel(
  model: AIModel,
  question: string,
  _persona?: string,
  mode: 'quick' | 'deep' = 'quick',
  maxTokensOverride?: number
): Promise<AIResponse> {
  const start = Date.now();
  // On ne force pas une langue précise (fr/en). On demande de répondre
  // dans la même langue que la "question" (qui contient la langue source).
  const languageDirective =
    '\nLanguage directive: Reply in the exact same language as the question text (do not translate).';
  const systemPrompt = DEBATE_SYSTEM_PROMPT(mode) + languageDirective;
  const maxTokens = maxTokensOverride ?? getMaxTokens(mode, question);

  try {
    let content = '';
    switch (model.provider) {
      case 'anthropic': {
        const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
        const maxContinuations =
          mode === 'quick'
            ? QUICK_ANTHROPIC_MAX_CONTINUATIONS
            : DEEP_ANTHROPIC_MAX_CONTINUATIONS;

        let msg = await claude.messages.create({
          model: model.name,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: question }],
        });
        content = extractAnthropicText(msg);
        let stopReason = msg.stop_reason;
        let continuationsUsed = 0;

        while (stopReason === 'max_tokens' && continuationsUsed < maxContinuations) {
          continuationsUsed += 1;
          msg = await claude.messages.create({
            model: model.name,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [
              { role: 'user', content: question },
              { role: 'assistant', content: content },
              {
                role: 'user',
                content:
                  'Continue exactly from the end. Output only the continuation, with no repetition.',
              },
            ],
          });
          const piece = extractAnthropicText(msg);
          content += piece ? (content ? '\n\n' : '') + piece : '';
          stopReason = msg.stop_reason;
        }
        break;
      }
      case 'openai': {
        const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const r = await oai.chat.completions.create({
          model: model.name,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
        });
        content = r.choices[0]?.message?.content ?? '';
        break;
      }
      case 'google': {
        const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
        const gmodel = genai.getGenerativeModel({
          model: model.name,
          systemInstruction: systemPrompt,
        });
        const r = await gmodel.generateContent(question);
        content = r.response.text();
        break;
      }
      case 'deepseek':
      case 'xai': {
        let apiModelName = model.name;
        // Defensive normalization for deprecated IDs.
        if (model.provider === 'xai' && apiModelName.includes('grok-2-1212')) {
          apiModelName = 'grok-3';
        }

        const baseURLs: Record<string, string> = {
          deepseek: DEEPSEEK_BASE,
          xai: XAI_BASE,
        };
        const apiKeys: Record<string, string> = {
          deepseek: process.env.DEEPSEEK_API_KEY!,
          xai: process.env.GROK_API_KEY!,
        };
        const client = new OpenAI({
          apiKey: apiKeys[model.provider],
          baseURL: baseURLs[model.provider],
        });
        const r = await client.chat.completions.create({
          model: apiModelName,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
        });
        content = r.choices[0]?.message?.content ?? '';
        break;
      }
      case 'perplexity': {
        let apiModelName = model.name;
        // Defensive normalization for deprecated IDs.
        if (apiModelName.includes('llama-3.1-sonar-small')) apiModelName = 'sonar';
        if (apiModelName.includes('llama-3.1-sonar-large')) apiModelName = 'sonar-pro';

        const client = new OpenAI({
          apiKey: process.env.PERPLEXITY_API_KEY!,
          baseURL: 'https://api.perplexity.ai',
        });
        const r = await client.chat.completions.create({
          model: apiModelName,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
        });
        content = r.choices[0]?.message?.content ?? '';
        break;
      }
    }

    // Citations [1][2] (Perplexity, etc.) + coupures de ligne parasites.
    content = preprocessReadableModelText(content);

    // Health tracking (best-effort).
    try {
      await trackModelHealth(model.name, true, Date.now() - start);
    } catch {
      // ignore tracking failures
    }

    return {
      model: model.id,
      displayName: model.displayName,
      content,
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    try {
      await trackModelHealth(model.name, false, Date.now() - start, errorMessage);
    } catch {
      // ignore tracking failures
    }
    return {
      model: model.id,
      displayName: model.displayName,
      content: '',
      latency_ms: Date.now() - start,
      error: errorMessage,
    };
  }
}
