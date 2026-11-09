import React, { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { AgustaLogo } from '../components/AgustaLogo';
import { Button, Field, HeroLines, Input, ProductImage, cx } from '../components/ui';
import { useStore } from '../store/AppStore';
import { ROLE_META } from '../auth/permissions';
import { formatRupiah } from '../utils/quotationEngine';
import { PRODUCTS } from '../data/mockData';

export function LoginPage() {
  const { login, users, products, mode } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = (['SALES', 'SALES_SUPPORT', 'MANAGEMENT'] as const)
    .map(role => users.find(u => u.role === role && u.status === 'ACTIVE'))
    .filter(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Isi email kantor dan kata sandi untuk masuk.');
      return;
    }
    setLoading(true);
    login(email, password)
      .then(res => {
        if (!res.ok) setError(res.error);
      })
      .catch(() => setError('Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi.'))
      .finally(() => setLoading(false));
  };

  // Before sign-in the database is closed (RLS), so the decorative shelf uses the bundled photos.
  const shelf = (products.length ? products : PRODUCTS).filter(p => p.image).slice(0, 6);

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(420px,5fr)_7fr]">
      {/* Form column */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <AgustaLogo size="md" />

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[30px] font-semibold leading-tight text-ink">Masuk ke portal penawaran</h1>
          <p className="mt-2 text-sm text-ink-2">
            Gunakan akun kantor Agusta Anda. Menu yang tampil menyesuaikan peran Anda.
          </p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-5" noValidate>
            <Field label="Email kantor">
              {p => (
                <Input
                  {...p}
                  type="email"
                  autoComplete="username"
                  placeholder="nama@agusta.co.id"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                />
              )}
            </Field>
            <Field label="Kata sandi">
              {p => (
                <div className="relative">
                  <Input
                    {...p}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-ink-3 hover:text-ink cursor-pointer"
                    aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>

            {error && (
              <p role="alert" className="rounded-lg bg-brand-soft px-3 py-2.5 text-[13px] text-brand-strong">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" loading={loading} icon={<LogIn className="size-4" />} className="mt-1 w-full">
              Masuk
            </Button>
          </form>

          {mode === 'local' && demoAccounts.length > 0 && (
          <div className="mt-10">
            <p className="text-[13px] font-semibold text-ink">Akun demo untuk UAT</p>
            <p className="mt-0.5 text-xs text-ink-3">Klik untuk mengisi otomatis. Kata sandi semua akun: agusta123</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {demoAccounts.map(u => (
                <li key={u!.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(u!.email);
                      setPassword('agusta123');
                      setError(null);
                    }}
                    className={cx(
                      'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-canvas cursor-pointer',
                      email === u!.email && 'bg-link-soft/60'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{u!.name}</span>
                      <span className="block truncate text-xs text-ink-3">{u!.email}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-link">{ROLE_META[u!.role].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          )}
        </div>

        <p className="text-xs text-ink-3">© 2026 Agusta Business &amp; Office Equipment · Portal internal</p>
      </div>

      {/* Brand column: catalog shelf with an approved quotation resting on it */}
      <div className="relative hidden overflow-hidden bg-brand-deep lg:block" aria-hidden>
        <HeroLines />
        <div className="absolute inset-x-0 top-0 grid grid-cols-3 gap-5 px-12 pt-36">
          {shelf.map(p => (
            <div key={p.id} className="rounded-[14px] bg-surface p-4 shadow-[0_12px_30px_-16px_rgb(80_8_12/0.6)]">
              <ProductImage src={p.image} alt="" hint={p.category} className="aspect-[16/10] rounded-md" />
              <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-link">{p.category}</p>
              <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-ink">{p.name}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-8 right-14 w-[340px] rotate-[-2.5deg] rounded-md bg-surface p-6 shadow-[0_24px_48px_-16px_rgb(60_4_8/0.55)]">
          <div className="flex items-start justify-between border-b-2 border-navy pb-3">
            <AgustaLogo size="sm" />
            <span className="font-mono text-[10px] text-ink-2">QTN-261103-0091</span>
          </div>
          <p className="mt-3 text-[11px] text-ink-3">Kepada Yth.</p>
          <p className="text-[13px] font-semibold text-ink">Dinas Pendidikan Kota Bandung</p>
          <div className="mt-3 space-y-1.5 text-[11px] text-ink-2">
            <div className="flex justify-between"><span>40 × Kursi Indachi Vino I CR</span><span className="tabular-nums">{formatRupiah(78120000)}</span></div>
            <div className="flex justify-between"><span>12 × Lenovo ThinkCentre Neo 50a</span><span className="tabular-nums">{formatRupiah(111720000)}</span></div>
            <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink"><span>Total inc. PPN 11%</span><span className="tabular-nums">{formatRupiah(210722000)}</span></div>
          </div>
          <div className="absolute -left-6 -top-5 rotate-[-10deg] rounded-md border-2 border-brand px-3 py-1 text-[13px] font-extrabold tracking-[0.08em] text-brand bg-surface/80">
            DISETUJUI
          </div>
        </div>

        <p className="absolute left-12 top-12 max-w-[28ch] text-[22px] font-semibold leading-snug text-white">
          Dari katalog sampai surat penawaran bertanda tangan, dalam satu alur.
        </p>
      </div>
    </div>
  );
}
