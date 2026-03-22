'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useSignUp } from '@clerk/nextjs';

function computeAgeFromISODate(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [_, y, mo, d] = match;
  const dob = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

export function CustomSignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minAge = 16;
  const age = useMemo(() => computeAgeFromISODate(dateOfBirth), [dateOfBirth]);
  const isUnderage = age !== null && age < minAge;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;

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
      setError(`You must be at least ${minAge} years old to create an account.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await signUp.create({
        emailAddress: email,
        password,
        unsafeMetadata: { dateOfBirth },
      });

      // Email verification flow (default)
      await res.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifying(true);
    } catch (err: unknown) {
      const message =
        (err as any)?.errors?.[0]?.longMessage ||
        (err as any)?.errors?.[0]?.message ||
        'Unable to create account.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleSignUp() {
    if (!isLoaded || !signUp) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/chat',
      });
    } catch (err: unknown) {
      const message =
        (err as any)?.errors?.[0]?.longMessage ||
        (err as any)?.errors?.[0]?.message ||
        'Unable to continue with Google.';
      setError(message);
    }
  }

  async function onAppleSignUp() {
    if (!isLoaded || !signUp) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_apple',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/chat',
      });
    } catch (err: unknown) {
      const message =
        (err as any)?.errors?.[0]?.longMessage ||
        (err as any)?.errors?.[0]?.message ||
        'Unable to continue with Apple.';
      setError(message);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        window.location.assign('/chat');
        return;
      }
      setError('Verification failed. Please try again.');
    } catch (err: unknown) {
      const message =
        (err as any)?.errors?.[0]?.longMessage ||
        (err as any)?.errors?.[0]?.message ||
        'Verification failed.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) {
    return <div className="w-full max-w-sm text-sm text-neutral-500">Loading…</div>;
  }

  if (verifying) {
    return (
      <form onSubmit={onVerify} className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-800">Email verification code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <button
        type="button"
        onClick={onGoogleSignUp}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
      >
        <span className="inline-flex h-4 w-4 items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512" aria-hidden="true" className="h-4 w-4">
            <path fill="#EA4335" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C322.2 82.4 203.2 82.4 141.3 174.1c-39.5 57.8-39.5 133.9 0 191.7 45.1 65.8 135.2 82.4 196.1 37.3 27.4-20.1 45.1-49.6 50.3-82.4H248v-85.3h236.1c2.4 12.7 3.9 24.9 3.9 41.4z"/>
            <path fill="#4285F4" d="M484.1 220.5H248v85.3h136.8c-6.5 34.5-26.3 63.5-54.5 83.1l87.3 67.8c50.9-47 80.5-116.1 80.5-197z"/>
            <path fill="#FBBC05" d="M141.3 365.8c-10.1-29.8-10.1-62.1 0-91.9L51.4 206c-34.2 68.1-34.2 148.1 0 216.2l89.9-56.4z"/>
            <path fill="#34A853" d="M248 504c66.8 0 122.9-22.1 163.9-60.1l-87.3-67.8c-22.1 14.8-50.4 23.5-76.6 23.5-61.2 0-113.1-41.3-131.7-97.1l-89.9 56.4C67.8 459.6 152.3 504 248 504z"/>
          </svg>
        </span>
        Continue with Google
      </button>
      <button
        type="button"
        onClick={onAppleSignUp}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
      >
        <span className="inline-flex h-4 w-4 items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.6 0 129.5 42.5 174 42.5 42.7 0 109.8-45 188.5-45 30.5 0 110.7 2.6 168.1 80.6zm-234.4-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
          </svg>
        </span>
        Continue with Apple
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-xs text-neutral-500">or</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-800">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-800">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
      </div>

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
        {submitting ? 'Creating…' : 'Create account'}
      </button>

      <p className="text-xs leading-relaxed text-neutral-500">
        You must be {minAge}+ to create an account.
      </p>
    </form>
  );
}

