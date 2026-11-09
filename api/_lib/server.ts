/**
 * Server-only helpers for the /api functions (Vercel Node runtime, Web Request/Response signature).
 * Files under api/_lib are not exposed as endpoints.
 * Uses the Supabase service-role key — never import this from src/.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Role = 'SALES' | 'SALES_SUPPORT' | 'MANAGEMENT';

export interface Caller {
  id: string;
  name: string;
  role: Role;
  email: string;
}

let cached: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Server belum dikonfigurasi: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

/** Wraps a handler so thrown HttpErrors become JSON `{ error }` responses. */
export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Terjadi kesalahan di server. Coba lagi beberapa saat.' }, 500);
    }
  };
}

/** Verifies the caller's Supabase access token and returns their active profile. */
export async function requireCaller(request: Request, roles?: Role[]): Promise<Caller> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sesi tidak ditemukan. Silakan masuk kembali.');
  const db = admin();
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) throw new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.');
  const { data: profile } = await db.from('profiles').select('id, name, role, email, status').eq('id', auth.user.id).maybeSingle();
  if (!profile || profile.status !== 'ACTIVE') throw new HttpError(403, 'Akun ini tidak aktif.');
  if (roles && !roles.includes(profile.role)) throw new HttpError(403, 'Anda tidak memiliki akses untuk tindakan ini.');
  return { id: profile.id, name: profile.name, role: profile.role, email: profile.email };
}

/** True when the Supabase backend is configured (otherwise the portal runs in local demo mode). */
export const supabaseConfigured = () =>
  Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Requires a signed-in user in Supabase mode; in demo mode (no Supabase) there are no server sessions to check. */
export async function requireCallerIfConfigured(request: Request, roles?: Role[]): Promise<Caller | null> {
  return supabaseConfigured() ? requireCaller(request, roles) : null;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Body permintaan harus berupa JSON.');
  }
}
