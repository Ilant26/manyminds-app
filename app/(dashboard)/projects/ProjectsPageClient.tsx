'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Search, Trash2, MoveRight, Plus, MoreHorizontal, X } from 'lucide-react';
import { useQuota } from '@/hooks/useQuota';
import { useAuth } from '@clerk/nextjs';
import { FreeAccountModal } from '@/components/shared/FreeAccountModal';
import { HydrationSafeDate } from '@/components/shared/HydrationSafeDate';
import { toast } from 'sonner';
import type { Debate } from '@/types';
import { conversationListLabel, conversationTurnCount } from '@/lib/conversation-title';
import type { ProjectListItem as Project, ProjectsPageClientProps } from './projects-page-types';

type LocalDebate = Pick<
  Debate,
  'id' | 'question' | 'created_at' | 'project_id' | 'updated_at'
> & {
  title?: string;
  conversation_turns?: Debate['conversation_turns'];
};

function toLocalDebate(d: Debate): LocalDebate {
  return {
    id: d.id,
    question: d.question,
    created_at: d.created_at,
    ...(d.title ? { title: d.title } : {}),
    ...(d.updated_at ? { updated_at: d.updated_at } : {}),
    project_id: d.project_id,
    ...(d.conversation_turns?.length ? { conversation_turns: d.conversation_turns } : {}),
  };
}

const DEMO_PROJECTS: Project[] = [
  { id: 'demo_1', name: 'Product decisions', created_at: new Date().toISOString() },
  { id: 'demo_2', name: 'Go-to-market', created_at: new Date().toISOString() },
  { id: 'demo_3', name: 'Hiring', created_at: new Date().toISOString() },
];

const ANON_HISTORY_KEY = 'mm_anonymous_history';

