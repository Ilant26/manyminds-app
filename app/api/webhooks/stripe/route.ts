import { getStripe } from '@/lib/stripe/client';
import {
  updateUserPlan,
  updatePlanByStripeCustomerId,
  downgradeUserToFree,
  getUserByClerkId,
} from '@/lib/db/users';
import { sendPaymentFailedEmail, sendTopupUpsellEmail } from '@/lib/email/resend';
import { getSupabaseServer } from '@/lib/db/client';
import type { TopupPackId } from '@/lib/ai/models';
import type { Plan } from '@/types';

const TOPUP_PRICE_TO_PACK: Record<string, { packId: string; credits: number }> = {
  [process.env.STRIPE_PRICE_TOPUP_STARTER ?? '']: { packId: 'starter', credits: 40 },
  [process.env.STRIPE_PRICE_TOPUP_POWER ?? '']: { packId: 'power', credits: 80 },
  [process.env.STRIPE_PRICE_TOPUP_MAX ?? '']: { packId: 'max', credits: 150 },
};

const PRICE_TO_PLAN: Record<string, { plan: Plan; limit: number }> = {
  [process.env.STRIPE_PRICE_PLUS_MONTHLY ?? '']: { plan: 'plus', limit: 300 },
  [process.env.STRIPE_PRICE_PLUS_ANNUAL ?? '']: { plan: 'plus', limit: 300 },
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']: { plan: 'pro', limit: 1000 },
  [process.env.STRIPE_PRICE_PRO_ANNUAL ?? '']: { plan: 'pro', limit: 1000 },
  [process.env.STRIPE_PRICE_TEAM_MONTHLY ?? '']: { plan: 'team', limit: 3500 },
  [process.env.STRIPE_PRICE_TEAM_ANNUAL ?? '']: { plan: 'team', limit: 3500 },
  [process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '']: { plan: 'business', limit: 12000 },
  [process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? '']: { plan: 'business', limit: 12000 },
};

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: 'Webhook secret not set' }, { status: 500 });
  }

  let event: import('stripe').Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Invalid signature' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session;
      const clerkId = session.metadata?.clerk_user_id as string | undefined;
      const subscriptionId = session.subscription as string | undefined;
      // Top-up one-time payment
      if (session.mode === 'payment') {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        const pack = priceId ? TOPUP_PRICE_TO_PACK[priceId] : undefined;
        if (!pack) break;

        const clerkId = session.metadata?.clerk_user_id as string | undefined;
        if (!clerkId) break;

        const supabase = getSupabaseServer();
        const user = await getUserByClerkId(clerkId);
        if (!user) break;

        // Check for duplicate
        const paymentIntent = session.payment_intent as string;
        const { data: existing } = await supabase
          .from('top_ups')
          .select('id')
          .eq('stripe_payment_id', paymentIntent)
          .maybeSingle();
        if (existing) break;

        // Add credits
        await supabase
          .from('users')
          .update({
            topup_questions: (user.topup_questions ?? 0) + pack.credits,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        // Record top-up
        await supabase.from('top_ups').insert({
          user_id: user.id,
          pack_id: pack.packId,
          questions_added: pack.credits,
          analyses_added: pack.credits,
          amount_paid: (session.amount_total ?? 0) / 100,
          stripe_payment_id: paymentIntent,
        });
        break;
      }
      if (subscriptionId && clerkId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price.id;
        const config = priceId ? PRICE_TO_PLAN[priceId] : undefined;
        if (config) {
          await updateUserPlan(
            clerkId,
            config.plan,
            config.limit,
            session.customer as string,
            subscriptionId
          );
        }
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const config = priceId ? PRICE_TO_PLAN[priceId] : undefined;
      const customerId = sub.customer as string;
      if (config) {
        await updatePlanByStripeCustomerId(
          customerId,
          config.plan,
          config.limit,
          sub.id
        );
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      await downgradeUserToFree(sub.customer as string);
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as import('stripe').Stripe.Invoice;
      if (!invoice.subscription) break;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const priceId = sub.items.data[0]?.price.id;
      const config = priceId ? PRICE_TO_PLAN[priceId] : undefined;
      if (config) {
        await updatePlanByStripeCustomerId(
          invoice.customer as string,
          config.plan,
          config.limit,
          sub.id
        );
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as import('stripe').Stripe.Invoice;
      await sendPaymentFailedEmail(invoice.customer as string);
      break;
    }
  }

  return Response.json({ received: true });
}
