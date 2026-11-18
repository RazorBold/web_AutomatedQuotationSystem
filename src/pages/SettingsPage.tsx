import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { AppSettings, BankAccount, CompanyInfo, LetterTemplates, PaymentPreset } from '../types';
import { errorMessage, useStore } from '../store/AppStore';
import { Button, Field, Input, PageHeader, Panel, Segmented, cx } from '../components/ui';
import { DiscountRulesEditor } from './DiscountRulesPage';

type Tab = 'banks' | 'rules' | 'templates' | 'company';

const TABS: { value: Tab; label: string }[] = [
  { value: 'banks', label: 'Rekening bank' },
  { value: 'rules', label: 'Aturan diskon' },
  { value: 'templates', label: 'Template surat' },
  { value: 'company', label: 'Data perusahaan' },
];

const DESCRIPTIONS: Record<Tab, string> = {
  banks: 'Rekening yang bisa dipilih Sales Support di surat penawaran. Satu rekening jadi default.',
  rules: 'Saran dan batas diskon per merek. Diisi sendiri oleh tim Agusta.',
  templates: 'Keterangan standar di surat, pilihan cepat keterangan, dan pilihan termin pembayaran.',
  company: 'Kop surat penawaran: nama perusahaan, alamat, dan kontak.',
};

const SMALL_INPUT = 'h-9 w-full min-w-0 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15';

/** Save button shared by the tabs: enabled only when something changed. */
function useSaver<K extends keyof AppSettings>(key: K, label: string) {
  const { settings, saveSetting, notify } = useStore();
  const [draft, setDraft] = useState<AppSettings[K]>(settings[key]);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings[key]);
  const save = async (value: AppSettings[K] = draft) => {
    setSaving(true);
    try {
      await saveSetting(key, value);
      notify(`${label} disimpan.`);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  return { draft, setDraft, dirty, saving, save, reset: () => setDraft(settings[key]) };
}

function SaveBar({ dirty, saving, onSave, onReset, problem }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; problem?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
      {problem && <p className="mr-auto text-xs text-brand-strong">{problem}</p>}
      {dirty && (
        <Button size="sm" variant="ghost" onClick={onReset}>
          Batalkan perubahan
        </Button>
      )}
      <Button size="sm" variant="primary" disabled={!dirty || !!problem} loading={saving} onClick={onSave}>
        Simpan
      </Button>
    </div>
  );
}

