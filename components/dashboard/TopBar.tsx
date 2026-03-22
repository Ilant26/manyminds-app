'use client';

import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { PlanBadge } from '@/components/shared/PlanBadge';
import type { Plan } from '@/types';

interface TopBarProps {
  title: string;
  plan: Plan;
}

export function TopBar({ title, plan }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
      <div className="flex items-center gap-3">
        <PlanBadge plan={plan} />
        <SignedIn>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'h-8 w-8',
              },
            }}
          />
        </SignedIn>
        <SignedOut>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Create account
            </Link>
          </div>
        </SignedOut>
      </div>
    </header>
  );
}
