import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getUserByClerkId } from '@/lib/db/users';
import { PlanBadge } from '@/components/shared/PlanBadge';
import type { Plan } from '@/types';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await getUserByClerkId(userId);
  if (!user) redirect('/sign-in');

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Account</h2>
        <p className="mt-2 text-neutral-600">{user.email}</p>
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Subscription</h2>
        <div className="mt-2 flex items-center gap-2">
          <PlanBadge plan={user.plan as Plan} />
          <span className="text-sm text-neutral-600">
            {user.requests_used} / {user.requests_limit} conversations this month
          </span>
        </div>
        {user.plan !== 'free' && (
          <a
            href="https://billing.stripe.com/p/login/test"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-violet-700 hover:underline"
          >
            Manage billing →
          </a>
        )}
      </section>
    </div>
  );
}
