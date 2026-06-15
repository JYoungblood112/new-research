import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, ProjectRow } from './database.types';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
  }

  return supabase;
}

export async function testSupabaseProjectsConnection() {
  if (!supabase) {
    return {
      ok: false,
      data: [] as ProjectRow[],
      error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.',
    };
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id,title,overview,status,created_at,updated_at')
    .limit(1);

  if (error) {
    return {
      ok: false,
      data: [] as ProjectRow[],
      error: error.message,
    };
  }

  return {
    ok: true,
    data: (data ?? []) as ProjectRow[],
    error: null,
  };
}
