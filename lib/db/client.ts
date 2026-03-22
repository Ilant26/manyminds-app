import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabase, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function createClient(): SupabaseClient {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

let serverClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (typeof window !== 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  if (!serverClient) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Supabase côté serveur : définis NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) et ' +
          'SUPABASE_SERVICE_ROLE_KEY dans .env.local. Référence : .env.local.example (section DATABASE).'
      );
    }
    serverClient = createSupabase(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}
