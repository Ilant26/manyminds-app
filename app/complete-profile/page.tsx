'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

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

export default function CompleteProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const minAge = 16;
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const age = useMemo(() => computeAgeFromISODate(dateOfBirth), [dateOfBirth]);
  const isUnderage = age !== null && age < minAge;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !isSignedIn || !user) return;
    setError(null);

    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return;
    }
    if (age === null) {
      setError('Please enter a valid date of birth.');
      return;
    }
    if (isUnderage) {
      setError(`You must be at least ${minAge} years old to use ManyMinds.`);
      return;
    }

    setSubmitting(true);
    try {
      await user.update({ unsafeMetadata: { ...(user.unsafeMetadata ?? {}), dateOfBirth } });
      router.replace('/chat');
    } catch {
      setError('Unable to save your profile right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-neutral-700">Please sign in to complete your profile.</p>
          <Link
            href="/sign-in"
            className="mt-4 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-lg">
          <h1 className="text-center text-3xl font-bold tracking-tight text-neutral-900">
            Complete your profile
          </h1>
          <p className="mt-3 text-center text-sm text-neutral-600">
            To continue, please confirm your age.
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-6 max-w-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-800">Date of birth</label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
              {isUnderage ? (
                <p className="mt-2 text-xs text-red-700">You must be at least {minAge} years old.</p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || isUnderage}
              className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
