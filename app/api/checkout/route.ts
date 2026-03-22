import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createCheckoutSession, PLANS } from '@/lib/stripe/plans';
import { getUserByClerkId } from '@/lib/db/users';

export async function GET(req: Request) {
  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const referer = req.headers.get('referer');
  const fallbackReturnTo = '/pricing';
  const returnTo = (() => {
    try {
      if (!referer) return fallbackReturnTo;
      const u = new URL(referer);
      return `${u.pathname}${u.search}`;
    } catch {
      return fallbackReturnTo;
    }
  })();

  if (!userId) {
    return NextResponse.redirect(new URL(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`, req.url));
  }

  // Support legacy param (?priceId=) and new param (?plan=...&annual=0/1).
  let priceId = searchParams.get('priceId') ?? '';
  if (!priceId) {
    const planId = searchParams.get('plan') ?? '';
    const annual = searchParams.get('annual') === '1';
    const plan = PLANS.find((p) => p.id === planId);
    if (plan) {
      priceId = annual ? plan.stripe_price_id_annual : plan.stripe_price_id_monthly;
    }
  }

  if (!priceId) {
    return NextResponse.redirect(new URL(returnTo, req.url));
  }

  const user = await getUserByClerkId(userId);
  const customerId = user?.stripe_customer_id;

  const { url } = await createCheckoutSession(priceId, userId, customerId);
  if (url) {
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(returnTo, req.url));
}
