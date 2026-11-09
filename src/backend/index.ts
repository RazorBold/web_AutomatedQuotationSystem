import { createClient } from '@supabase/supabase-js';
import { createLocalBackend } from './local';
import { createSupabaseBackend } from './supabase';
import type { Backend } from './types';

export type * from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, otherwise the localStorage demo.
 * Created once per page load.
 */
export const backend: Backend =
  url && anonKey
    ? createSupabaseBackend(createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }))
    : createLocalBackend();
