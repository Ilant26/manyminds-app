'use client';

import { useLayoutEffect } from 'react';

export function ScrollToTopOnLoad() {
  useLayoutEffect(() => {
    // Ensure homepage always starts at the top (Hero first), even with scroll restoration.
    const prev = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      // ignore
    }
    window.scrollTo(0, 0);

    const onPageShow = () => window.scrollTo(0, 0);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      try {
        window.history.scrollRestoration = prev;
      } catch {
        // ignore
      }
    };
  }, []);

  return null;
}

