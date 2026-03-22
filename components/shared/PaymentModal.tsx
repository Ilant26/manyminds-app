'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';
import type { TopupPackId } from '@/lib/ai/models';

const stripePublishableKey =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) || '';
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

export type PaymentIntentType = 'topup' | 'subscription';

export type PaymentModalIntent =
  | {
      type: 'topup';
      pack_id: TopupPackId;
      pending_question?: string;
      parent_debate_id?: string | null;
    }
  | {
      type: 'subscription';
      plan: 'plus' | 'pro' | 'team' | 'business';
      annual: boolean;
    };

export type PaymentSuccessPayload =
  | { type: 'topup'; pending_question?: string; parent_debate_id?: string | null }
  | { type: 'subscription'; plan: 'plus' | 'pro' | 'team' | 'business' };

export function PaymentModal({
  open,
  onClose,
  intent,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  intent: PaymentModalIntent | null;
  onSuccess: (payload: PaymentSuccessPayload) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function loadSecret() {
      if (!open || !intent) {
        setClientSecret(null);
        setError('');
        return;
      }
      setLoadingSecret(true);
      setError('');
      try {
        if (intent.type === 'topup') {
          const res = await fetch('/api/stripe/payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              pack_id: intent.pack_id,
              pending_question: intent.pending_question ?? '',
              parent_debate_id: intent.parent_debate_id ?? null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Payment init failed');
          const secret = (data as { clientSecret?: string }).clientSecret ?? null;
          if (!secret) throw new Error('Missing client secret');
          if (!cancelled) setClientSecret(secret);
        } else {
          const res = await fetch('/api/stripe/subscription-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              plan: intent.plan,
              annual: intent.annual,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Subscription init failed');
          const secret = (data as { clientSecret?: string }).clientSecret ?? null;
          if (!secret) throw new Error('Missing client secret');
          if (!cancelled) setClientSecret(secret);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Payment init failed');
      } finally {
        if (!cancelled) setLoadingSecret(false);
      }
    }
    loadSecret();
    return () => {
      cancelled = true;
    };
  }, [open, intent]);

  const options = useMemo(() => {
    if (!clientSecret) return undefined;
    return {
      clientSecret,
      appearance: {
        theme: 'stripe' as const,
        variables: {
          colorPrimary: '#9B72EC',
          colorText: '#0a0a08',
          colorBackground: '#ffffff',
          borderRadius: '12px',
        },
      },
    };
  }, [clientSecret]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-xl">
        <div className="relative border-b border-neutral-200 px-5 py-4 pr-14">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-semibold text-neutral-900">
              {intent?.type === 'subscription' ? 'Upgrade plan' : 'Top up credits'}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">Secure checkout powered by Stripe.</p>
          </div>
        </div>

        <div className="px-5 py-5">
          {loadingSecret && (
            <div className="text-center text-sm text-neutral-600">Preparing secure payment…</div>
          )}
          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
              {error}
            </div>
          )}

          {stripePromise && options && intent && (
            <Elements stripe={stripePromise} options={options}>
              <PaymentForm intent={intent} onSuccess={onSuccess} onError={setError} />
            </Elements>
          )}

          {!stripePromise && (
            <div className="text-center text-sm text-neutral-700">
              Stripe publishable key is missing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  intent,
  onSuccess,
  onError,
}: {
  intent: PaymentModalIntent;
  onSuccess: (payload: PaymentSuccessPayload) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements || loading) return;
    setLoading(true);
    onError('');
    try {
      if (intent.type === 'topup') {
        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: window.location.origin + '/chat' },
          redirect: 'if_required',
        });
        if (confirmError) {
          onError(confirmError.message ?? 'Payment failed');
          return;
        }
        onSuccess({
          type: 'topup',
          pending_question: intent.pending_question ?? '',
          parent_debate_id: intent.parent_debate_id ?? null,
        });
        return;
      }

      // Subscription flow: confirm SetupIntent, then create subscription server-side
      const setupResult = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.origin + '/chat' },
        redirect: 'if_required',
      });
      if (setupResult.error) {
        onError(setupResult.error.message ?? 'Setup failed');
        return;
      }
      const setupIntent = (setupResult as { setupIntent?: { payment_method?: string } }).setupIntent;
      const paymentMethodId = setupIntent?.payment_method;
      if (typeof paymentMethodId !== 'string' || !paymentMethodId) {
        onError('No payment method');
        return;
      }

      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
          plan: intent.plan,
          annual: intent.annual,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError((data as { error?: string }).error ?? 'Subscription failed');
        return;
      }

      // If Stripe requires payment confirmation, confirm it now.
      const invoicePaymentClientSecret = (data as { clientSecret?: string }).clientSecret;
      if (invoicePaymentClientSecret) {
        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          clientSecret: invoicePaymentClientSecret,
          confirmParams: { return_url: window.location.origin + '/chat' },
          redirect: 'if_required',
        });
        if (confirmError) {
          onError(confirmError.message ?? 'Payment failed');
          return;
        }
      }

      onSuccess({ type: 'subscription', plan: intent.plan });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !elements || loading}
        className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
      >
        {loading ? 'Processing…' : intent.type === 'subscription' ? 'Upgrade' : 'Pay'}
      </button>
    </div>
  );
}

