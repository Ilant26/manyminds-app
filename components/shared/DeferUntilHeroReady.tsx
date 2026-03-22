'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function DeferUntilHeroReady({
  children,
  delayMs = 800,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  return ready ? <>{children}</> : null;
}

