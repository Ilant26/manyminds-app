import { getSupabaseServer } from '@/lib/db/client';

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  color?: string;
  created_at?: string;
}

export async function getProjects(userId: string): Promise<Project[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('projects')
    .select('id, owner_id, name, description, color, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getProjects error:', error);
    return [];
  }
  return data ?? [];
}

export async function createProject(userId: string, name: string): Promise<Project | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('projects')
    .insert({ owner_id: userId, name })
    .select('id, owner_id, name, description, color, created_at')
    .single();

  if (error) {
    console.error('createProject error:', error);
    return null;
  }
  return data;
}

export async function renameProject(
  userId: string,
  projectId: string,
  name: string
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', projectId)
    .eq('owner_id', userId);

  if (error) console.error('renameProject error:', error);
}

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<void> {
  const supabase = getSupabaseServer();

  // Detach debates first
  await supabase
    .from('debates')
    .update({ project_id: null })
    .eq('project_id', projectId);

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('owner_id', userId);

  if (error) console.error('deleteProject error:', error);
}

export async function detachDebatesFromProject(
  userId: string,
  projectId: string,
  debateIds: string[]
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('debates')
    .update({ project_id: null })
    .in('id', debateIds)
    .eq('project_id', projectId);

  if (error) console.error('detachDebatesFromProject error:', error);
}
