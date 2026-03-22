'use client';

import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useHasMounted } from '@/hooks/useHasMounted';
import { Sidebar } from '@/components/dashboard/Sidebar';
import type { Plan } from '@/types';

function computeAgeFromISODate(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, mo, d] = match;
  const dob = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

export function DashboardShell({
  children,
  plan,
}: {
  children: React.ReactNode;
  plan: Plan;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [savingAge, setSavingAge] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const { isLoaded, isSignedIn, user } = useUser();
  const hasMounted = useHasMounted();
  const clerk = useClerk();
  const toggle = useCallback(() => setCollapsed((v) => !v), []);
  const minAge = 16;

  const hasStoredDob = useMemo(() => {
    const val = user?.unsafeMetadata?.dateOfBirth;
    return typeof val === 'string' && val.trim().length > 0;
  }, [user?.unsafeMetadata?.dateOfBirth]);

  /** Après mount uniquement : évite modal + boutons côté SSR alors que le client hydrate sans. */
  const shouldBlockForAge = hasMounted && isLoaded && isSignedIn && !hasStoredDob;

  async function onValidateAge(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setAgeError(null);
    const age = computeAgeFromISODate(dateOfBirth);
    if (!dateOfBirth || age === null) {
      setAgeError('Please enter a valid date of birth.');
      return;
    }
    if (age < minAge) {
      setAgeError(`You must be at least ${minAge} years old to use ManyMinds.`);
      return;
    }

    setSavingAge(true);
    try {
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata ?? {}),
          dateOfBirth,
        },
      });
      setDateOfBirth('');
    } catch {
      setAgeError('Unable to save your date of birth. Please try again.');
    } finally {
      setSavingAge(false);
    }
  }

  return (
    <div
      className="relative flex h-dvh flex-row overflow-hidden bg-white text-neutral-900"
      style={
        {
          ['--mm-sidebar-width']: collapsed ? '4rem' : '168px',
        } as CSSProperties
      }
    >
      {/*
        Espace réservé : la sidebar est en position fixed (voir Sidebar) pour qu’aucun contenu
        du main (chat, modales) ne la recouvre au hit-test.
      */}
      <div
        className={`shrink-0 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-[168px]'}`}
        aria-hidden
      />
      <div className="relative isolate z-0 flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50 p-6">
          {children}
        </main>
      </div>
      <Sidebar collapsed={collapsed} onToggle={toggle} plan={plan} />

      {shouldBlockForAge ? (
        <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-center text-xl font-bold text-neutral-900">Age verification required</h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Please confirm your date of birth to continue. You must be 16+.
            </p>

            <form onSubmit={onValidateAge} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-800">Date of birth</label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              {ageError ? (
                <p className="text-center text-sm font-medium text-red-700">{ageError}</p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => clerk.signOut({ redirectUrl: '/' })}
                  className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Sign out
                </button>
                <button
                  type="submit"
                  disabled={savingAge}
                  className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAge ? 'Validating…' : 'Validate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

