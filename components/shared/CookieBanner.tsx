'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setVisible(false);
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.opt_out_capturing();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white px-6 py-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">We use cookies 🍪</p>
          <p className="mt-1 text-sm text-neutral-500">
            We use essential cookies for authentication and optional analytics cookies to improve
            the product.{' '}
            <Link href="/privacy" className="text-violet-600 hover:underline">
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={decline}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
          >
            Essential only
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

