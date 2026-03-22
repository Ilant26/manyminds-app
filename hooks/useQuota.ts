'use client';

/**
 * Barre de quota / modales : affichage uniquement. Ce hook ne « donne » aucun droit.
 * Blocage et formules : toujours côté serveur (`auth()`, `getUserByClerkId`, `MONTHLY_QUOTAS`, etc.
 * sur POST /api/debate et les autres routes API).
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

interface QuotaData {
  requests_used: number;
  requests_limit: number;
  plan: string;
}

const fetchOpts: RequestInit = { credentials: 'same-origin' };

export function useQuota() {
  const { isLoaded, isSignedIn } = useAuth();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(30);
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const QUOTA_CACHE_KEY = 'mm_quota_cache_v1';
  const QUOTA_CACHE_TTL_MS = 60_000; // 1 minute

  function saveCache(next: { used: number; limit: number; plan: string; isAnonymous: boolean }) {
    try {
      window.localStorage.setItem(
        QUOTA_CACHE_KEY,
        JSON.stringify({
          ts: Date.now(),
          ...next,
        })
      );
    } catch {
      // ignore cache failures
    }
  }

  const fetchQuota = useCallback(async () => {
    if (!isLoaded) return;

    try {
      if (!isSignedIn) {
        setIsAnonymous(true);
        setPlan('free');
        setLimit(2);
        const anon = (await fetch('/api/anonymous-usage', fetchOpts)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)) as { used?: number; limit?: number } | null;
        const nextUsed = anon?.used ?? 0;
        const nextLimit = typeof anon?.limit === 'number' ? anon.limit : 2;
        setUsed(nextUsed);
        setLimit(nextLimit);
        saveCache({
          used: nextUsed,
          limit: nextLimit,
          plan: 'free',
          isAnonymous: true,
        });
        return;
      }

      // Connecté : ne jamais traiter un 401 comme « anonyme » (course au chargement Clerk / cookie).
      setIsAnonymous(false);
      let lastRes: Response | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        lastRes = await fetch('/api/user', fetchOpts);
        if (lastRes.ok) {
          const data = (await lastRes.json()) as QuotaData;
          setUsed(data.requests_used ?? 0);
          setLimit(data.requests_limit ?? 30);
          setPlan(data.plan ?? 'free');
          saveCache({
            used: data.requests_used ?? 0,
            limit: data.requests_limit ?? 30,
            plan: data.plan ?? 'free',
            isAnonymous: false,
          });
          return;
        }
        if (lastRes.status !== 401) break;
        await new Promise((r) => setTimeout(r, 120 + attempt * 180));
      }

      // Toujours connecté mais /api/user a échoué : pas d’appel anonymous-usage.
      if (lastRes && !lastRes.ok && lastRes.status !== 401) {
        // ex. 404 / 500 — garder l’état affiché (souvent le cache hydrate)
      }
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(QUOTA_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        ts?: number;
        used?: number;
        limit?: number;
        plan?: string;
        isAnonymous?: boolean;
      };
      if (!parsed?.ts || typeof parsed.ts !== 'number') return;
      if (Date.now() - parsed.ts > QUOTA_CACHE_TTL_MS) return;

      setUsed(parsed.used ?? 0);
      setLimit(typeof parsed.limit === 'number' ? parsed.limit : 30);
      setPlan(parsed.plan ?? 'free');
      // Ne jamais réhydrater `isAnonymous` depuis le cache : ça peut afficher « invité » alors que
      // Clerk a une session (TTL 1 min, onglet restauré, etc.). Seul `fetchQuota` + Clerk décident.
      setLoading(false);
    } catch {
      // ignore cache parse failures
    }
    // Only on mount: do not re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    fetchQuota();
  }, [isLoaded, fetchQuota]);

  useEffect(() => {
    const onQuotaChanged = () => {
      fetchQuota();
    };
    window.addEventListener('mm_quota_changed', onQuotaChanged);
    return () => window.removeEventListener('mm_quota_changed', onQuotaChanged);
  }, [fetchQuota]);

  useEffect(() => {
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    if (pct > 70) {
      const t = setInterval(fetchQuota, 30_000);
      return () => clearInterval(t);
    }
  }, [used, limit, fetchQuota]);

  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const isAtLimit = used >= limit;
  const isNear80 = pct >= 80;

  return {
    used,
    limit,
    plan,
    pct,
    isAtLimit,
    isNear80,
    loading,
    isAnonymous,
    refetch: fetchQuota,
  };
}
