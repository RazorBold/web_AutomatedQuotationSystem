/**
 * POST /api/users — Management only.
 *   { action: 'create', user: { name, email, phone, title, role, status, password } }
 *   { action: 'update', id, patch: { name?, email?, phone?, title?, role?, status?, password? } }
 * Creating accounts and changing email/password need the Supabase Auth admin API (service role),
 * which is why this lives on the server instead of in an RPC.
 */
import { admin, handle, HttpError, json, readJson, requireCaller, type Role } from './_lib/server.js';

const ROLES: Role[] = ['SALES', 'SALES_SUPPORT', 'MANAGEMENT'];
const BAN_FOREVER = '876000h'; // ~100 years; Supabase's way to block sign-in

interface UserFields {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  role?: Role;
  status?: 'ACTIVE' | 'INACTIVE';
  password?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

function validate(f: UserFields, creating: boolean) {
  if (creating || f.name !== undefined) if (!f.name?.trim()) throw new HttpError(422, 'Isi nama lengkap.');
  if (creating || f.email !== undefined) if (!/^\S+@\S+\.\S+$/.test(f.email ?? '')) throw new HttpError(422, 'Isi email kantor yang valid.');
  if (f.role !== undefined && !ROLES.includes(f.role)) throw new HttpError(422, 'Role tidak valid.');
  if (f.status !== undefined && f.status !== 'ACTIVE' && f.status !== 'INACTIVE') throw new HttpError(422, 'Status tidak valid.');
  if (creating || f.password) if ((f.password ?? '').length < 8) throw new HttpError(422, 'Kata sandi minimal 8 karakter.');
}

async function emailTaken(email: string, exceptId?: string) {
  const { data } = await admin().from('profiles').select('id').ilike('email', email.trim()).limit(2);
  return (data ?? []).some(r => r.id !== exceptId);
}

export const POST = handle(async request => {
  const caller = await requireCaller(request, ['MANAGEMENT']);
  const body = await readJson<{ action?: string; user?: UserFields; id?: string; patch?: UserFields }>(request);
  const db = admin();

  if (body.action === 'create') {
    const u = body.user ?? {};
    validate(u, true);
    const email = u.email!.trim().toLowerCase();
    if (await emailTaken(email)) throw new HttpError(409, 'Email ini sudah dipakai akun lain.');

    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: u.password!,
      email_confirm: true,
      user_metadata: { name: u.name },
      ...(u.status === 'INACTIVE' ? { ban_duration: BAN_FOREVER } : {}),
    });
    if (error || !created.user) throw new HttpError(400, error?.message ?? 'Akun gagal dibuat.');

    const { error: profileError } = await db.from('profiles').insert({
      id: created.user.id,
      name: u.name!.trim(),
      email,
      phone: u.phone?.trim() ?? '',
      title: u.title?.trim() ?? '',
      role: u.role ?? 'SALES',
      status: u.status ?? 'ACTIVE',
      avatar: initials(u.name!),
    });
    if (profileError) {
      await db.auth.admin.deleteUser(created.user.id);
      throw new HttpError(400, profileError.message);
    }
    return json({ ok: true, id: created.user.id });
  }

  if (body.action === 'update') {
    const id = body.id;
    const p = body.patch ?? {};
    if (!id) throw new HttpError(400, 'id wajib diisi.');
    validate(p, false);
    if (id === caller.id && (p.status === 'INACTIVE' || (p.role && p.role !== caller.role))) {
      throw new HttpError(422, 'Anda tidak bisa menonaktifkan atau mengubah role akun Anda sendiri.');
    }
    const email = p.email?.trim().toLowerCase();
    if (email && (await emailTaken(email, id))) throw new HttpError(409, 'Email ini sudah dipakai akun lain.');

    const authPatch: Record<string, unknown> = {};
    if (email) authPatch.email = email;
    if (p.password) authPatch.password = p.password;
    if (p.status) authPatch.ban_duration = p.status === 'INACTIVE' ? BAN_FOREVER : 'none';
    if (Object.keys(authPatch).length) {
      const { error } = await db.auth.admin.updateUserById(id, { ...authPatch, ...(email ? { email_confirm: true } : {}) });
      if (error) throw new HttpError(400, error.message);
    }

    const profilePatch: Record<string, unknown> = {};
    if (p.name !== undefined) {
      profilePatch.name = p.name.trim();
      profilePatch.avatar = initials(p.name);
    }
    if (email) profilePatch.email = email;
    if (p.phone !== undefined) profilePatch.phone = p.phone.trim();
    if (p.title !== undefined) profilePatch.title = p.title.trim();
    if (p.role !== undefined) profilePatch.role = p.role;
    if (p.status !== undefined) profilePatch.status = p.status;
    if (Object.keys(profilePatch).length) {
      const { error } = await db.from('profiles').update(profilePatch).eq('id', id);
      if (error) throw new HttpError(400, error.message);
    }
    return json({ ok: true });
  }

  throw new HttpError(400, 'action harus "create" atau "update".');
});
