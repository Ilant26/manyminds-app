'use client';

import { useEffect, useState } from 'react';

/**
 * `false` au 1er rendu (SSR + 1er rendu client hydraté), puis `true` après commit.
 * Garantit le même arbre au moment de l’hydratation (évite boutons Clerk / page métier).
 */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