// ───────────────────────── Rekening bank ─────────────
function BanksTab() {
  const { draft, setDraft, dirty, saving, save, reset } = useSaver('banks', 'Daftar rekening');
  const set = (i: number, p: Partial<BankAccount>) => setDraft(draft.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  const incomplete = draft.some(b => !b.bank.trim() || !b.holder.trim() || !b.account.trim());
  const problem = !draft.length ? 'Isi minimal satu rekening.' : incomplete ? 'Lengkapi nama bank, atas nama, dan nomor rekening.' : undefined;

  return (
    <Panel title="Rekening bank" description="Dicetak di bagian Keterangan surat: “Pembayaran dapat ditransfer ke rekening perusahaan …”." bodyClassName="">
      <ul className="divide-y divide-line">
        {draft.map((b, i) => (
          <li key={b.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
            <Field label="Bank & cabang">{p => <Input {...p} value={b.bank} onChange={e => set(i, { bank: e.target.value })} placeholder="BANK BCA Cabang Gang Tengah, Semarang" />}</Field>
            <Field label="Atas nama">{p => <Input {...p} value={b.holder} onChange={e => set(i, { holder: e.target.value })} placeholder="PT AGUSTA TRIASA" />}</Field>
            <Field label="Nomor rekening">{p => <Input {...p} value={b.account} inputMode="numeric" onChange={e => set(i, { account: e.target.value })} placeholder="182 9888 333" />}</Field>
            <div className="flex items-center gap-3 md:pb-2">
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
                <input
                  type="radio"
                  name="default-bank"
                  checked={!!b.isDefault}
                  onChange={() => setDraft(draft.map((x, idx) => ({ ...x, isDefault: idx === i })))}
                  className="size-4 accent-[var(--color-link)]"
                />
                Default
              </label>
              <button
                type="button"
                disabled={draft.length === 1}
                onClick={() => {
                  const rest = draft.filter((_, idx) => idx !== i);
                  setDraft(b.isDefault && rest[0] ? rest.map((x, idx) => ({ ...x, isDefault: idx === 0 })) : rest);
                }}
                className="rounded p-1.5 text-ink-3 hover:bg-brand-soft hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                aria-label={`Hapus rekening ${b.bank || i + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus className="size-4" />}
          disabled={draft.length >= 10}
          onClick={() => setDraft([...draft, { id: `bank-${Date.now().toString(36)}`, bank: '', holder: draft[0]?.holder ?? '', account: '', isDefault: false }])}
        >
          Tambah rekening
        </Button>
        <p className="text-xs text-ink-3">Surat yang sudah terbit tetap memakai rekening saat diterbitkan.</p>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={reset} problem={dirty ? problem : undefined} />
    </Panel>
  );
}

// ───────────────────────── Template surat ─────────────
/** Editable list of text lines with add/remove. */
function LinesEditor({ label, lines, onChange, placeholder }: { label: string; lines: string[]; onChange: (l: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...lines, draft.trim()]);
    setDraft('');
  };
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((t, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <input aria-label={`${label} ${i + 1}`} value={t} onChange={e => onChange(lines.map((x, idx) => (idx === i ? e.target.value : x)))} className={SMALL_INPUT} />
          <button
            type="button"
            onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
            className="rounded p-1.5 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
            aria-label={`Hapus ${label.toLowerCase()} ${i + 1}`}
          >
            <X className="size-4" />
          </button>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <input
          aria-label={`${label} baru`}
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className={cx(SMALL_INPUT, 'border-dashed')}
        />
        <button type="button" onClick={add} className="rounded p-1.5 text-link hover:bg-link-soft cursor-pointer" aria-label={`Tambah ${label.toLowerCase()}`}>
          <Plus className="size-4" />
        </button>
      </li>
    </ul>
  );
}

function TemplatesTab() {
  const { draft, setDraft, dirty, saving, save, reset } = useSaver('templates', 'Template surat');
  const set = (p: Partial<LetterTemplates>) => setDraft({ ...draft, ...p });
  const setPreset = (i: number, p: Partial<PaymentPreset>) => set({ paymentPresets: draft.paymentPresets.map((x, idx) => (idx === i ? { ...x, ...p } : x)) });
  const badPreset = draft.paymentPresets.find(p => !p.label.trim() || p.terms.reduce((s, t) => s + (Number(t.percent) || 0), 0) !== 100 || p.terms.some(t => !t.label.trim()));
  const clean = (): LetterTemplates => ({
    defaultTerms: draft.defaultTerms.map(t => t.trim()).filter(Boolean),
    suggestions: draft.suggestions.map(t => t.trim()).filter(Boolean),
    paymentPresets: draft.paymentPresets.map(p => ({ label: p.label.trim(), terms: p.terms.map(t => ({ label: t.label.trim(), percent: Number(t.percent) || 0 })) })),
  });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Keterangan standar" description="Otomatis tercantum di setiap surat baru. Sales Support tetap bisa mengubahnya per penawaran.">
        <LinesEditor label="Keterangan standar" lines={draft.defaultTerms} onChange={defaultTerms => set({ defaultTerms })} placeholder="Tulis keterangan, mis. Harga franco Kota Semarang" />
      </Panel>
      <Panel title="Pilihan cepat keterangan" description="Muncul sebagai tombol “+ …” di Format surat, untuk ditambahkan sekali ketuk.">
        <LinesEditor label="Pilihan keterangan" lines={draft.suggestions} onChange={suggestions => set({ suggestions })} placeholder="Tulis pilihan, mis. Garansi resmi 1 tahun" />
      </Panel>
      <Panel title="Pilihan termin pembayaran" description="Tombol pilihan DP di Format surat. Total setiap pilihan harus 100%." className="xl:col-span-2" bodyClassName="">
        <ul className="divide-y divide-line">
          {draft.paymentPresets.map((p, i) => {
            const total = p.terms.reduce((s, t) => s + (Number(t.percent) || 0), 0);
            return (
              <li key={i} className="flex flex-col gap-2 px-5 py-4">
                <div className="flex items-center gap-2">
                  <input aria-label={`Nama pilihan termin ${i + 1}`} value={p.label} placeholder="DP 50% · pelunasan 50%" onChange={e => setPreset(i, { label: e.target.value })} className={cx(SMALL_INPUT, 'font-semibold')} />
                  <button
                    type="button"
                    onClick={() => set({ paymentPresets: draft.paymentPresets.filter((_, idx) => idx !== i) })}
                    className="rounded p-1.5 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
                    aria-label={`Hapus pilihan termin ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {p.terms.map((t, j) => (
                  <div key={j} className="flex items-center gap-1.5 pl-4">
                    <input
                      aria-label={`Termin ${j + 1} pilihan ${i + 1}`}
                      value={t.label}
                      placeholder="Down Payment"
                      onChange={e => setPreset(i, { terms: p.terms.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })}
                      className={SMALL_INPUT}
                    />
                    <span className="relative shrink-0">
                      <input
                        aria-label={`Persen termin ${j + 1} pilihan ${i + 1}`}
                        inputMode="numeric"
                        value={t.percent || ''}
                        onChange={e => setPreset(i, { terms: p.terms.map((x, k) => (k === j ? { ...x, percent: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) } : x)) })}
                        className={cx(SMALL_INPUT, 'w-20 pr-6 text-right tabular-nums')}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-3">%</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreset(i, { terms: p.terms.filter((_, k) => k !== j) })}
                      className="rounded p-1.5 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
                      aria-label={`Hapus termin ${j + 1} pilihan ${i + 1}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pl-4">
                  <button
                    type="button"
                    onClick={() => setPreset(i, { terms: [...p.terms, { label: '', percent: 0 }] })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-strong cursor-pointer"
                  >
                    <Plus className="size-3.5" /> Baris termin
                  </button>
                  <span className={cx('text-xs tabular-nums', total === 100 ? 'text-ink-3' : 'text-brand-strong')}>Total {total}%</span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="size-4" />}
            onClick={() => set({ paymentPresets: [...draft.paymentPresets, { label: '', terms: [{ label: 'Down Payment', percent: 50 }, { label: 'Pelunasan', percent: 50 }] }] })}
          >
            Tambah pilihan termin
          </Button>
        </div>
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save(clean())}
          onReset={reset}
          problem={dirty && badPreset ? 'Setiap pilihan termin perlu nama, keterangan tiap baris, dan total 100%.' : undefined}
        />
      </Panel>
    </div>
  );
}

// ───────────────────────── Data perusahaan ─────────────
function CompanyTab() {
  const { draft, setDraft, dirty, saving, save, reset } = useSaver('company', 'Data perusahaan');
  const set = (p: Partial<CompanyInfo>) => setDraft({ ...draft, ...p });
  const problem = !draft.name.trim() || !draft.street.trim() ? 'Isi minimal nama perusahaan dan alamat.' : undefined;
  const fields: [keyof CompanyInfo, string, string, string?][] = [
    ['name', 'Nama perusahaan', 'PT. Agusta Triasa'],
    ['street', 'Alamat', 'Jl. Pandanaran No.62'],
    ['city', 'Kota & kode pos', 'Semarang 50134'],
    ['country', 'Negara', 'INDONESIA'],
    ['phone', 'Telephone', '024 844 733'],
    ['whatsapp', 'WA Center', '0857 2706 6550'],
    ['email', 'Email', 'agusta@agusta.co.id'],
    ['place', 'Kota di tanggal surat', 'Semarang', 'Ditulis sebelum tanggal: “Semarang, 18 November 2026”.'],
  ];
  return (
    <Panel title="Kop surat" description="Tampil di kanan atas setiap surat penawaran dan PDF." bodyClassName="">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {fields.map(([k, label, placeholder, hint]) => (
          <Field key={k} label={label} hint={hint} className={k === 'street' ? 'sm:col-span-2' : undefined}>
            {p => <Input {...p} value={draft[k]} placeholder={placeholder} onChange={e => set({ [k]: e.target.value })} />}
          </Field>
        ))}
      </div>
      <div className="mx-5 mb-5 rounded-lg border border-line bg-canvas px-4 py-3 text-[11.5px] leading-snug text-ink-2">
        <p className="mb-1 text-xs font-semibold text-ink-3">Pratinjau kop</p>
        <p className="font-bold text-ink">{draft.name}</p>
        <p>{draft.street}</p>
        <p>{draft.city}</p>
        <p>{draft.country}</p>
        <p className="mt-1">Telephone : {draft.phone}</p>
        <p>WA Center : {draft.whatsapp}</p>
        <p className="font-bold text-ink">Email : {draft.email}</p>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={reset} problem={dirty ? problem : undefined} />
    </Panel>
  );
}

/** "Pengaturan": everything Agusta customises without a developer (Sales Support & Management). */
export function SettingsPage({ initialTab = 'banks' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pengaturan" description={DESCRIPTIONS[tab]}>
        <Segmented<Tab> label="Bagian pengaturan" value={tab} onChange={setTab} options={TABS} />
      </PageHeader>
      {tab === 'banks' && <BanksTab />}
      {tab === 'rules' && <DiscountRulesEditor />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'company' && <CompanyTab />}
    </div>
  );
}
