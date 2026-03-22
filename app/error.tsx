'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a08] px-6 text-center text-[#f5f5f3]">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-neutral-400">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-neutral-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
