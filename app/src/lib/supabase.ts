import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client && supabaseUrl && supabaseKey) {
    client = createClient(supabaseUrl, supabaseKey);
  }
  return client;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}