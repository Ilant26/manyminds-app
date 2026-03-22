'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (key && host && typeof window !== 'undefined' && !(posthog as unknown as { __loaded?: boolean }).__loaded) {
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
