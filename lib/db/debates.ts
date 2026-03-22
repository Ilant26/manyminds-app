import { nanoid } from 'nanoid';
import type {
  AIResponse,
  ConversationTurnRecord,
  Debate,
  DisagreementDetail,
  Persona,
} from '@/types';
import { deriveConversationTitleFromQuestion } from '@/lib/conversation-title';
import { getSupabaseServer } from './client';

export async function saveDebate(payload: {
  user_id: string;
  question: string;
  persona: Persona;
  input_language: string;
  ai_responses: AIResponse[];
  consensus_score: number;
  has_disagreement: boolean;
  synthesis: string;
  disagreement_details: DisagreementDetail[];
  models_used: string[];
  project_id?: string;
  mode: 'quick' | 'deep' | 'thread_deep';
}): Promise<{ id: string }> {
  const supabase = getSupabaseServer();
  const title = deriveConversationTitleFromQuestion(payload.question);
  const completed_at = new Date().toISOString();
  const firstTurn: ConversationTurnRecord = {
    question: payload.question,
    ai_responses: payload.ai_responses,
    consensus_score: payload.consensus_score,
    has_disagreement: payload.has_disagreement,
    disagreement_details: payload.disagreement_details,
    synthesis: payload.synthesis,
    mode: payload.mode,
    completed_at,
  };
  const { data, error } = await supabase
    .from('debates')
    .insert({
      user_id: payload.user_id,
      question: payload.question,
      title,
      persona: null,
      ...(payload.project_id ? { project_id: payload.project_id } : {}),
      input_language: payload.input_language,
      ai_responses: payload.ai_responses,
      consensus_score: payload.consensus_score,
      has_disagreement: payload.has_disagreement,
      synthesis: payload.synthesis,
      disagreement_details: payload.disagreement_details,
      models_used: payload.models_used,
      conversation_turns: [firstTurn],
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function updateDebate(payload: {
  user_id: string;
  debate_id: string;
  question: string;
  input_language: string;
  ai_responses: AIResponse[];
  consensus_score: number;
  has_disagreement: boolean;
  synthesis: string;
  disagreement_details: DisagreementDetail[];
  models_used: string[];
  project_id?: string;
  conversation_turns?: ConversationTurnRecord[];
}): Promise<{ id: string }> {
  const supabase = getSupabaseServer();

  const baseUpdates: Record<string, unknown> = {
    question: payload.question,
    input_language: payload.input_language,
    ai_responses: payload.ai_responses,
    consensus_score: payload.consensus_score,
    has_disagreement: payload.has_disagreement,
    synthesis: payload.synthesis,
    disagreement_details: payload.disagreement_details,
    models_used: payload.models_used,
    ...(payload.conversation_turns
      ? { conversation_turns: payload.conversation_turns }
      : {}),
  };

  if (payload.project_id) {
    baseUpdates.project_id = payload.project_id;
  }

  const withTs = {
    ...baseUpdates,
    updated_at: new Date().toISOString(),
  };

  let res = await supabase
    .from('debates')
    .update(withTs)
    .eq('id', payload.debate_id)
    .eq('user_id', payload.user_id)
    .select('id')
    .single();

  if (res.error) {
    res = await supabase
      .from('debates')
      .update(baseUpdates)
      .eq('id', payload.debate_id)
      .eq('user_id', payload.user_id)
      .select('id')
      .single();
  }

  if (res.error) throw res.error;
  return { id: res.data.id };
}

function normalizeConversationTurnsForRead(
  row: Record<string, unknown>
): ConversationTurnRecord[] | undefined {
  const raw = row.conversation_turns;
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    return raw as ConversationTurnRecord[];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ConversationTurnRecord[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * État nécessaire pour enchaîner un nouveau tour sur le même débat (une ligne dans l’historique).
 */
export async function getDebateMergeState(
  debateId: string,
  userId: string
): Promise<{ question: string; conversation_turns: ConversationTurnRecord[] } | null> {
  const debate = await getDebateByIdForUser(debateId, userId);
  if (!debate) return null;

  const turns = debate.conversation_turns;
  if (turns && turns.length > 0) {
    return {
      question: debate.question,
      conversation_turns: turns,
    };
  }

  const legacyTurn: ConversationTurnRecord = {
    question: debate.question,
    ai_responses: debate.ai_responses ?? [],
    consensus_score: debate.consensus_score ?? 0,
    has_disagreement: Boolean(debate.has_disagreement),
    disagreement_details: debate.disagreement_details ?? [],
    synthesis: debate.synthesis ?? '',
    mode: 'quick',
    completed_at: debate.created_at,
  };
  return {
    question: debate.question,
    conversation_turns: [legacyTurn],
  };
}

export async function getDebateById(debateId: string): Promise<Debate | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('debates')
    .select(
      'id, question, title, persona, input_language, consensus_score, has_disagreement, ai_responses, synthesis, disagreement_details, models_used, is_public, share_slug, created_at, conversation_turns'
    )
    .eq('id', debateId)
    .single();
  if (error || !data) return null;
  return mapRowToDebate(data);
}

export async function getDebateByShareSlug(slug: string): Promise<Debate | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('debates')
    .select(
      'id, question, title, persona, input_language, consensus_score, has_disagreement, ai_responses, synthesis, disagreement_details, models_used, is_public, share_slug, created_at, conversation_turns'
    )
    .eq('share_slug', slug)
    .eq('is_public', true)
    .single();
  if (error || !data) return null;
  return mapRowToDebate(data);
}

export async function getDebateByIdForUser(
  debateId: string,
  userId: string
): Promise<Debate | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('debates')
    .select(
      'id, question, title, persona, input_language, consensus_score, has_disagreement, ai_responses, synthesis, disagreement_details, models_used, is_public, share_slug, created_at, conversation_turns'
    )
    .eq('id', debateId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return mapRowToDebate(data);
}

function mapRowToDebate(row: Record<string, unknown>): Debate {
  const conversation_turns = normalizeConversationTurnsForRead(row);
  return {
    id: row.id as string,
    question: row.question as string,
    conversation_turns,
    ...(row.title != null && String(row.title).trim() !== ''
      ? { title: String(row.title).trim() }
      : {}),
    persona: row.persona as Persona,
    input_language: (row.input_language as string) ?? 'en',
    consensus_score: (row.consensus_score as number) ?? 0,
    has_disagreement: (row.has_disagreement as boolean) ?? false,
    ai_responses: (row.ai_responses as AIResponse[]) ?? [],
    synthesis: (row.synthesis as string) ?? '',
    disagreement_details: (row.disagreement_details as DisagreementDetail[]) ?? [],
    models_used: (row.models_used as string[]) ?? [],
    is_public: (row.is_public as boolean) ?? false,
    share_slug: row.share_slug as string | undefined,
    created_at: row.created_at as string,
    ...(row.updated_at ? { updated_at: row.updated_at as string } : {}),
  };
}

function mapHistoryListRow(row: Record<string, unknown>): Debate {
  const fullTurns = normalizeConversationTurnsForRead(row);
  const slimTurns =
    fullTurns && fullTurns.length > 0
      ? fullTurns.map((t) => ({
          ...t,
          ai_responses: [],
          disagreement_details: [],
        }))
      : undefined;

  return {
    id: row.id as string,
    question: row.question as string,
    ...(slimTurns ? { conversation_turns: slimTurns } : {}),
    ...(row.title != null && String(row.title).trim() !== ''
      ? { title: String(row.title).trim() }
      : {}),
    persona: row.persona as Persona,
    input_language: 'en',
    consensus_score: (row.consensus_score as number | null) ?? 0,
    has_disagreement: (row.has_disagreement as boolean | null) ?? false,
    ai_responses: [],
    synthesis: (row.synthesis as string | null) ?? '',
    disagreement_details: [],
    models_used: [],
    is_public: false,
    created_at: row.created_at as string,
    ...(row.updated_at ? { updated_at: row.updated_at as string } : {}),
    project_id: row.project_id as string | undefined,
  };
}

export async function getHistory(
  userId: string,
  options: { limit?: number; offset?: number; search?: string; project_id?: string } = {}
): Promise<{ debates: Debate[]; total: number }> {
  const { limit = 20, offset = 0, search, project_id } = options;
  const supabase = getSupabaseServer();
  let query = supabase
    .from('debates')
    .select(
      'id, question, title, persona, consensus_score, has_disagreement, synthesis, created_at, updated_at, project_id, conversation_turns',
      {
        count: 'exact',
      }
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search?.trim()) {
    const q = search.trim();
    query = query.or(`title.ilike.%${q}%,question.ilike.%${q}%`);
  }

  if (project_id) {
    query = query.eq('project_id', project_id);
  }

  const first = await query;
  let count = first.count;
  let rows: Record<string, unknown>[] = [];

  // If migration `002_debates_updated_at` is not applied yet, retry without `updated_at`
  if (first.error) {
    let legacy = supabase
      .from('debates')
      .select(
        'id, question, title, persona, consensus_score, has_disagreement, synthesis, created_at, project_id, conversation_turns',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search?.trim()) {
      const q = search.trim();
      legacy = legacy.or(`title.ilike.%${q}%,question.ilike.%${q}%`);
    }
    if (project_id) {
      legacy = legacy.eq('project_id', project_id);
    }
    const legacyRes = await legacy;
    if (legacyRes.error) return { debates: [], total: 0 };
    count = legacyRes.count;
    rows = (legacyRes.data ?? []) as Record<string, unknown>[];
  } else {
    rows = (first.data ?? []) as Record<string, unknown>[];
  }

  const debates: Debate[] = rows.map((row) => mapHistoryListRow(row));
  return { debates, total: count ?? 0 };
}

export async function attachDebatesToProject(payload: {
  user_id: string;
  project_id: string | null;
  debate_ids: string[];
}): Promise<void> {
  const supabase = getSupabaseServer();
  if (!payload.debate_ids.length) return;
  const now = new Date().toISOString();
  await supabase
    .from('debates')
    .update({ project_id: payload.project_id, updated_at: now })
    .eq('user_id', payload.user_id)
    .in('id', payload.debate_ids);
}

export async function detachDebatesFromProject(payload: {
  user_id: string;
  project_id: string;
  debate_ids: string[];
}): Promise<void> {
  const supabase = getSupabaseServer();
  if (!payload.debate_ids.length) return;
  const now = new Date().toISOString();
  const withTs = await supabase
    .from('debates')
    .update({ project_id: null, updated_at: now })
    .eq('user_id', payload.user_id)
    .eq('project_id', payload.project_id)
    .in('id', payload.debate_ids);
  if (withTs.error) {
    await supabase
      .from('debates')
      .update({ project_id: null })
      .eq('user_id', payload.user_id)
      .eq('project_id', payload.project_id)
      .in('id', payload.debate_ids);
  }
}

export async function deleteDebatesForUser(payload: {
  user_id: string;
  debate_ids: string[];
}): Promise<void> {
  const supabase = getSupabaseServer();
  if (!payload.debate_ids.length) return;
  await supabase.from('debates').delete().eq('user_id', payload.user_id).in('id', payload.debate_ids);
}

export async function generateShareSlug(debateId: string, userId: string): Promise<{ slug: string; url: string }> {
  const supabase = getSupabaseServer();
  const { data: debate } = await supabase
    .from('debates')
    .select('id')
    .eq('id', debateId)
    .eq('user_id', userId)
    .single();
  if (!debate) throw new Error('Debate not found');
  const slug = nanoid(8);
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://manyminds.io';
  await supabase
    .from('debates')
    .update({ is_public: true, share_slug: slug })
    .eq('id', debateId);
  return { slug, url: `${baseUrl}/debate/${slug}/share` };
}
