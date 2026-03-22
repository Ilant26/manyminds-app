import type { Plan, PlanConfig } from '@/types';
import { getStripe } from './client';

export const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price_monthly: 0,
    price_annual: 0,
    requests_limit: 30,
    models: ['claude', 'gpt4o', 'gemini'],
    stripe_price_id_monthly: '',
    stripe_price_id_annual: '',
    features: [
      '30 credits/mo',
      '3 AI models',
      'Quick & Deep mode',
      'Synthesis + consensus',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price_monthly: 20,
    price_annual: 16,
    requests_limit: 300,
    models: ['claude', 'gpt4o', 'gemini', 'deepseek'],
    stripe_price_id_monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY ?? '',
    stripe_price_id_annual: process.env.STRIPE_PRICE_PLUS_ANNUAL ?? '',
    features: [
      '300 credits/mo',
      '4 AI models',
      'PDF export',
      'History',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 59,
    price_annual: 47,
    requests_limit: 1000,
    models: ['claude', 'gpt4o', 'gemini', 'deepseek', 'grok'],
    stripe_price_id_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    stripe_price_id_annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? '',
    features: [
      '1,000 credits/mo',
      '5 AI models premium',
      'Priority support',
      'Advanced synthesis',
    ],
    isPopular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price_monthly: 199,
    price_annual: 159,
    requests_limit: 3500,
    models: ['claude', 'gpt4o', 'gemini', 'deepseek', 'grok'],
    stripe_price_id_monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? '',
    stripe_price_id_annual: process.env.STRIPE_PRICE_TEAM_ANNUAL ?? '',
    features: [
      '3,500 credits/mo',
      '10 members',
      'Team collaboration',
      'Team analytics',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price_monthly: 699,
    price_annual: 559,
    requests_limit: 12000,
    models: ['claude', 'gpt4o', 'gemini', 'deepseek', 'grok'],
    stripe_price_id_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '',
    stripe_price_id_annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? '',
    features: [
      '12,000 credits/mo',
      '25 members',
      'Priority support',
      'SLA 99.9%',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: -1,
    price_annual: -1,
    requests_limit: 999999,
    models: ['claude', 'gpt4o', 'gemini', 'deepseek', 'grok'],
    stripe_price_id_monthly: '',
    stripe_price_id_annual: '',
    features: [
      'Unlimited credits',
      'Unlimited members',
      'Dedicated support',
      'Custom SLA',
    ],
  },
];

export async function createCheckoutSession(
  priceId: string,
  clerkUserId: string,
  customerId?: string
): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://manyminds.io';
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/chat?upgraded=true`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { clerk_user_id: clerkUserId },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  });
  return {
    url: session.url ?? null,
    sessionId: session.id,
  };
}