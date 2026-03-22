'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Check, FolderPlus, Pencil, Search, Share2, Trash2, X } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { FreeAccountModal } from '@/components/shared/FreeAccountModal';
import { HydrationSafeDate } from '@/components/shared/HydrationSafeDate';
import { toast } from 'sonner';
import type { Debate } from '@/types';
import { conversationListLabel, conversationTurnCount } from '@/lib/conversation-title';
import type { HistoryPageClientProps, HistoryProjectStub as Project } from './history-page-types';

const ANON_HISTORY_STORAGE_KEY = 'mm_anonymous_history';

function parseHistoryCacheRaw(raw: string | null): { debates: Debate[]; total: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      ts?: number;
      debates?: Debate[];
      total?: number;
    };
    if (parsed?.debates) {
      return {
        debates: parsed.debates ?? [],
        total: parsed.total ?? parsed.debates?.length ?? 0,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Cache signé puis device — avant paint pour éviter « vide » puis liste. */
function readSignedHistoryCacheFromStorage(
  search: string,
  userId: string | null | undefined
): { debates: Debate[]; total: number } | null {
  if (typeof window === 'undefined') return null;
  const searchLower = search.trim().toLowerCase();
  const signedCacheKey = userId ? `mm_history_signed_cache_v1_${userId}_${searchLower}` : null;
  const deviceCacheKey = `mm_history_device_cache_v1_${searchLower}`;
  const fromSigned = signedCacheKey
    ? parseHistoryCacheRaw(window.localStorage.getItem(signedCacheKey))
    : null;
  if (fromSigned) return fromSigned;
  return parseHistoryCacheRaw(window.localStorage.getItem(deviceCacheKey));
}

function debateMatchesSearch(d: Debate, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  if ((d.title ?? '').toLowerCase().includes(q)) return true;
  if ((d.question ?? '').toLowerCase().includes(q)) return true;
  if ((d.synthesis ?? '').toLowerCase().includes(q)) return true;
  const turns = d.conversation_turns;
  if (Array.isArray(turns)) {
    for (const t of turns) {
      if ((t.question ?? '').toLowerCase().includes(q)) return true;
      if ((t.synthesis ?? '').toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

/** Ouvre directement le chat (pas de modale de confirmation). */
function chatOpenHref(d: Pick<Debate, 'id' | 'project_id'>) {
  const p = new URLSearchParams();
  p.set('debateId', d.id);
  if (d.project_id) p.set('projectId', d.project_id);
  return `/chat?${p.toString()}`;
}

const ASSIGN_NEW_PROJECT = '__mm_new_project__';

const DEMO_DEBATES: Debate[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `demo_${i + 1}`,
  question:
    [
      'Should I switch my product from usage-based pricing to subscription?',
      'What are the risks of launching on Product Hunt next week?',
      'How do I validate a B2B idea with 20 customer interviews?',
      'What’s the best onboarding flow for a freemium SaaS?',
      'How should I pick between three competing roadmap priorities?',
      'What’s a good cold email structure for founders?',
      'How do I choose a niche without limiting growth too much?',
      'Should we raise a seed round or bootstrap longer?',
      'How do I position against a bigger competitor?',
      'What’s the fastest way to improve retention?',
    ][i] ?? `Demo conversation ${i + 1}`,
  persona: null,
  input_language: 'en',
  consensus_score: 72,
  has_disagreement: false,
  ai_responses: [],
  synthesis: '',
  disagreement_details: [],
  models_used: [],
  is_public: false,
  created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
}));

export default function HistoryPageClient({
  serverSignedIn,
  serverHistoryPrefetched,
  initialDebates,
  initialTotal,
  initialProjects,
}: HistoryPageClientProps) {
  const t = useTranslations('history');
  const [debates, setDebates] = useState<Debate[]>(() => initialDebates);
  const [total, setTotal] = useState(() => initialTotal);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(() => {
    if (!serverSignedIn) return true;
    if (!serverHistoryPrefetched) return true;
    return false;
  });
  const [isAnonymous, setIsAnonymous] = useState(() => !serverSignedIn);
  const [showFreeAccount, setShowFreeAccount] = useState(false);
  const [projects, setProjects] = useState<Project[]>(() => initialProjects ?? []);
  const [projectByDebate, setProjectByDebate] = useState<Record<string, string>>({});
  const [savingDebateId, setSavingDebateId] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(
    () => serverSignedIn && initialProjects !== undefined
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignProjectId, setBulkAssignProjectId] = useState<string>('');
  const [bulkAssignNewName, setBulkAssignNewName] = useState('');
  const [singleAssignOpen, setSingleAssignOpen] = useState(false);
  const [singleAssignDebateId, setSingleAssignDebateId] = useState<string | null>(null);
  const [singleAssignProjectId, setSingleAssignProjectId] = useState<string>('');
  const [singleAssignNewName, setSingleAssignNewName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDebateId, setRenameDebateId] = useState<string | null>(null);
  const [renameDraftQuestion, setRenameDraftQuestion] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDebateIds, setDeleteDebateIds] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { isLoaded: clerkLoaded, isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (!clerkLoaded) return;
    setIsAnonymous(!isSignedIn);
  }, [clerkLoaded, isSignedIn]);

  /**
   * Invité : hydrate depuis localStorage sans attendre Clerk.
   * Connecté avec données SSR : ne pas écraser avec le cache navigateur sur la liste initiale.
   */
  useLayoutEffect(() => {
    const guest = (clerkLoaded && !isSignedIn) || (!clerkLoaded && !serverSignedIn);

    if (guest) {
      setIsAnonymous(true);
      try {
        const raw = window.localStorage.getItem(ANON_HISTORY_STORAGE_KEY);
        const list = raw ? (JSON.parse(raw) as Debate[]) : [];
        const filtered = (list ?? []).filter((d) => debateMatchesSearch(d, search));
        const show = filtered.length > 0 ? filtered : DEMO_DEBATES;
        setDebates(show);
        setTotal(show.length);
      } catch {
        setDebates(DEMO_DEBATES);
        setTotal(DEMO_DEBATES.length);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!clerkLoaded) {
      if (serverHistoryPrefetched) setLoading(false);
      return;
    }

    if (isSignedIn) {
      if (serverHistoryPrefetched && search === '') {
        setLoading(false);
        return;
      }
      const cached = readSignedHistoryCacheFromStorage(search, userId);
      if (cached) {
        setDebates(cached.debates);
        setTotal(cached.total);
        setLoading(false);
      }
    }
  }, [search, clerkLoaded, isSignedIn, userId, serverSignedIn, serverHistoryPrefetched]);

  useEffect(() => {
    const guest = (clerkLoaded && !isSignedIn) || (!clerkLoaded && !serverSignedIn);

    if (guest) {
      setIsAnonymous(true);
      try {
        const raw = window.localStorage.getItem(ANON_HISTORY_STORAGE_KEY);
        const list = raw ? (JSON.parse(raw) as Debate[]) : [];
        const filtered = (list ?? []).filter((d) => debateMatchesSearch(d, search));
        const show = filtered.length > 0 ? filtered : DEMO_DEBATES;
        setDebates(show);
        setTotal(show.length);
      } catch {
        setDebates(DEMO_DEBATES);
        setTotal(DEMO_DEBATES.length);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!clerkLoaded) {
      if (serverHistoryPrefetched) setLoading(false);
      return;
    }

    const q = new URLSearchParams();
    if (search.trim()) q.set('search', search.trim());
    q.set('limit', '30');

    const searchLower = search.trim().toLowerCase();
    const signedCacheKey = userId ? `mm_history_signed_cache_v1_${userId}_${searchLower}` : null;
    const deviceCacheKey = `mm_history_device_cache_v1_${searchLower}`;
    let cacheApplied = false;

    if (isSignedIn) {
      const cached = readSignedHistoryCacheFromStorage(search, userId);
      if (cached) {
        setDebates(cached.debates);
        setTotal(cached.total);
        setLoading(false);
        cacheApplied = true;
      }
    }

    const skipLoadingBar = Boolean(serverHistoryPrefetched && !search.trim());
    if (!cacheApplied && !skipLoadingBar) setLoading(true);

    setIsAnonymous(false);

    // Signed in: load from API.
    fetch(`/api/debates?${q}`)
      .then(async (res) => {
        if (res.status === 401) {
          // Si Clerk dit que l'utilisateur est signé-in mais que l'API renvoie 401,
          // on évite de basculer en mode "anonymous" (sinon les boutons déclenchent le popup FreeAccount).
          setIsAnonymous(false);
          const raw = window.localStorage.getItem(ANON_HISTORY_STORAGE_KEY);
          const list = raw ? (JSON.parse(raw) as Debate[]) : [];
          const filtered = (list ?? []).filter((d) =>
            debateMatchesSearch(d, search)
          );
          const show = filtered.length > 0 ? filtered : DEMO_DEBATES;
          setDebates(show);
          setTotal(show.length);
          return;
        }
        setIsAnonymous(false);
        const data = (await res.json()) as { debates: Debate[]; total: number };
        setDebates(data.debates ?? []);
        setTotal(data.total ?? 0);

        // Cache signed-in + cache device (device = évite latence UI quand userId/clerk tarde)
        try {
          window.localStorage.setItem(
            deviceCacheKey,
            JSON.stringify({
              ts: Date.now(),
              debates: data.debates ?? [],
              total: data.total ?? 0,
            })
          );
        } catch {
          // ignore cache write errors
        }

        if (userId && signedCacheKey) {
          try {
            window.localStorage.setItem(
              signedCacheKey,
              JSON.stringify({
                ts: Date.now(),
                debates: data.debates ?? [],
                total: data.total ?? 0,
              })
            );
          } catch {
            // ignore cache write errors
          }
        }
      })
      .catch(() => {
        setDebates([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [search, clerkLoaded, isSignedIn, userId, serverSignedIn, serverHistoryPrefetched]);

  useEffect(() => {
    if (isAnonymous) return;
    if (projectsLoaded) return;
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { projects?: Project[] } | null) => {
        setProjects(data?.projects ?? []);
        setProjectsLoaded(true);
      })
      .catch(() => {
        setProjects([]);
        setProjectsLoaded(true);
      });
  }, [isAnonymous, projectsLoaded]);

  useEffect(() => {
    if (isAnonymous) return;
    // Seed dropdown value from existing debate.project_id when present
    setProjectByDebate((prev) => {
      const next = { ...prev };
      for (const d of debates) {
        if (d.project_id && !next[d.id]) next[d.id] = d.project_id;
      }
      return next;
    });
  }, [debates, isAnonymous]);

  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  async function createOrResolveProjectId(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.status === 401) {
      setShowFreeAccount(true);
      return null;
    }
    if (!res.ok) {
      toast.error('Could not create project.');
      return null;
    }
    const data = (await res.json()) as { project: Project };
    setProjects((prev) => [data.project, ...prev]);
    return data.project.id;
  }

  async function resolveAssignProjectId(selectValue: string, newName: string): Promise<string | null> {
    if (selectValue === ASSIGN_NEW_PROJECT) {
      return createOrResolveProjectId(newName);
    }
    if (selectValue) return selectValue;
    return null;
  }

  async function attachToProject(debateId: string, projectId: string): Promise<boolean> {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return false;
    }
    if (!projectId) return false;
    setSavingDebateId(debateId);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_ids: [debateId] }),
      });
      if (!res.ok) return false;
      setDebates((prev) => prev.map((d) => (d.id === debateId ? { ...d, project_id: projectId } : d)));
      return true;
    } finally {
      setSavingDebateId(null);
    }
  }

  async function confirmSingleAssign() {
    if (!singleAssignDebateId) return;
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }
    const projectId = await resolveAssignProjectId(singleAssignProjectId, singleAssignNewName);
    if (!projectId) {
      if (singleAssignProjectId === ASSIGN_NEW_PROJECT) {
        toast.error('Enter a project name.');
      }
      return;
    }
    const ok = await attachToProject(singleAssignDebateId, projectId);
    if (ok) {
      setSingleAssignOpen(false);
      setSingleAssignDebateId(null);
      setSingleAssignProjectId('');
      setSingleAssignNewName('');
    }
  }

  async function shareDebate(debateId: string) {
    setShareBusy(true);
    setShareUrl('');
    try {
      const res = await fetch(`/api/debate/${encodeURIComponent(debateId)}/share`, {
        method: 'POST',
      });
      if (res.status === 401) {
        setShowFreeAccount(true);
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as { url?: string };
      const url = data.url;
      if (!url) return;

      setShareUrl(url);
      setShareOpen(true);
    } catch {
      // no-op
    } finally {
      setShareBusy(false);
    }
  }

  async function deleteDebate(debateId: string) {
    setDeleteDebateIds([debateId]);
    setDeleteOpen(true);
  }

  async function confirmDeleteDebates() {
    if (deleteBusy) return;
    if (deleteDebateIds.length === 0) return;

    setDeleteBusy(true);
    try {
      const res = await fetch('/api/debates/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_ids: deleteDebateIds }),
      });

      if (res.status === 401) {
        setShowFreeAccount(true);
        return;
      }
      if (!res.ok) return;

      const deleted = new Set(deleteDebateIds);
      setDebates((prev) => prev.filter((d) => !deleted.has(d.id)));
      setTotal((prev) => Math.max(0, prev - deleteDebateIds.length));
      clearSelection();
      setSelectMode(false);
      setDeleteOpen(false);
      setDeleteDebateIds([]);
    } catch {
      // no-op
    } finally {
      setDeleteBusy(false);
    }
  }

  async function saveRenameDebate() {
    if (renameBusy) return;
    if (!renameDebateId) return;

    const nextQuestion = renameDraftQuestion.trim();
    if (!nextQuestion) return;

    setRenameBusy(true);
    try {
      const res = await fetch('/api/debates/rename', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_id: renameDebateId, title: nextQuestion }),
      });

      if (res.status === 401) {
        setShowFreeAccount(true);
        return;
      }
      if (!res.ok) return;

      setDebates((prev) =>
        prev.map((d) => (d.id === renameDebateId ? { ...d, title: nextQuestion } : d))
      );

      setRenameOpen(false);
      setRenameDebateId(null);
      setRenameDraftQuestion('');
    } finally {
      setRenameBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1200);
    } catch {
      setShareCopied(false);
    }
  }

  const selectedList = useMemo(() => Object.entries(selectedIds).filter(([, v]) => v).map(([id]) => id), [selectedIds]);
  const allIds = useMemo(() => debates.map((d) => d.id), [debates]);

  const sortedDebates = useMemo(
    () =>
      [...debates].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
      ),
    [debates]
  );
  const isAllSelected = useMemo(() => allIds.length > 0 && allIds.every((id) => Boolean(selectedIds[id])), [allIds, selectedIds]);

  function toggleSelected(id: string) {
    setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  }

  function clearSelection() {
    setSelectedIds({});
    setBulkAssignProjectId('');
    setBulkAssignNewName('');
  }

  function selectAll() {
    setSelectedIds((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const id of allIds) next[id] = true;
      return next;
    });
  }

  function clearAll() {
    setSelectedIds({});
  }

  async function bulkAssign() {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }
    if (selectedList.length === 0) return;

    const projectId = await resolveAssignProjectId(bulkAssignProjectId, bulkAssignNewName);
    if (!projectId) {
      if (bulkAssignProjectId === ASSIGN_NEW_PROJECT) {
        toast.error('Enter a project name.');
      }
      return;
    }

    setBulkBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_ids: selectedList }),
      });
      if (!res.ok) return;
      setDebates((prev) => prev.map((d) => (selectedIds[d.id] ? { ...d, project_id: projectId } : d)));
      clearSelection();
      setSelectMode(false);
      setBulkAssignOpen(false);
      setBulkAssignNewName('');
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }
    if (selectedList.length === 0) return;
    setDeleteDebateIds(selectedList);
    setDeleteOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-neutral-900">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <button
              type="button"
              onClick={() => {
                setSelectMode(false);
                clearSelection();
              }}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!selectMode) setSelectMode(true);
            }}
            className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Select
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          type="search"
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="peer w-full rounded-2xl border-2 border-neutral-300 bg-white py-2.5 pl-11 pr-4 text-sm font-medium text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 placeholder:font-normal placeholder:text-neutral-400 hover:border-neutral-500 hover:shadow-md focus:border-violet-600 focus:outline-none focus:shadow-[0_0_0_4px_rgba(124,58,237,0.18),0_2px_8px_-2px_rgba(15,23,42,0.12)] focus:ring-0"
        />
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-neutral-500 transition-colors peer-focus:text-violet-600" />
      </div>

      {selectMode ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium text-neutral-800">
              {selectedList.length} selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => (isAllSelected ? clearAll() : selectAll())}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                {isAllSelected ? 'Clear all' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isAnonymous) {
                    setShowFreeAccount(true);
                    return;
                  }
                  setBulkAssignOpen(true);
                }}
                disabled={bulkBusy || selectedList.length === 0}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Assign to project
              </button>
              <button
                type="button"
                onClick={() => void bulkDelete()}
                disabled={bulkBusy || selectedList.length === 0}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>

      <div className="scrollbar-subtle mt-2 min-h-0 flex-1 overflow-y-auto pr-4">
      {loading && debates.length === 0 ? (
        <div className="space-y-3 py-2" aria-busy="true" aria-label={t('loading')}>
          <p className="text-sm text-neutral-500">{t('loading')}</p>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-neutral-100"
            />
          ))}
        </div>
      ) : debates.length === 0 ? (
        <p className="text-neutral-500">{t('runFirst')}</p>
      ) : isAnonymous ? (
        <ul className="space-y-3">
          {debates.map((d) => (
            <li key={d.id}>
              <div className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-violet-500 hover:shadow-md hover:shadow-violet-100/50 focus-within:border-violet-500">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {selectMode ? (
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[d.id])}
                        onChange={() => toggleSelected(d.id)}
                        className="mt-1 h-4 w-4 rounded-md border-2 border-neutral-900 accent-neutral-900 focus:outline-none focus:ring-0 focus:ring-offset-0"
                        aria-label="Select conversation"
                      />
                    ) : null}
                    {selectMode ? (
                      <div className="min-w-0 flex-1 text-left">
                        <p className="line-clamp-2 font-medium text-neutral-900">
                          {conversationListLabel(d)}
                        </p>
                      </div>
                    ) : (
                      <Link href={chatOpenHref(d)} className="min-w-0 flex-1 text-left">
                        <p className="line-clamp-2 font-medium text-neutral-900">
                          {conversationListLabel(d)}
                        </p>
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isAnonymous) setShowFreeAccount(true);
                      }}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50"
                      aria-label="Rename"
                    >
                      <Pencil className="h-4 w-4 group-hover:text-amber-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Rename
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFreeAccount(true)}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                      aria-label="Assign to project"
                    >
                      <FolderPlus className="h-4 w-4 group-hover:text-emerald-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Assign to project
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFreeAccount(true)}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-sky-300 hover:bg-sky-50"
                      aria-label="Share"
                    >
                      <Share2 className="h-4 w-4 group-hover:text-sky-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Share
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFreeAccount(true)}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-red-300 hover:bg-red-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 group-hover:text-red-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Delete
                      </span>
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  <HydrationSafeDate iso={d.created_at} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {sortedDebates.map((d) => (
            <li key={d.id}>
              <div className="flex items-stretch justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-violet-500 hover:shadow-md hover:shadow-violet-100/50 focus-within:border-violet-500">
                {selectMode ? (
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[d.id])}
                      onChange={() => toggleSelected(d.id)}
                      className="mt-1 h-4 w-4 rounded-md border-2 border-neutral-900 accent-neutral-900 focus:outline-none focus:ring-0 focus:ring-offset-0"
                      aria-label="Select conversation"
                    />
                  </div>
                ) : null}
                {selectMode ? (
                  <div className="min-w-0 flex-1 text-left">
                    <p className="line-clamp-2 font-medium text-neutral-900">
                      {conversationListLabel(d)}
                    </p>
                    {conversationTurnCount(d) > 1 ? (
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {conversationTurnCount(d)} échanges · une conversation
                      </p>
                    ) : null}
                    <div className="mt-2 text-xs text-neutral-500">
                      <HydrationSafeDate iso={d.updated_at ?? d.created_at} />
                      {d.project_id && projectsById[d.project_id] ? (
                        <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                          {projectsById[d.project_id]?.name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <Link href={chatOpenHref(d)} className="min-w-0 flex-1 text-left">
                    <p className="line-clamp-2 font-medium text-neutral-900">
                      {conversationListLabel(d)}
                    </p>
                    {conversationTurnCount(d) > 1 ? (
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {conversationTurnCount(d)} échanges · une conversation
                      </p>
                    ) : null}
                    <div className="mt-2 text-xs text-neutral-500">
                      <HydrationSafeDate iso={d.updated_at ?? d.created_at} />
                      {d.project_id && projectsById[d.project_id] ? (
                        <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                          {projectsById[d.project_id]?.name}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                )}

                <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameDebateId(d.id);
                        setRenameDraftQuestion(conversationListLabel(d));
                        setRenameOpen(true);
                      }}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50"
                      aria-label="Rename"
                    >
                      <Pencil className="h-4 w-4 group-hover:text-amber-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Rename
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSignedIn) {
                          setShowFreeAccount(true);
                          return;
                        }
                        setSingleAssignDebateId(d.id);
                        setSingleAssignProjectId(projectByDebate[d.id] ?? '');
                        setSingleAssignNewName('');
                        setSingleAssignOpen(true);
                      }}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                      aria-label="Assign to project"
                    >
                      <FolderPlus className="h-4 w-4 group-hover:text-emerald-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Assign to project
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void shareDebate(d.id);
                      }}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-sky-300 hover:bg-sky-50"
                      aria-label="Share"
                    >
                      <Share2 className="h-4 w-4 group-hover:text-sky-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Share
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteDebate(d.id);
                      }}
                      className="group relative rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-700 transition hover:border-red-300 hover:bg-red-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 group-hover:text-red-600" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-900 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-100 opacity-0 shadow-xl ring-1 ring-neutral-800 transition-opacity duration-75 group-hover:opacity-100">
                        Delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>

      <FreeAccountModal open={showFreeAccount} onClose={() => setShowFreeAccount(false)} />

      {/* Rename modal */}
      {renameOpen && renameDebateId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setRenameOpen(false);
                setRenameDebateId(null);
                setRenameDraftQuestion('');
                setRenameBusy(false);
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-neutral-900 text-center">Rename conversation</h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Update the title shown in History.
            </p>
            <div className="mt-4">
              <input
                value={renameDraftQuestion}
                onChange={(e) => setRenameDraftQuestion(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-violet-300 focus:outline-none"
                type="text"
                placeholder="Conversation title"
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!renameBusy) void saveRenameDebate();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setRenameOpen(false);
                    setRenameDebateId(null);
                    setRenameDraftQuestion('');
                    setRenameBusy(false);
                  }
                }}
              />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRenameOpen(false);
                  setRenameDebateId(null);
                  setRenameDraftQuestion('');
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                disabled={renameBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveRenameDebate()}
                disabled={renameBusy || !renameDraftQuestion.trim()}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {renameBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Share modal */}
      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShareOpen(false);
                setShareUrl('');
                setShareCopied(false);
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-neutral-900 text-center">Share link</h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Copy a link to reopen this conversation.
            </p>

            <div className="mt-4">
              <input
                value={shareUrl}
                readOnly
                className="w-full cursor-text rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
              />
            </div>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShareOpen(false);
                  setShareUrl('');
                  setShareCopied(false);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void copyShareLink()}
                disabled={!shareUrl || shareBusy}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {shareCopied ? 'Copied' : shareBusy ? 'Preparing…' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete modal */}
      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteDebateIds([]);
                setDeleteBusy(false);
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-neutral-900 text-center">
              {deleteDebateIds.length > 1 ? `Delete ${deleteDebateIds.length} conversations?` : 'Delete this conversation?'}
            </h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              This action can't be undone.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteDebateIds([]);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteDebates()}
                disabled={deleteBusy}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkAssignOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (bulkBusy) return;
            const canConfirm =
              bulkAssignProjectId === ASSIGN_NEW_PROJECT
                ? Boolean(bulkAssignNewName.trim())
                : Boolean(bulkAssignProjectId);
            if (!canConfirm) return;
            e.preventDefault();
            void bulkAssign();
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setBulkAssignOpen(false);
                setBulkAssignNewName('');
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-neutral-900 text-center">Assign to project</h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Choose a project for {selectedList.length} conversations, or create a new one.
            </p>
            <div className="mt-4 space-y-3">
              <select
                value={bulkAssignProjectId}
                onChange={(e) => {
                  const v = e.target.value;
                  setBulkAssignProjectId(v);
                  if (v !== ASSIGN_NEW_PROJECT) setBulkAssignNewName('');
                }}
                autoFocus
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={ASSIGN_NEW_PROJECT}>New project…</option>
              </select>
              {bulkAssignProjectId === ASSIGN_NEW_PROJECT ? (
                <input
                  type="text"
                  value={bulkAssignNewName}
                  onChange={(e) => setBulkAssignNewName(e.target.value)}
                  placeholder="Project name"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-300 focus:outline-none"
                  aria-label="New project name"
                />
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkAssignOpen(false);
                  setBulkAssignNewName('');
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void bulkAssign()}
                disabled={
                  bulkBusy ||
                  (bulkAssignProjectId === ASSIGN_NEW_PROJECT
                    ? !bulkAssignNewName.trim()
                    : !bulkAssignProjectId)
                }
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkBusy ? 'Assigning…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {singleAssignOpen && singleAssignDebateId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (savingDebateId === singleAssignDebateId) return;
            const canConfirm =
              singleAssignProjectId === ASSIGN_NEW_PROJECT
                ? Boolean(singleAssignNewName.trim())
                : Boolean(singleAssignProjectId);
            if (!canConfirm) return;
            e.preventDefault();
            void confirmSingleAssign();
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setSingleAssignOpen(false);
                setSingleAssignNewName('');
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-neutral-900 text-center">Assign to project</h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Choose a project or create a new one for this conversation.
            </p>
            <div className="mt-4 space-y-3">
              <select
                value={singleAssignProjectId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSingleAssignProjectId(v);
                  if (v !== ASSIGN_NEW_PROJECT) setSingleAssignNewName('');
                }}
                autoFocus
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={ASSIGN_NEW_PROJECT}>New project…</option>
              </select>
              {singleAssignProjectId === ASSIGN_NEW_PROJECT ? (
                <input
                  type="text"
                  value={singleAssignNewName}
                  onChange={(e) => setSingleAssignNewName(e.target.value)}
                  placeholder="Project name"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-300 focus:outline-none"
                  aria-label="New project name"
                />
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSingleAssignOpen(false);
                  setSingleAssignNewName('');
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmSingleAssign()}
                disabled={
                  savingDebateId === singleAssignDebateId ||
                  (singleAssignProjectId === ASSIGN_NEW_PROJECT
                    ? !singleAssignNewName.trim()
                    : !singleAssignProjectId)
                }
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingDebateId === singleAssignDebateId ? 'Assigning…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