/** Sentinel `<select>` value: create a project and assign the conversation there. */
const MOVE_TO_NEW_PROJECT = '__mm_new_project__';

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function ProjectsPageClient({
  serverSignedIn,
  serverProjectsPrefetched,
  initialProjects,
}: ProjectsPageClientProps) {
  const { isAnonymous } = useQuota();
  const { isLoaded: clerkLoaded, userId } = useAuth();

  const [projects, setProjects] = useState<Project[]>(() =>
    serverSignedIn && serverProjectsPrefetched ? initialProjects : []
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (serverSignedIn && serverProjectsPrefetched && initialProjects.length > 0) {
      return initialProjects[0].id;
    }
    return null;
  });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(() => {
    if (!serverSignedIn) return true;
    return !serverProjectsPrefetched;
  });

  const [showFreeAccount, setShowFreeAccount] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteProjectBusy, setDeleteProjectBusy] = useState(false);

  const [projectDebates, setProjectDebates] = useState<LocalDebate[]>([]);
  const [debatesLoading, setDebatesLoading] = useState(false);

  // Import modal from global History
  const [importOpen, setImportOpen] = useState(false);
  const [history, setHistory] = useState<Debate[]>([]);
  const [selectedDebates, setSelectedDebates] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Move / detach controls
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [moveNewProjectName, setMoveNewProjectName] = useState<Record<string, string>>({});
  const [busyDebateId, setBusyDebateId] = useState<string | null>(null);
  const [matchProjectIds, setMatchProjectIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Tick several chats, then remove them from this project (they stay in History)
  const [convSelectMode, setConvSelectMode] = useState(false);
  const [convSelectedIds, setConvSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkRemoveIds, setBulkRemoveIds] = useState<string[]>([]);
  const [bulkRemoveBusy, setBulkRemoveBusy] = useState(false);

  const importModalRef = useRef<HTMLDivElement | null>(null);
  /** Whole project detail column: clicks outside it exit conversation select mode */
  const projectDetailPaneRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  const convSelectedList = useMemo(
    () => Object.entries(convSelectedIds).filter(([, v]) => v).map(([id]) => id),
    [convSelectedIds]
  );
  const convAllIds = useMemo(() => projectDebates.map((d) => d.id), [projectDebates]);
  const convIsAllSelected = useMemo(
    () => convAllIds.length > 0 && convAllIds.every((id) => Boolean(convSelectedIds[id])),
    [convAllIds, convSelectedIds]
  );

  function toggleConvSelected(id: string) {
    setConvSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  }

  function clearConvSelection() {
    setConvSelectedIds({});
  }

  function selectAllConversations() {
    setConvSelectedIds((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const id of convAllIds) next[id] = true;
      return next;
    });
  }

  function clearAllConversationSelection() {
    setConvSelectedIds({});
  }

  useEffect(() => {
    setConvSelectMode(false);
    setConvSelectedIds({});
  }, [selectedId]);

  /** Exit conv select mode on click unless target is Select toggle, a <select>, or bulk/list UI */
  useEffect(() => {
    if (!convSelectMode) return;

    function onMouseDown(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      const node = t instanceof Text ? t.parentElement : t;
      if (!node || !(node instanceof Element)) return;

      if (node.closest('[data-conv-select-toggle]')) return;
      if (node.closest('select')) return;
      if (node.closest('[data-conv-select-allow]')) return;

      setConvSelectMode(false);
      setConvSelectedIds({});
    }

    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [convSelectMode]);

  // Search should match project names AND conversation questions (like History search).
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setMatchProjectIds(new Set());
      return;
    }

    const t = setTimeout(() => {
      if (isAnonymous) {
        const raw = window.localStorage.getItem(ANON_HISTORY_KEY);
        const list = safeParseJson<LocalDebate[]>(raw) ?? [];
        const ids = new Set<string>();
        for (const d of list) {
          if (!d.project_id) continue;
          if ((d.question ?? '').toLowerCase().includes(q)) ids.add(d.project_id);
        }
        setMatchProjectIds(ids);
        return;
      }

      (async () => {
        try {
          const res = await fetch(`/api/debates?limit=50&search=${encodeURIComponent(q)}`);
          if (!res.ok) {
            setMatchProjectIds(new Set());
            return;
          }
          const data = (await res.json()) as { debates?: Array<{ project_id?: string | null }> };
          const ids = new Set<string>();
          for (const d of data.debates ?? []) {
            if (d.project_id) ids.add(d.project_id);
          }
          setMatchProjectIds(ids);
        } catch {
          setMatchProjectIds(new Set());
        }
      })();
    }, 250);

    return () => clearTimeout(t);
  }, [isAnonymous, query]);

  useEffect(() => {
    if (!importOpen) return;
    // Rendre la modale focus pour capter Enter.
    importModalRef.current?.focus?.();
  }, [importOpen]);

  useEffect(() => {
    if (!importOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (importing) return;
      if (Object.values(selectedDebates).every((v) => !v)) return;

      // On évite tout comportement natif (submit, etc.)
      e.preventDefault();
      e.stopPropagation();

      void doImport();
      setImportOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [importOpen, importing, selectedDebates]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      !q
        ? projects
        : projects.filter((p) => {
            if (p.name.toLowerCase().includes(q)) return true;
            return matchProjectIds.has(p.id);
          });
    return [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [matchProjectIds, projects, query]);

  /** Newest activity first (import / edit / new message via updated_at, else created_at) */
  const sortedProjectDebates = useMemo(() => {
    return [...projectDebates].sort((a, b) => {
      const ta = new Date(a.updated_at ?? a.created_at).getTime();
      const tb = new Date(b.updated_at ?? b.created_at).getTime();
      return tb - ta;
    });
  }, [projectDebates]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!serverSignedIn) {
      setProjects(DEMO_PROJECTS);
      setSelectedId(DEMO_PROJECTS[0]?.id ?? null);
      setLoading(false);
      return;
    }

    if (serverProjectsPrefetched) {
      setLoading(false);
      return;
    }

    const signedCacheKey = userId ? `mm_projects_signed_cache_v1_${userId}` : null;
    const deviceCacheKey = `mm_projects_device_cache_v1`;
    let cacheApplied = false;

    const tryApply = (key: string | null) => {
      if (!key) return;
      const raw = window.localStorage.getItem(key);
      const parsed = safeParseJson<{ ts?: number; projects?: Project[] }>(raw);
      if (parsed && Array.isArray(parsed.projects)) {
        setProjects(parsed.projects);
        setSelectedId(parsed.projects[0]?.id ?? null);
        setLoading(false);
        cacheApplied = true;
      }
    };

    if (clerkLoaded && signedCacheKey) tryApply(signedCacheKey);
    if (!cacheApplied) tryApply(deviceCacheKey);
  }, [serverSignedIn, serverProjectsPrefetched, clerkLoaded, userId]);

  useEffect(() => {
    if (!serverSignedIn) return;
    if (!clerkLoaded) return;
    if (isAnonymous) return;

    const signedCacheKey = userId ? `mm_projects_signed_cache_v1_${userId}` : null;

    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { projects: Project[] }) => {
        const list = data.projects ?? [];
        setProjects(list);
        setSelectedId(list[0]?.id ?? null);

        // Cache signed-in + cache device (pour éviter les temps d'attente Clerk)
        try {
          window.localStorage.setItem(
            `mm_projects_device_cache_v1`,
            JSON.stringify({
              ts: Date.now(),
              projects: list,
            })
          );
        } catch {
          // ignore cache failures
        }
        if (userId && signedCacheKey) {
          try {
            window.localStorage.setItem(
              signedCacheKey,
              JSON.stringify({
                ts: Date.now(),
                projects: list,
              })
            );
          } catch {
            // ignore cache failures
          }
        }
      })
      .finally(() => setLoading(false));
  }, [isAnonymous, clerkLoaded, userId]);

  useEffect(() => {
    if (!selectedId) {
      setProjectDebates([]);
      return;
    }

    async function loadDebates() {
      try {
        if (isAnonymous) {
          const raw = window.localStorage.getItem(ANON_HISTORY_KEY);
          const list = safeParseJson<LocalDebate[]>(raw) ?? [];
          const filtered = list.filter((d) => (d.project_id ?? null) === selectedId);
          setProjectDebates(filtered);
          return;
        }

        const signedDebatesCacheKey =
          userId && selectedId
            ? `mm_project_debates_signed_cache_v1_${userId}_${selectedId}`
            : null;
        const deviceDebatesCacheKey = `mm_project_debates_device_cache_v1_${selectedId}`;
        let cacheApplied = false;

        const tryApplyDebates = (key: string | null) => {
          if (!key) return false;
          const raw = window.localStorage.getItem(key);
          const parsed = safeParseJson<{ ts?: number; debates?: LocalDebate[] }>(raw);
          if (parsed && Array.isArray(parsed.debates)) {
            setProjectDebates(parsed.debates);
            setDebatesLoading(false);
            cacheApplied = true;
            return true;
          }
          return false;
        };

        if (clerkLoaded && signedDebatesCacheKey) {
          tryApplyDebates(signedDebatesCacheKey);
        }
        if (!cacheApplied) tryApplyDebates(deviceDebatesCacheKey);
        if (cacheApplied) return;

        setDebatesLoading(true);
        const res = await fetch(
          `/api/debates?limit=30&project_id=${encodeURIComponent(selectedId ?? '')}`
        );
        if (!res.ok) throw new Error('Unable to load project debates');
        const data = (await res.json()) as { debates: Debate[]; total: number };

        const mapped: LocalDebate[] = (data.debates ?? []).map((d) => ({
          id: d.id,
          question: d.question,
          created_at: d.created_at,
          ...(d.updated_at ? { updated_at: d.updated_at } : {}),
          project_id: d.project_id,
        }));
        setProjectDebates(mapped);

        // Cache signed-in + cache device
        try {
          window.localStorage.setItem(
            deviceDebatesCacheKey,
            JSON.stringify({
              ts: Date.now(),
              debates: mapped,
            })
          );
        } catch {
          // ignore cache failures
        }
        if (userId && signedDebatesCacheKey) {
          try {
            window.localStorage.setItem(
              signedDebatesCacheKey,
              JSON.stringify({
                ts: Date.now(),
                debates: mapped,
              })
            );
          } catch {
            // ignore cache failures
          }
        }
      } catch {
        setProjectDebates([]);
      } finally {
        setDebatesLoading(false);
      }
    }

    loadDebates();
  }, [isAnonymous, selectedId, clerkLoaded, userId]);

  async function createProjectFromQuery(name?: string): Promise<boolean> {
    const n = (name ?? query).trim();
    if (!n) return false;
    if (isAnonymous) {
      setShowFreeAccount(true);
      setCreateProjectError('Create a free account to create projects.');
      return false;
    }

    const existing = projects.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (existing) {
      setSelectedId(existing.id);
      return true;
    }

    setCreatingProject(true);
    setCreateProjectError(null);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: n }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        setShowFreeAccount(true);
        setCreateProjectError('Sign in to create a project.');
      } else if (res.status === 403 || res.status === 429) {
      } else {
        setCreateProjectError('Unable to create project right now. Please try again.');
      }
      setCreatingProject(false);
      return false;
    }

    const data = (await res.json()) as { project: Project };
    setProjects((p) => [data.project, ...p]);
    setSelectedId(data.project.id);
    setCreatingProject(false);
    return true;
  }

  function openCreateProjectModal() {
    setNewProjectName(query.trim());
    setCreateProjectError(null);
    setShowCreateModal(true);
  }

  async function openImport() {
    if (isAnonymous || !selected) return;
    setImportError(null);
    setImportOpen(true);
    const res = await fetch('/api/debates?limit=50');
    if (!res.ok) {
      setImportError('Unable to load history.');
      return;
    }
    const data = (await res.json()) as { debates: Debate[]; total: number };
    const list = data.debates ?? [];
    setHistory(
      [...list].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
      )
    );
    setSelectedDebates({});
  }

  async function doImport() {
    if (!selected) return;
    const ids = Object.entries(selectedDebates)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (!ids.length) return;

    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(selected.id)}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_ids: ids }),
      });
      if (!res.ok) {
        setImportError('Import failed.');
        return;
      }
      setImportOpen(false);
    } finally {
      setImporting(false);
    }

    // Refresh debates list after import
    if (!isAnonymous) {
      const res = await fetch(`/api/debates?limit=50&project_id=${encodeURIComponent(selected.id)}`);
      if (res.ok) {
        const data = (await res.json()) as { debates: Debate[] };
        setProjectDebates((data.debates ?? []).map(toLocalDebate));
      }
    }
  }

  async function moveDebate(debateId: string, destinationProjectId: string): Promise<boolean> {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return false;
    }
    if (!destinationProjectId) return false;

    setBusyDebateId(debateId);
    try {
      const importRes = await fetch(`/api/projects/${encodeURIComponent(destinationProjectId)}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_ids: [debateId] }),
      });
      if (!importRes.ok) {
        toast.error('Unable to move this conversation.');
        return false;
      }

      // refresh
      const res = await fetch(`/api/debates?limit=50&project_id=${encodeURIComponent(selectedId ?? '')}`);
      if (res.ok) {
        const data = (await res.json()) as { debates: Debate[] };
        setProjectDebates((data.debates ?? []).map(toLocalDebate));
      }
      return true;
    } finally {
      setBusyDebateId(null);
    }
  }

  /** Resolves move target: existing project id or “New project” + name. */
  async function resolveMoveDestination(selectProjectId: string, newName: string): Promise<string | null> {
    if (selectProjectId === MOVE_TO_NEW_PROJECT) {
      const trimmed = newName.trim();
      if (!trimmed) return null;
      if (isAnonymous) {
        setShowFreeAccount(true);
        return null;
      }
      const existing = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        if (res.status === 401) setShowFreeAccount(true);
        else toast.error('Unable to create project.');
        return null;
      }
      const data = (await res.json()) as { project: Project };
      setProjects((prev) => [data.project, ...prev]);
      return data.project.id;
    }
    if (selectProjectId) return selectProjectId;
    return null;
  }

  async function detachFromProject(debateId: string) {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }
    if (!selectedId) return;

    setBusyDebateId(debateId);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(selectedId)}/detach`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debate_ids: [debateId] }),
      });
      if (!res.ok) return;

      const res2 = await fetch(`/api/debates?limit=50&project_id=${encodeURIComponent(selectedId)}`);
      if (res2.ok) {
        const data = (await res2.json()) as { debates: Debate[] };
        setProjectDebates((data.debates ?? []).map(toLocalDebate));
      }
    } finally {
      setBusyDebateId(null);
    }
  }

  async function deleteProject(projectId: string) {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }
    setDeleteProjectId(projectId);
    setDeleteProjectOpen(true);
  }

  async function confirmDeleteProject() {
    if (deleteProjectBusy) return;
    if (!deleteProjectId) return;

    setDeleteProjectBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(deleteProjectId)}`, { method: 'DELETE' });
      if (res.status === 401) {
        setShowFreeAccount(true);
        return;
      }
      if (!res.ok) return;

      const projectId = deleteProjectId;
      setProjects((prev) => {
        const remaining = prev.filter((x) => x.id !== projectId);
        setSelectedId((prevSelected) => {
          if (prevSelected !== projectId) return prevSelected;
          return remaining[0]?.id ?? null;
        });
        return remaining;
      });
    } finally {
      setDeleteProjectBusy(false);
      setDeleteProjectOpen(false);
      setDeleteProjectId(null);
    }
  }

  function openBulkRemoveFromProjectModal() {
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }
    if (!selectedId || convSelectedList.length === 0) return;
    setBulkRemoveIds(convSelectedList);
    setBulkRemoveOpen(true);
  }

  async function confirmBulkRemoveFromProject() {
    if (bulkRemoveBusy) return;
    if (!selectedId || bulkRemoveIds.length === 0) return;
    if (isAnonymous) {
      setShowFreeAccount(true);
      return;
    }

    setBulkRemoveBusy(true);
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < bulkRemoveIds.length; i += 50) {
        chunks.push(bulkRemoveIds.slice(i, i + 50));
      }
      for (const ids of chunks) {
        const res = await fetch(`/api/projects/${encodeURIComponent(selectedId)}/detach`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ debate_ids: ids }),
        });
        if (res.status === 401) {
          setShowFreeAccount(true);
          return;
        }
        if (!res.ok) {
          toast.error('Could not remove conversations from this project.');
          return;
        }
      }

      const removed = new Set(bulkRemoveIds);
      const removedCount = bulkRemoveIds.length;
      setProjectDebates((prev) => prev.filter((d) => !removed.has(d.id)));
      setMenuOpenId(null);

      if (selectedId && userId) {
        try {
          window.localStorage.removeItem(`mm_project_debates_device_cache_v1_${selectedId}`);
          window.localStorage.removeItem(`mm_project_debates_signed_cache_v1_${userId}_${selectedId}`);
        } catch {
          // ignore
        }
      }

      clearConvSelection();
      setConvSelectMode(false);
      setBulkRemoveOpen(false);
      setBulkRemoveIds([]);
      toast.success(
        removedCount > 1
          ? `${removedCount} conversations removed from project`
          : 'Conversation removed from project'
      );
    } finally {
      setBulkRemoveBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="mb-6 flex w-full min-w-0 shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-3xl font-bold text-neutral-900">Projects</h1>
        <button
          type="button"
          onClick={() => openCreateProjectModal()}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Create project
        </button>
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="relative grid h-full gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="pointer-events-none absolute inset-y-0 left-[360px] hidden w-px bg-neutral-200 lg:block" />
          {/* Left: search + project list */}
          <div className="min-h-0 border-b border-neutral-200 bg-neutral-50/40 p-4 lg:border-b-0 flex flex-col">
            <div className="pt-0 shrink-0">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects or keywords…"
              className="peer w-full rounded-2xl border-2 border-neutral-300 bg-white py-2.5 pl-11 pr-3 text-sm font-medium text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 placeholder:font-normal placeholder:text-neutral-400 hover:border-neutral-500 hover:shadow-md focus:border-violet-600 focus:outline-none focus:shadow-[0_0_0_4px_rgba(124,58,237,0.18),0_2px_8px_-2px_rgba(15,23,42,0.12)] focus:ring-0"
            />
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-neutral-500 transition-colors peer-focus:text-violet-600" />
          </div>
            </div>

          <div className="scrollbar-subtle mt-4 min-h-0 flex-1 overflow-y-auto space-y-1 pr-4">
            {loading && projects.length === 0 ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : filteredProjects.length === 0 ? (
              <p className="text-sm text-neutral-500">No projects found.</p>
            ) : (
              filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedId === p.id
                      ? 'border-violet-300 bg-violet-50 text-violet-900'
                      : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-base font-bold text-neutral-900">
                    {p.name}
                  </span>
                </button>
              ))
            )}
          </div>
          </div>

          {/* Right: project content */}
          <div className="min-h-0 flex flex-col overflow-hidden p-6">
          <div className="flex w-full min-w-0 shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold text-neutral-900">
                {selected ? selected.name : 'Select a project'}
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {selected ? 'Everything in one place: create chats, import, and organize.' : 'Pick a project from the list.'}
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:pt-0.5">
              <Link
                href={selected ? `/chat?projectId=${encodeURIComponent(selected.id)}` : '/chat'}
                onClick={(e) => {
                  if (isAnonymous) {
                    e.preventDefault();
                    setShowFreeAccount(true);
                  }
                  if (!selected) {
                    e.preventDefault();
                  }
                }}
                aria-disabled={!selected}
                className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  selected
                    ? 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'
                    : 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
                }`}
              >
                New chat
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (isAnonymous) {
                    setShowFreeAccount(true);
                    return;
                  }
                  openImport();
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                title="Import from History"
                disabled={!selected}
              >
                Import
              </button>
              {selected && !debatesLoading && projectDebates.length > 0 ? (
                <button
                  type="button"
                  data-conv-select-toggle
                  onClick={() => {
                    if (convSelectMode) {
                      setConvSelectMode(false);
                      clearConvSelection();
                    } else {
                      setConvSelectMode(true);
                    }
                  }}
                  aria-pressed={convSelectMode}
                  className={
                    convSelectMode
                      ? 'rounded-xl border-2 border-neutral-900 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50'
                      : 'rounded-xl bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800'
                  }
                >
                  Select
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!selected) return;
                  void deleteProject(selected.id);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                disabled={!selected}
                title="Delete project"
              >
                Delete project
              </button>
            </div>
          </div>

          <div className="scrollbar-subtle mt-6 min-h-0 flex-1 overflow-y-auto pr-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-neutral-900">Conversations</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-neutral-900">
                  {debatesLoading ? 'Loading…' : projectDebates.length}
                </span>
              </div>
            </div>

            {convSelectMode && projectDebates.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-neutral-800">
                    {convSelectedList.length} selected — remove them from &ldquo;{selected?.name}&rdquo;
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        convIsAllSelected ? clearAllConversationSelection() : selectAllConversations()
                      }
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      {convIsAllSelected ? 'Clear ticks' : 'Select all'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openBulkRemoveFromProjectModal()}
                      disabled={bulkRemoveBusy || convSelectedList.length === 0}
                      className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove from project
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {debatesLoading ? (
              <p className="mt-3 text-sm text-neutral-500">Loading…</p>
            ) : projectDebates.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
                <p className="text-sm font-medium text-neutral-900">No conversations yet</p>
                <p className="mt-1 text-sm text-neutral-600">Create a new chat or import from History.</p>
              </div>
            ) : (
              <ul
                className="mt-3 space-y-2"
                {...(convSelectMode ? { 'data-conv-select-allow': '' } : {})}
              >
                {sortedProjectDebates.map((d) => {
                  const open = menuOpenId === d.id;
                  const options = projects.filter((p) => p.id !== selectedId);
                  return (
                    <li key={d.id} className="relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {convSelectMode ? (
                            <div className="flex shrink-0 items-start pt-0.5">
                              <input
                                type="checkbox"
                                checked={Boolean(convSelectedIds[d.id])}
                                onChange={() => toggleConvSelected(d.id)}
                                className="mt-1 h-4 w-4 rounded-md border-2 border-neutral-900 accent-neutral-900 focus:outline-none focus:ring-0 focus:ring-offset-0"
                                aria-label="Select conversation"
                              />
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            {convSelectMode ? (
                              <button
                                type="button"
                                onClick={() => toggleConvSelected(d.id)}
                                className="block w-full text-left"
                              >
                                <span className="block truncate font-semibold text-neutral-900">
                                  {conversationListLabel(d)}
                                </span>
                                {conversationTurnCount(d) > 1 ? (
                                  <span className="mt-0.5 block text-xs text-neutral-400">
                                    {conversationTurnCount(d)} échanges · une conversation
                                  </span>
                                ) : null}
                                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  <HydrationSafeDate iso={d.updated_at ?? d.created_at} />
                                </div>
                              </button>
                            ) : (
                              <>
                                <Link
                                  href={
                                    selectedId
                                      ? `/chat?debateId=${encodeURIComponent(d.id)}&projectId=${encodeURIComponent(selectedId)}`
                                      : `/chat?debateId=${encodeURIComponent(d.id)}`
                                  }
                                  className="block truncate font-semibold text-neutral-900 hover:underline"
                                >
                                  {conversationListLabel(d)}
                                </Link>
                                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  <HydrationSafeDate iso={d.updated_at ?? d.created_at} />
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {!convSelectMode ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (isAnonymous) {
                                setShowFreeAccount(true);
                                return;
                              }
                              setMenuOpenId((v) => (v === d.id ? null : d.id));
                            }}
                            className="rounded-xl border border-neutral-200 bg-white p-2 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                            aria-label="More actions"
                            title="More actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      {open && !convSelectMode ? (
                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-neutral-700">Actions</div>
                            <button
                              type="button"
                              onClick={() => setMenuOpenId(null)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                              aria-label="Close actions"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-start">
                            <div className="min-w-0 space-y-2">
                              <select
                                value={moveTo[d.id] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMoveTo((s) => ({ ...s, [d.id]: v }));
                                  if (v !== MOVE_TO_NEW_PROJECT) {
                                    setMoveNewProjectName((s) => ({ ...s, [d.id]: '' }));
                                  }
                                }}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
                                aria-label="Move to project"
                              >
                                <option value="">Move to…</option>
                                {options.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                                <option value={MOVE_TO_NEW_PROJECT}>New project…</option>
                              </select>
                              {moveTo[d.id] === MOVE_TO_NEW_PROJECT ? (
                                <input
                                  type="text"
                                  value={moveNewProjectName[d.id] ?? ''}
                                  onChange={(e) =>
                                    setMoveNewProjectName((s) => ({ ...s, [d.id]: e.target.value }))
                                  }
                                  placeholder="Project name"
                                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-300 focus:outline-none"
                                  aria-label="New project name"
                                />
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  const choice = moveTo[d.id] ?? '';
                                  const destId = await resolveMoveDestination(
                                    choice,
                                    moveNewProjectName[d.id] ?? ''
                                  );
                                  if (!destId) return;
                                  const ok = await moveDebate(d.id, destId);
                                  if (!ok) return;
                                  setMoveTo((s) => {
                                    const next = { ...s };
                                    delete next[d.id];
                                    return next;
                                  });
                                  setMoveNewProjectName((s) => {
                                    const next = { ...s };
                                    delete next[d.id];
                                    return next;
                                  });
                                  setMenuOpenId(null);
                                })();
                              }}
                              disabled={
                                busyDebateId === d.id ||
                                (!(moveTo[d.id] ?? '') ||
                                  (moveTo[d.id] === MOVE_TO_NEW_PROJECT &&
                                    !(moveNewProjectName[d.id] ?? '').trim()))
                              }
                              className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Move"
                            >
                              <MoveRight className="mr-2 h-4 w-4" />
                              Move
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void detachFromProject(d.id);
                                setMenuOpenId(null);
                              }}
                              disabled={busyDebateId === d.id}
                              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-neutral-200 disabled:hover:bg-white disabled:hover:text-neutral-900"
                              title="Remove from project"
                            >
                              <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </div>
        </div>
      </section>

      {importOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          ref={importModalRef}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (importing) return;
            const target = e.target as HTMLElement | null;
            if (Object.values(selectedDebates).every((v) => !v)) return;
            e.preventDefault();
            e.stopPropagation();
            void doImport();
            setImportOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-10 text-center text-lg font-semibold text-neutral-900">Import from History</h3>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Select conversations to add to “{selected?.name}”.
            </p>

            {importError ? (
              <p className="mt-3 text-center text-sm text-red-700">{importError}</p>
            ) : null}

            <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-neutral-200">
              {history.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500">No conversations found.</div>
              ) : (
                <ul className="divide-y divide-neutral-200">
                  {history.map((d) => (
                    <li key={d.id} className="flex items-start gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedDebates[d.id])}
                        onChange={(e) => setSelectedDebates((s) => ({ ...s, [d.id]: e.target.checked }))}
                        className="mt-1 h-4 w-4 rounded-md border-2 border-neutral-900 accent-neutral-900 focus:outline-none focus:ring-0 focus:ring-offset-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {conversationListLabel(d)}
                        </p>
                        {conversationTurnCount(d) > 1 ? (
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {conversationTurnCount(d)} échanges · une conversation
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-neutral-500">
                          <HydrationSafeDate iso={d.updated_at ?? d.created_at} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doImport}
                disabled={importing || Object.values(selectedDebates).every((v) => !v)}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? 'Importing…' : 'Import selected'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (creatingProject) return;
            // Si le focus est déjà sur l'input, le handler de l'input gère déjà Enter.
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
            e.preventDefault();
            const name = newProjectName.trim();
            if (!name) return;
            void (async () => {
              const ok = await createProjectFromQuery(name);
              if (!ok) return;
              setShowCreateModal(false);
              setNewProjectName('');
            })();
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setNewProjectName('');
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-neutral-900 text-center">Create project</h2>
            <p className="mt-2 text-sm text-neutral-600 text-center">
              Give your project a name to organize your conversations.
            </p>

            <div className="mt-4">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-300 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const name = newProjectName.trim();
                    if (!name) return;
                    void (async () => {
                      const ok = await createProjectFromQuery(name);
                      if (!ok) return;
                      setShowCreateModal(false);
                      setNewProjectName('');
                    })();
                  }
                }}
              />
            </div>
            {createProjectError ? (
              <p className="mt-3 text-center text-sm font-medium text-red-700">{createProjectError}</p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = newProjectName.trim();
                  if (!name) return;
                  void (async () => {
                    const ok = await createProjectFromQuery(name);
                    if (!ok) return;
                    setShowCreateModal(false);
                    setNewProjectName('');
                  })();
                }}
                disabled={!newProjectName.trim() || creatingProject}
                className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingProject ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkRemoveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setBulkRemoveOpen(false);
                setBulkRemoveIds([]);
                setBulkRemoveBusy(false);
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-neutral-900 text-center">
              {bulkRemoveIds.length > 1
                ? `Remove ${bulkRemoveIds.length} conversations from this project?`
                : 'Remove this conversation from the project?'}
            </h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              They are <span className="font-semibold text-neutral-800">not deleted</span>. You can still open
              them from <span className="font-semibold text-neutral-800">History</span>; they just won&apos;t
              appear in this project anymore.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkRemoveOpen(false);
                  setBulkRemoveIds([]);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                disabled={bulkRemoveBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmBulkRemoveFromProject()}
                disabled={bulkRemoveBusy}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkRemoveBusy ? 'Removing…' : 'Remove from project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteProjectOpen && deleteProjectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setDeleteProjectOpen(false);
                setDeleteProjectId(null);
                setDeleteProjectBusy(false);
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-neutral-900 text-center">
              Delete this project?
            </h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              This will detach conversations from it.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteProjectOpen(false);
                  setDeleteProjectId(null);
                  setDeleteProjectBusy(false);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                disabled={deleteProjectBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteProject()}
                disabled={deleteProjectBusy}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteProjectBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <FreeAccountModal open={showFreeAccount} onClose={() => setShowFreeAccount(false)} />
    </div>
  );
}

