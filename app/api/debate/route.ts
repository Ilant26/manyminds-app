export const maxDuration = 60;

import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { AI_MODELS, PLAN_CONFIG, QUOTA_COSTS, MONTHLY_QUOTAS } from '@/lib/ai/models';
import { callAIModel } from '@/lib/ai/callers';
import { calculateConsensus } from '@/lib/ai/consensus';
import { generateDeepSynthesisStream, generateSynthesis } from '@/lib/ai/synthesis';
import { getSupabaseServer } from '@/lib/db/client';
import { getUserByClerkId, incrementUserRequests } from '@/lib/db/users';
import { DEBATE_QUESTION_MERGE_SEP } from '@/lib/debate-question-merge-split';
import { buildThreadHistoryPrompt } from '@/lib/debate-thread-prompt';
import { getDebateMergeState, saveDebate, updateDebate } from '@/lib/db/debates';
import { triggerEmailSequence } from '@/lib/email/resend';
import type { AIModel, Plan } from '@/types';
import type { DebateStreamEvent } from '@/types';
import { getMaxTokens, getOptimalModels } from '@/lib/ai/router';
import type { AIModelConfig } from '@/lib/ai/router';

/** Node (pas Edge) : le juge consensus utilise le SDK Anthropic, peu fiable / indisponible en Edge. */
export const runtime = 'nodejs';

