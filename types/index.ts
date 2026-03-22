export type Plan =
  | 'free'
  | 'plus'
  | 'pro'
  | 'team'
  | 'business'
  | 'enterprise';

export type Persona = 'optimist' | 'devil' | 'expert' | null;

export type VoiceState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'done'
  | 'error';

export type DebateStatus =
  | 'idle'
  | 'loading'
  | 'streaming'
  | 'done'
  | 'error';

export type Provider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'xai'
  | 'perplexity';

export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  color: string;
  provider: Provider;
  minPlan: Plan;
}

export interface AIResponse {
  model: string;
  displayName: string;
  content: string;
  latency_ms: number;
  error?: string;
}

export interface DisagreementDetail {
  topic: string;
  models_for: string[];
  models_against: string[];
  description: string;
}

/** Tour persisté en base (une entrée = toute la conversation, plusieurs tours). */
export interface ConversationTurnRecord {
  question: string;
  ai_responses: AIResponse[];
  consensus_score: number;
  has_disagreement: boolean;
  disagreement_details: DisagreementDetail[];
  synthesis: string;
  mode: 'quick' | 'deep' | 'thread_deep';
  completed_at: string;
}

/** Un tour Q/R terminé dans un panneau chat (plusieurs tours par session). */
export interface ChatTurnSnapshot {
  id: string;
  question: string;
  debateId: string | null;
  responses: AIResponse[];
  consensusScore: number;
  hasDisagreement: boolean;
  disagreements: DisagreementDetail[];
  synthesis: string;
  mode: 'quick' | 'deep';
  createdAt: number;
}

export interface Debate {
  id: string;
  question: string;
  /** Short label in History / projects; full prompt thread remains in `question`. */
  title?: string;
  /** Tours successifs (même ligne en historique). Absent ou vide = débat mono-tour legacy. */
  conversation_turns?: ConversationTurnRecord[];
  persona: Persona;
  input_language: string;
  consensus_score: number;
  has_disagreement: boolean;
  ai_responses: AIResponse[];
  synthesis: string;
  disagreement_details: DisagreementDetail[];
  models_used: string[];
  is_public: boolean;
  share_slug?: string;
  created_at: string;
  /** Last content or project-attachment change; for sorting (newest first) */
  updated_at?: string;
  is_team_shared?: boolean;
  project_id?: string;
  tags?: string[];
  image_url?: string;
}

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  plan: Plan;
  requests_used: number;
  requests_limit: number;
  stripe_customer_id?: string;
  topup_questions?: number;
  questions_last_3h?: number;
  rate_window_start?: string;
}

export interface PlanConfig {
  id: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  requests_limit: number;
  models: string[];
  stripe_price_id_monthly: string;
  stripe_price_id_annual: string;
  features: string[];
  isPopular?: boolean;
}

export type DebateStreamEvent =
  | {
      type: 'ai_response';
      model: string;
      displayName: string;
      content: string;
      latency_ms: number;
      error?: string;
    }
  | {
      type: 'consensus';
      score: number;
      has_disagreement: boolean;
      disagreements: DisagreementDetail[];
    }
  | { type: 'synthesis'; content: string }
  | { type: 'done'; debate_id: string }
  | { type: 'error'; message: string };