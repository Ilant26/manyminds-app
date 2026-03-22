'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

export function FreeAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-center text-xl font-bold text-neutral-900">
          Keep using ManyMinds for free
        </h2>

        <div className="mt-5 flex flex-col items-center gap-3 text-center">
          <p className="text-sm leading-relaxed text-neutral-700">
            Create a free account and get 30 credits every month — no credit card required.
          </p>

          <Link
            href="/sign-up"
            className="mx-auto inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Create free account
          </Link>

          <span className="text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/sign-in" className="font-semibold text-violet-700 hover:underline">
              Sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

