import { Resend } from 'resend';
import type { User } from '@/types';
import { getSupabaseServer } from '@/lib/db/client';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Missing RESEND_API_KEY');
  return new Resend(key);
}

const from = process.env.RESEND_FROM_EMAIL ?? 'hello@manyminds.io';
const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://manyminds.io';

export async function triggerEmailSequence(user: User): Promise<void> {
  const count = user.requests_used;
  if (count === 1) await sendEmailOnce(user, 'welcome');
  if (count === 3) await sendEmailOnce(user, 'tips');
  if (count >= 4 && user.plan === 'free') await sendEmailOnce(user, 'upgrade_nudge');
}

type EmailType = 'welcome' | 'tips' | 'upgrade_nudge';

async function sendEmailOnce(user: User, type: EmailType): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: existing } = await supabase
    .from('email_jobs')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', type)
    .maybeSingle();
  if (existing) return;

  const { error: insertError } = await supabase.from('email_jobs').insert({
    user_id: user.id,
    type,
  });
  if (insertError) return;

  let subject: string;
  let html: string;
  switch (type) {
    case 'welcome':
      subject = "Welcome to Manyminds — here's how to get the most out of it";
      html = `
        <h1>Welcome to Manyminds</h1>
        <p>You just ran your first debate. Here are a few tips:</p>
        <ul>
          <li><strong>Try voice input</strong> — tap the mic, speak your question, and we'll transcribe it.</li>
          <li><strong>Share your first debate</strong> — hit Share to get a public link you can send to anyone.</li>
        </ul>
        <p><a href="${baseUrl}/chat">Go to Chat</a></p>
        <p>— The Manyminds team</p>
      `;
      break;
    case 'tips':
      subject = 'Power user tip: ask sharper questions';
      html = `
        <h1>Power user tip</h1>
        <p>To get better answers, ask for constraints, alternatives, and a clear recommendation (with trade-offs).</p>
        <p>Check your <a href="${baseUrl}/history">history</a> to revisit past debates and compare answers.</p>
        <p>— The Manyminds team</p>
      `;
      break;
    case 'upgrade_nudge':
      subject = "You're using Manyminds a lot — time to upgrade?";
      html = `
        <h1>You're on a roll</h1>
        <p>You've already run several debates. Upgrade to <strong>Plus</strong> to get:</p>
        <ul>
          <li>200 debates per month</li>
          <li>5 AIs (including DeepSeek and Kimi)</li>
          <li>PDF export (Decision Brief)</li>
        </ul>
        <p><a href="${baseUrl}/pricing">View plans</a></p>
        <p>— The Manyminds team</p>
      `;
      break;
    default:
      return;
  }

  await getResend().emails.send({
    from,
    to: user.email,
    subject,
    html,
  });
}

export async function sendPaymentFailedEmail(stripeCustomerId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();
  if (!user?.email) return;
  await getResend().emails.send({
    from,
    to: user.email,
    subject: 'Payment failed — update your card',
    html: `
      <h1>Payment failed</h1>
      <p>We couldn't charge your card for your Manyminds subscription. Please update your payment method to avoid losing access.</p>
      <p><a href="${baseUrl}/settings">Update payment</a></p>
      <p>— The Manyminds team</p>
    `,
  });
}

export async function sendTopupUpsellEmail(_user: User): Promise<void> {
  // TODO: implement upsell email after 2 top-ups in a month
}
