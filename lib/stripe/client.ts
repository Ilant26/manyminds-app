import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY!;

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
  }
  return stripe;
}