const bodySchema = z.object({
  question: z.string().min(1).max(2000),
  mode: z.enum(['quick', 'deep', 'thread_deep']).optional().default('quick'),
  input_language: z.string().optional(),
  project_id: z.string().optional(),
  context: z.string().optional(),
  memoryContext: z.string().nullable().optional(),
  debate_id: z.string().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  /** Sans session Clerk → plafond anonyme (IP). Avec session → plan + quota lus en base (source de vérité). */
  const isAnonymous = !userId;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { question, mode, input_language, project_id, context, memoryContext, debate_id } = body;
  const memoryContextTrimmed =
    typeof memoryContext === 'string' ? memoryContext.trim() : '';

  if (isAnonymous) {
    const ANON_LIMIT = 2;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const supabase = getSupabaseServer();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from('anonymous_usage')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since);

    if ((count ?? 0) >= ANON_LIMIT) {
      return Response.json({ error: 'ANONYMOUS_LIMIT' }, { status: 429 });
    }

    await supabase.from('anonymous_usage').insert({ ip });
  }

  const user = isAnonymous ? null : await getUserByClerkId(userId as string);
  if (!isAnonymous && !user) return Response.json({ error: 'User not found' }, { status: 404 });

  const plan = ((user?.plan as Plan) ?? 'free') as Plan;
  const quotaCost =
    mode === 'thread_deep'
      ? QUOTA_COSTS.thread_deep
      : mode === 'deep'
      ? QUOTA_COSTS.new_deep
      : QUOTA_COSTS.new_quick;
  const monthlyLimit = MONTHLY_QUOTAS[plan];

  if (!isAnonymous && (user!.requests_used ?? 0) + quotaCost > monthlyLimit) {
    return Response.json({ error: 'QUOTA_EXCEEDED', plan }, { status: 429 });
  }

  const aiMode = mode === 'thread_deep' ? 'deep' : mode;
  const planConfig = PLAN_CONFIG[plan];

  /** Tours déjà enregistrés sur ce débat → contexte pour les modèles (sinon chaque question est traitée isolément). */
  let mergeForThreadPrompt: Awaited<ReturnType<typeof getDebateMergeState>> | null = null;
  if (!isAnonymous && user && typeof debate_id === 'string' && debate_id.length > 0) {
    mergeForThreadPrompt = await getDebateMergeState(debate_id, user.id);
  }
  const threadHistory =
    mergeForThreadPrompt?.conversation_turns?.length &&
    mergeForThreadPrompt.conversation_turns.length > 0
      ? buildThreadHistoryPrompt(mergeForThreadPrompt.conversation_turns)
      : null;

  let effectiveQuestion =
    mode === 'thread_deep' && context
      ? `Previous synthesis:\n${context}\n\nFollow-up question:\n${question}`
      : question;

  if (threadHistory) {
    effectiveQuestion =
      `The user continues the same conversation. Use all prior turns for context, entities, and follow-ups.\n\n${threadHistory}\n\n---\nCurrent request:\n${effectiveQuestion}`;
  }

  if (memoryContextTrimmed) {
    effectiveQuestion = `Context from a linked conversation:\n---\n${memoryContextTrimmed}\n---\n\nNew question: ${effectiveQuestion}`;
  }

  let optimalModels: AIModelConfig[] = [];

  try {
    optimalModels = await getOptimalModels(question, plan, aiMode);
  } catch {
    optimalModels = [];
  }

  const normalizeConfig = (m: Partial<AIModelConfig> | null | undefined): AIModelConfig => {
    const provider = m?.provider ?? '';
    const model_id = m?.model_id ?? '';
    const display_name = m?.display_name ?? '';
    const min_plan = m?.min_plan ?? 'free';

    return {
      provider,
      model_id,
      display_name,
      min_plan,
      cost_per_1k_input_tokens: m?.cost_per_1k_input_tokens ?? 0,
      cost_per_1k_output_tokens: m?.cost_per_1k_output_tokens ?? 0,
      strengths: m?.strengths ?? [],
      max_tokens: m?.max_tokens ?? 2000,
      supports_vision: m?.supports_vision ?? false,
      supports_search: m?.supports_search ?? false,
      priority: m?.priority ?? 0,
    };
  };

  const modelsWithConfig: Array<{ config: AIModelConfig | null; model: AIModel }> =
    optimalModels.length > 0
      ? optimalModels.map((m) => {
          const cfg = normalizeConfig(m);
          const provider = cfg.provider;
          const model_id = cfg.model_id;
          const display_name = cfg.display_name;
          const min_plan = cfg.min_plan;

          const id =
            provider === 'anthropic'
              ? 'claude'
              : provider === 'openai'
                ? 'gpt4o'
                : provider === 'google'
                  ? 'gemini'
                  : provider === 'deepseek'
                    ? 'deepseek'
                    : provider === 'xai'
                      ? 'grok'
                      : 'perplexity';

          // Defensive normalization for deprecated IDs.
          let name = model_id;
          if (provider === 'perplexity') {
            if (name.includes('llama-3.1-sonar-small')) name = 'sonar';
            if (name.includes('llama-3.1-sonar-large')) name = 'sonar-pro';
          }
          if (provider === 'xai') {
            if (name.includes('grok-2-1212')) name = 'grok-3';
          }

          return {
            config: cfg,
            model: {
              id,
              name,
              displayName: display_name,
              provider: provider as any,
              color:
                AI_MODELS.find((ai) => ai.provider === provider)?.color ?? '#8B5CF6',
              minPlan: min_plan as Plan,
            },
          };
        })
      : AI_MODELS.filter((m) =>
          planConfig.models.some((pm) => pm.id === m.id)
        ).map((model) => ({ config: null, model }));

  // Ensure all plan models are included even if DB routing omitted some providers.
  const presentIds = new Set(modelsWithConfig.map((m) => m.model.id));
  const fallbackById = new Map(AI_MODELS.map((m) => [m.id, m]));
  for (const planned of planConfig.models) {
    if (presentIds.has(planned.id)) continue;
    const fallback = fallbackById.get(planned.id);
    if (!fallback) continue;
    modelsWithConfig.push({
      config: null,
      model: { ...fallback, name: planned.name },
    });
    presentIds.add(planned.id);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: DebateStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const responses: Array<{
          model: string;
          displayName: string;
          content: string;
          latency_ms: number;
          error?: string;
        }> = [];

        await Promise.allSettled(
          modelsWithConfig.map(async ({ config, model }) => {
            const maxTokens = config ? await getMaxTokens(config, aiMode, effectiveQuestion) : undefined;
            const result = await callAIModel(
              model,
              effectiveQuestion,
              undefined,
              aiMode,
              maxTokens
            );
            responses.push(result);
            send({
              type: 'ai_response',
              model: result.model,
              displayName: result.displayName,
              content: result.content,
              latency_ms: result.latency_ms,
              ...(result.error && { error: result.error }),
            });
          })
        );

        const { score, disagreements } = await calculateConsensus(responses);
        const hasDisagreement = score >= 0 && score < 60;
        send({
          type: 'consensus',
          score,
          has_disagreement: hasDisagreement,
          disagreements,
        });

        let synthesis: string;

        if (aiMode === 'deep') {
          synthesis = '';
          const synthesisGen = generateDeepSynthesisStream(
            responses,
            effectiveQuestion,
            planConfig.synthesisModel
          );
          for await (const chunk of synthesisGen) {
            if (chunk.type === 'step') {
              send({ type: 'synthesis_step', text: chunk.text } as DebateStreamEvent);
            } else if (chunk.type === 'content') {
              send({ type: 'synthesis_chunk', text: chunk.text } as DebateStreamEvent);
            } else if (chunk.type === 'done') {
              synthesis = chunk.text;
              send({ type: 'synthesis_done', text: chunk.text } as DebateStreamEvent);
            }
          }
        } else {
          synthesis = await generateSynthesis(
            effectiveQuestion,
            responses,
            planConfig.synthesisModel
          );
        }

        send({ type: 'synthesis', content: synthesis });

        if (isAnonymous) {
          send({ type: 'done', debate_id: 'anonymous' });
          return;
        }

        const newTurn = {
          question,
          ai_responses: responses,
          consensus_score: score,
          has_disagreement: score >= 0 && score < 60,
          disagreement_details: disagreements,
          synthesis,
          /** Colonne JSON : quick | deep uniquement (pas thread_deep). */
          mode: aiMode,
          completed_at: new Date().toISOString(),
        };

        let finalDebateId: string;
        if (typeof debate_id === 'string' && debate_id.length > 0) {
          const merge =
            mergeForThreadPrompt ?? (await getDebateMergeState(debate_id, user!.id));
          if (merge) {
            const mergedQuestion = `${merge.question}${DEBATE_QUESTION_MERGE_SEP}${question}`;
            const conversation_turns = [...merge.conversation_turns, newTurn];
            finalDebateId = (
              await updateDebate({
                user_id: user!.id,
                debate_id,
                question: mergedQuestion,
                input_language: input_language ?? 'en',
                ai_responses: responses,
                consensus_score: score,
                has_disagreement: score >= 0 && score < 60,
                synthesis,
                disagreement_details: disagreements,
                models_used: modelsWithConfig.map((m) => m.model.id),
                ...(project_id ? { project_id } : {}),
                conversation_turns,
              })
            ).id;
          } else {
            finalDebateId = (
              await saveDebate({
                user_id: user!.id,
                question,
                persona: null,
                input_language: input_language ?? 'en',
                ai_responses: responses,
                consensus_score: score,
                has_disagreement: score >= 0 && score < 60,
                synthesis,
                disagreement_details: disagreements,
                models_used: modelsWithConfig.map((m) => m.model.id),
                ...(project_id ? { project_id } : {}),
                mode,
              })
            ).id;
          }
        } else {
          finalDebateId = (
            await saveDebate({
              user_id: user!.id,
              question,
              persona: null,
              input_language: input_language ?? 'en',
              ai_responses: responses,
              consensus_score: score,
              has_disagreement: score >= 0 && score < 60,
              synthesis,
              disagreement_details: disagreements,
              models_used: modelsWithConfig.map((m) => m.model.id),
              ...(project_id ? { project_id } : {}),
              mode,
            })
          ).id;
        }

        await incrementUserRequests(user!.id, quotaCost);
        triggerEmailSequence(user!).catch(() => {});
        send({ type: 'done', debate_id: finalDebateId });
      } catch {
        send({ type: 'error', message: 'Server error. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };

  return new Response(stream, {
    headers,
  });
}
