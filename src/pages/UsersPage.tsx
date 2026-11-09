import React, { useState } from 'react';
import { Check, KeyRound, Minus, Search, UserPlus, UserX } from 'lucide-react';
import { errorMessage, useStore } from '../store/AppStore';
import { PERMISSION_LABELS, Permission, ROLE_META, ROLE_PERMISSIONS } from '../auth/permissions';
import type { UserProfile, UserRole } from '../types';
import { Avatar, Badge, Button, Dialog, Drawer, EmptyState, Field, Input, PageHeader, Panel, Segmented, Select, cx } from '../components/ui';

const ROLES = Object.keys(ROLE_META) as UserRole[];

type FormState = Pick<UserProfile, 'name' | 'email' | 'phone' | 'title' | 'role' | 'status'> & { password: string };
const EMPTY: FormState = { name: '', email: '', phone: '', title: '', role: 'SALES', status: 'ACTIVE', password: '' };

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return 'agt-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function UserDrawer({ user, open, onClose }: { user: UserProfile | null; open: boolean; onClose: () => void }) {
  const { addUser, updateUser, notify, currentUser } = useStore();
  const isNew = !user;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'form', string>>>({});
  const [resetPw, setResetPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(undefined);

  const key = open ? user?.id ?? 'new' : undefined;
  if (key !== openedFor) {
    setOpenedFor(key);
    setForm(user ? { name: user.name, email: user.email, phone: user.phone, title: user.title, role: user.role, status: user.status, password: '' } : { ...EMPTY, password: generatePassword() });
    setErrors({});
    setResetPw(false);
  }

  const isSelf = user?.id === currentUser?.id;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined, form: undefined }));
  };

  const save = async () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Isi nama lengkap.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Isi email kantor yang valid, contoh: nama@agusta.co.id';
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = 'Isi nomor WhatsApp aktif. Notifikasi PDF dikirim ke nomor ini.';
    if ((isNew || resetPw) && form.password.length < 8) e.password = 'Kata sandi minimal 8 karakter.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = { ...form, title: form.title.trim() || ROLE_META[form.role].label };
    const { password, ...profile } = payload;
    setSaving(true);
    const res = await (isNew
      ? addUser(payload)
      : updateUser(user!.id, resetPw ? payload : profile)
    ).catch(err => ({ ok: false as const, error: errorMessage(err) }));
    setSaving(false);
    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    notify(isNew ? `Akun ${form.name} dibuat. Bagikan kata sandi sementaranya.` : `Perubahan akun ${form.name} disimpan.`);
    onClose();
  };

  const toggleStatus = async () => {
    if (!user) return;
    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setSaving(true);
    const res = await updateUser(user.id, { status: next }).catch(err => ({ ok: false as const, error: errorMessage(err) }));
    setSaving(false);
    setConfirmDeactivate(false);
    if (!res.ok) return notify(res.error, 'error');
    notify(next === 'ACTIVE' ? `${user.name} diaktifkan kembali.` : `${user.name} dinonaktifkan dan tidak bisa masuk.`, 'info');
    onClose();
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={isNew ? 'Tambah user' : 'Ubah user'}
        description={isNew ? 'Akun baru langsung bisa dipakai masuk dengan kata sandi sementara.' : user!.email}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {isNew ? 'Buat akun' : 'Simpan perubahan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {errors.form && <p role="alert" className="rounded-lg bg-brand-soft px-3 py-2.5 text-[13px] text-brand-strong">{errors.form}</p>}

          <Field label="Nama lengkap" error={errors.name}>
            {p => <Input {...p} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ismi Putri" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email kantor" error={errors.email}>
              {p => <Input {...p} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="nama@agusta.co.id" />}
            </Field>
            <Field label="WhatsApp" error={errors.phone} hint={!errors.phone ? 'Untuk notifikasi penawaran.' : undefined}>
              {p => <Input {...p} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+62 812-0000-0000" />}
            </Field>
          </div>
          <Field label="Jabatan" optional>
            {p => <Input {...p} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Account Executive" />}
          </Field>

          <fieldset disabled={isSelf}>
            <legend className="text-[13px] font-semibold text-ink">Role</legend>
            {isSelf && <p className="mt-0.5 text-xs text-ink-3">Role akun Anda sendiri tidak bisa diubah.</p>}
            <div className="mt-2 flex flex-col gap-2">
              {ROLES.map(r => {
                const active = form.role === r;
                return (
                  <label
                    key={r}
                    className={cx(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                      active ? 'border-link bg-link-soft/50' : 'border-line hover:border-line-strong',
                      isSelf && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <input type="radio" name="role" checked={active} onChange={() => set('role', r)} className="mt-0.5 size-4 accent-[var(--color-link)]" />
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-ink">{ROLE_META[r].label}</span>
                        <span className="text-xs text-ink-3">{ROLE_PERMISSIONS[r].length} hak akses</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-2">{ROLE_META[r].description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isNew || resetPw ? (
            <Field label={isNew ? 'Kata sandi sementara' : 'Kata sandi baru'} error={errors.password} hint={!errors.password ? 'Minta user menggantinya setelah masuk pertama kali.' : undefined}>
              {p => (
                <div className="flex gap-2">
                  <Input {...p} value={form.password} onChange={e => set('password', e.target.value)} className="font-mono" />
                  <Button onClick={() => set('password', generatePassword())}>Buat acak</Button>
                </div>
              )}
            </Field>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-3">
              <div>
                <p className="text-[13px] font-semibold text-ink">Kata sandi</p>
                <p className="text-xs text-ink-3">Login terakhir {user?.lastLoginAt ?? 'belum pernah'}</p>
              </div>
              <Button
                size="sm"
                icon={<KeyRound className="size-4" />}
                onClick={() => {
                  setResetPw(true);
                  set('password', generatePassword());
                }}
              >
                Atur ulang
              </Button>
            </div>
          )}

          {!isNew && !isSelf && (
            <div className="mt-2 border-t border-line pt-5">
              <p className="text-[13px] font-semibold text-ink">{user!.status === 'ACTIVE' ? 'Nonaktifkan akun' : 'Aktifkan kembali'}</p>
              <p className="mt-0.5 text-xs text-ink-2">
                {user!.status === 'ACTIVE'
                  ? 'User tidak bisa masuk lagi. Riwayat penawarannya tetap tersimpan.'
                  : 'User bisa masuk lagi dengan kata sandi terakhirnya.'}
              </p>
              <Button
                size="sm"
                className="mt-3"
                variant={user!.status === 'ACTIVE' ? 'danger' : 'secondary'}
                icon={user!.status === 'ACTIVE' ? <UserX className="size-4" /> : undefined}
                onClick={() => (user!.status === 'ACTIVE' ? setConfirmDeactivate(true) : toggleStatus())}
              >
                {user!.status === 'ACTIVE' ? 'Nonaktifkan akun' : 'Aktifkan akun'}
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      <Dialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={`Nonaktifkan ${user?.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDeactivate(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={toggleStatus} loading={saving}>
              Nonaktifkan
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {user?.name} akan langsung keluar dan tidak bisa masuk lagi sampai diaktifkan kembali. Penawaran yang sudah diajukan tetap tersimpan.
        </p>
      </Dialog>
    </>
  );
}

function PermissionMatrix() {
  const groups: { label: string; perms: Permission[] }[] = [
    { label: 'Penawaran', perms: ['quotation:create', 'quotation:view-own', 'quotation:view-all', 'quotation:review'] },
    { label: 'Harga & HPP', perms: ['cogs:view', 'cogs:edit', 'discount-rules:edit'] },
    { label: 'Katalog & barang custom', perms: ['catalog:view', 'custom-request:create', 'custom-request:price'] },
    { label: 'Manajemen', perms: ['reports:view', 'users:manage'] },
  ];
  return (
    <Panel
      title="Hak akses per role"
      description="HPP dan margin hanya terlihat oleh Sales Support dan Management, termasuk di PDF dan notifikasi."
      bodyClassName="overflow-x-auto"
    >
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="px-5 py-3 text-xs font-medium text-ink-3">Hak akses</th>
            {ROLES.map(r => (
              <th key={r} className="w-36 px-3 py-3 text-center text-[13px] font-semibold text-ink">
                {ROLE_META[r].label}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(g => (
          <tbody key={g.label} className="divide-y divide-line border-b border-line last:border-0">
            <tr className="bg-canvas/70">
              <th colSpan={4} className="px-5 py-2 text-xs font-semibold text-ink-2">
                {g.label}
              </th>
            </tr>
            {g.perms.map(p => (
              <tr key={p}>
                <td className="px-5 py-2.5 text-ink">{PERMISSION_LABELS[p]}</td>
                {ROLES.map(r => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    {ROLE_PERMISSIONS[r].includes(p) ? (
                      <Check className="mx-auto size-4 text-emerald-600" aria-label="Diizinkan" />
                    ) : (
                      <Minus className="mx-auto size-4 text-line-strong" aria-label="Tidak diizinkan" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </Panel>
  );
}

export function UsersPage() {
  const { users, currentUser } = useStore();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'ALL' | UserRole>('ALL');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const list = users.filter(u => {
    const t = query.trim().toLowerCase();
    return (
      (role === 'ALL' || u.role === role) &&
      (status === 'ALL' || u.status === status) &&
      (!t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.title.toLowerCase().includes(t))
    );
  });
  const open = (u: UserProfile | null) => {
    setEditing(u);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="User & hak akses"
        description="Kelola siapa yang bisa masuk ke portal dan apa yang bisa mereka lihat."
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => open(null)}>
            Tambah user
          </Button>
        }
      >
        <Segmented
          label="Bagian"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'users', label: 'User', count: users.length },
            { value: 'roles', label: 'Hak akses per role' },
          ]}
        />
      </PageHeader>

      {tab === 'roles' ? (
        <PermissionMatrix />
      ) : (
        <Panel bodyClassName="">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 md:flex-row md:items-center">
            <div className="relative md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input aria-label="Cari user" placeholder="Cari nama, email, jabatan" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
            </div>
            <Select aria-label="Filter role" value={role} onChange={e => setRole(e.target.value as typeof role)} className="md:w-48">
              <option value="ALL">Semua role</option>
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </Select>
            <div className="md:ml-auto">
              <Segmented
                label="Filter status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ACTIVE', label: 'Aktif', count: users.filter(u => u.status === 'ACTIVE').length },
                  { value: 'INACTIVE', label: 'Nonaktif', count: users.filter(u => u.status === 'INACTIVE').length },
                  { value: 'ALL', label: 'Semua' },
                ]}
              />
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="Tidak ada user yang cocok"
              description="Ubah kata kunci atau filter role dan status."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setRole('ALL');
                    setStatus('ALL');
                  }}
                >
                  Hapus filter
                </Button>
              }
            />
          ) : (
            <>
              <table className="hidden w-full text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-3 py-3 font-medium">Role</th>
                    <th className="px-3 py-3 font-medium">WhatsApp</th>
                    <th className="px-3 py-3 font-medium">Login terakhir</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map(u => (
                    <tr key={u.id} className={cx('transition-colors hover:bg-canvas', u.status === 'INACTIVE' && 'text-ink-3')}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} />
                          <div className="min-w-0">
                            <p className={cx('truncate font-semibold', u.status === 'ACTIVE' ? 'text-ink' : 'text-ink-2')}>
                              {u.name}
                              {u.id === currentUser?.id && <span className="ml-2 text-xs font-normal text-ink-3">(Anda)</span>}
                            </p>
                            <p className="truncate text-xs text-ink-3">
                              {u.email} · {u.title}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[13px] font-medium">{ROLE_META[u.role].label}</td>
                      <td className="px-3 py-3 text-[13px] tabular-nums text-ink-2">{u.phone}</td>
                      <td className="px-3 py-3 text-[13px] text-ink-2">{u.lastLoginAt ?? 'Belum pernah'}</td>
                      <td className="px-3 py-3">
                        <Badge tone={u.status === 'ACTIVE' ? 'green' : 'gray'}>{u.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</Badge>
                      </td>
                      <td className="pr-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => open(u)}>
                          Ubah
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {list.map(u => (
                  <li key={u.id}>
                    <button onClick={() => open(u)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-canvas cursor-pointer">
                      <Avatar user={u} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{u.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {ROLE_META[u.role].label} · {u.email}
                        </span>
                      </span>
                      <Badge tone={u.status === 'ACTIVE' ? 'green' : 'gray'}>{u.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}

      <UserDrawer user={editing} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
