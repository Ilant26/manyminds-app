import type { Plan, User } from '@/types';
import { MONTHLY_QUOTAS } from '@/lib/ai/models';
import { getSupabaseServer } from './client';

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('users')
    .select('id, clerk_id, email, plan, requests_used, requests_limit, stripe_customer_id, topup_questions, questions_last_3h, rate_window_start')
    .eq('clerk_id', clerkId)
    .single();
  if (error || !data) return null;
  const plan = (data.plan as Plan) ?? 'free';
  const limitByPlan = MONTHLY_QUOTAS[plan] ?? 30;
  return {
    id: data.id,
    clerk_id: data.clerk_id,
    email: data.email,
    plan,
    requests_used: data.requests_used ?? 0,
    requests_limit: limitByPlan,
    stripe_customer_id: data.stripe_customer_id ?? undefined,
    topup_questions: data.topup_questions ?? 0,
    questions_last_3h: data.questions_last_3h ?? 0,
    rate_window_start: data.rate_window_start ?? undefined,
  };
}

export async function createUser(payload: {
  clerk_id: string;
  email: string;
}): Promise<User> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('users')
    .insert({
      clerk_id: payload.clerk_id,
      email: payload.email,
      plan: 'free',
      requests_used: 0,
      requests_limit: 30,
      billing_period_start: new Date().toISOString(),
    })
    .select('id, clerk_id, email, plan, requests_used, requests_limit, stripe_customer_id')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    clerk_id: data.clerk_id,
    email: data.email,
    plan: data.plan as Plan,
    requests_used: data.requests_used ?? 0,
    requests_limit: data.requests_limit ?? 30,
    stripe_customer_id: data.stripe_customer_id ?? undefined,
  };
}

export async function deleteUserByClerkId(clerkId: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from('users').delete().eq('clerk_id', clerkId);
}

export async function updateUserPlan(
  clerkId: string,
  plan: Plan,
  requestsLimit: number,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single();
  if (!user) return;
  await supabase
    .from('users')
    .update({
      plan,
      requests_limit: requestsLimit,
      requests_used: 0,
      billing_period_start: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(stripeCustomerId && { stripe_customer_id: stripeCustomerId }),
      ...(stripeSubscriptionId && { stripe_subscription_id: stripeSubscriptionId }),
    })
    .eq('id', user.id);
}

export async function updatePlanByStripeCustomerId(
  stripeCustomerId: string,
  plan: Plan,
  requestsLimit: number,
  stripeSubscriptionId?: string
): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('users')
    .update({
      plan,
      requests_limit: requestsLimit,
      requests_used: 0,
      billing_period_start: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(stripeSubscriptionId && { stripe_subscription_id: stripeSubscriptionId }),
    })
    .eq('stripe_customer_id', stripeCustomerId);
}

export async function downgradeUserToFree(stripeCustomerId: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('users')
    .update({
      plan: 'free',
      requests_limit: 30,
      requests_used: 0,
      billing_period_start: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stripe_subscription_id: null,
    })
    .eq('stripe_customer_id', stripeCustomerId);
}

export async function incrementUserRequests(userId: string, cost: number = 1): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: user } = await supabase
    .from('users')
    .select('requests_used')
    .eq('id', userId)
    .single();
  if (!user) return;
  await supabase
    .from('users')
    .update({
      requests_used: (user.requests_used ?? 0) + cost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
