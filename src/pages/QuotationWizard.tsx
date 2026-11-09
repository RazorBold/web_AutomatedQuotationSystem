import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, MessageSquarePlus, Minus, PackageSearch, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { errorMessage, useStore, useVisibleProducts } from '../store/AppStore';
import { SmartSuggestions } from '../components/SmartSuggestions';
import { CATEGORIES, NewRequestDrawer, type CustomRequestDraft } from './CustomRequestsPage';
import { AgustaWebResults } from '../components/AgustaWebResults';
import { agustaImageUrl } from '../utils/agustaCatalog';
import { parseSalesRequest } from '../utils/smartSearch';
import type { CustomerCategory, CustomerInfo, Quotation } from '../types';
import { Button, EmptyState, Field, Input, PageHeader, Panel, ProductImage, Textarea, cx } from '../components/ui';
import { QuotationSheet } from '../components/QuotationDocument';
import { calculateLineSubtotal, formatRupiah, getSuggestedDiscount, smartProductSearch } from '../utils/quotationEngine';
import type { Route } from '../App';

const SEGMENTS: { value: CustomerCategory; label: string; hint: string }[] = [
  { value: 'CORPORATE', label: 'Korporasi', hint: 'Diskon bertingkat sesuai volume' },
  { value: 'BUMN_GOV', label: 'BUMN / Pemerintah', hint: 'Mengikuti e-Katalog LKPP' },
  { value: 'EDUCATION', label: 'Pendidikan', hint: 'Sekolah & universitas' },
  { value: 'RETAIL', label: 'Retail', hint: 'Pembelian satuan' },
];

const STEPS = ['Customer', 'Produk', 'Tinjau & ajukan'] as const;

interface Line {
  productId: string;
  qty: number;
  discountPercent: number;
  notes: string;
}

const EMPTY_CUSTOMER: CustomerInfo = {
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  category: 'CORPORATE',
};

export function QuotationWizard({
  editId,
  initialProductId,
  navigate,
}: {
  editId?: string;
  initialProductId?: string;
  navigate: (r: Route) => void;
}) {
  const { quotations, createQuotation, notify, currentUser, discountRules } = useStore();
  const products = useVisibleProducts();
  const editing = editId ? quotations.find(q => q.id === editId) : undefined;

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<CustomerInfo>(editing?.customer ?? EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});
  const [lines, setLines] = useState<Line[]>(() => {
    if (editing) return editing.items.map(i => ({ productId: i.productId, qty: i.qty, discountPercent: i.discountPercent, notes: i.notes ?? '' }));
    if (initialProductId) return [{ productId: initialProductId, qty: 1, discountPercent: 0, notes: '' }];
    return [];
  });
  const [salesNotes, setSalesNotes] = useState(editing?.salesNotes ?? '');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const [submitting, setSubmitting] = useState(false);

  const categories = useMemo(() => ['Semua', ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const results = smartProductSearch(products, query).filter(p => category === 'Semua' || p.category === category);
  const byId = (id: string) => products.find(p => p.id === id)!;

  const suggest = (qty: number) => getSuggestedDiscount(qty, customer.category, discountRules);

  const setLine = (productId: string, p: Partial<Line>) =>
    setLines(prev => prev.map(l => (l.productId === productId ? { ...l, ...p } : l)));

  const addProduct = (productId: string, qty = 1) => {
    const existing = lines.find(l => l.productId === productId);
    if (existing) return changeQty(productId, existing.qty + qty);
    setLines(prev => [...prev, { productId, qty, discountPercent: suggest(qty).suggestedPercent, notes: '' }]);
  };

  const [customDraft, setCustomDraft] = useState<CustomRequestDraft | null>(null);
  const openCustomRequest = (text: string, qty = 1) => {
    const [seg] = parseSalesRequest(text, CATEGORIES);
    setCustomDraft({
      productName: text.replace(/^\s*\d+\s*(unit|pcs|buah|set)?\s*/i, '').trim(),
      estimatedQty: qty,
      category: seg?.category && CATEGORIES.includes(seg.category) ? seg.category : undefined,
    });
  };
  /** Quantity the rep typed in the request (first item), used when asking for a price. */
  const requestedQty = parseSalesRequest(query, CATEGORIES)[0]?.qty ?? 1;
  /** "Minta harga" for an item without a price (website product or unpriced catalog product). */
  const requestPrice = (item: { name: string; category: string; specs?: string; image?: string; sourceUrl?: string }, qty = requestedQty) =>
    setCustomDraft({
      productName: item.name,
      category: item.category,
      estimatedQty: qty,
      specs: item.specs,
      imageUrl: item.image || undefined,
      sourceUrl: item.sourceUrl,
      referenceUrlOrNotes: item.sourceUrl ? `Produk di website Agusta: ${item.sourceUrl}` : '',
    });

  const changeQty = (productId: string, qty: number) => {
    if (qty <= 0) return setLines(prev => prev.filter(l => l.productId !== productId));
    const s = suggest(qty);
    setLines(prev =>
      prev.map(l => (l.productId === productId ? { ...l, qty, discountPercent: Math.max(l.discountPercent, s.suggestedPercent) } : l))
    );
  };

  const priced = lines.map(l => {
    const p = byId(l.productId);
    return { l, p, subtotal: calculateLineSubtotal({ qty: l.qty, sellingPrice: p.basePrice, discountPercent: l.discountPercent }) };
  });
  const subtotal = priced.reduce((s, x) => s + x.subtotal, 0);
  const tax = Math.round(subtotal * 0.11);

  const validateCustomer = () => {
    const e: typeof errors = {};
    if (!customer.companyName.trim()) e.companyName = 'Isi nama instansi atau perusahaan.';
    if (!customer.contactPerson.trim()) e.contactPerson = 'Isi nama orang yang dituju di surat.';
    if (!customer.phone.trim()) e.phone = 'Isi nomor telepon kontak.';
    if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email)) e.email = 'Format email belum benar, contoh: nama@perusahaan.co.id';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateCustomer()) return;
    if (step === 1 && lines.length === 0) {
      notify('Tambahkan minimal satu produk sebelum lanjut.', 'error');
      return;
    }
    setStep(s => Math.min(2, s + 1));
    document.querySelector('main')?.scrollTo({ top: 0 });
  };

  const submit = () => {
    setSubmitting(true);
    createQuotation(
      { customer, salesNotes, items: lines.map(l => ({ productId: l.productId, qty: l.qty, discountPercent: l.discountPercent, notes: l.notes })) },
      editing?.id
    )
      .then(q => {
        notify(`${q.quotationNumber} diajukan ke Sales Support.`);
        navigate({ view: 'quotation-detail', id: q.id });
      })
      .catch(e => {
        notify(errorMessage(e), 'error');
        setSubmitting(false);
      });
  };

  const preview: Quotation | null =
    step === 2 && currentUser
      ? {
          id: 'preview',
          quotationNumber: editing?.quotationNumber ?? 'QTN-DRAF',
          date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          validUntil: new Date(Date.now() + 14 * 86400000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          status: 'DRAFT',
          customer,
          salesId: currentUser.id,
          salesName: currentUser.name,
          salesPhone: currentUser.phone,
          items: priced.map(({ l, p, subtotal: st }) => ({
            id: p.id,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            category: p.category,
            image: p.image,
            qty: l.qty,
            unit: p.unit,
            cogs: 0,
            basePrice: p.basePrice,
            sellingPrice: p.basePrice,
            discountPercent: l.discountPercent,
            subtotal: st,
            notes: l.notes,
            specs: p.specs,
          })),
          subtotal,
          taxRatePercent: 11,
          taxAmount: tax,
          grandTotal: subtotal + tax,
          totalCogs: 0,
          grossProfit: 0,
          grossMarginPercent: 0,
          salesNotes,
        }
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={editing ? `Revisi ${editing.quotationNumber}` : 'Buat penawaran'}
        description={
          editing
            ? 'Perbaiki sesuai catatan Sales Support, lalu ajukan ulang.'
            : 'Isi data customer, pilih produk, lalu ajukan ke Sales Support untuk persetujuan harga.'
        }
      >
        {/* Stepper — a real sequence, so numbered */}
        <ol className="flex items-center gap-2 overflow-x-auto" aria-label="Langkah">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  aria-current={current ? 'step' : undefined}
                  className={cx(
                    'flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-white',
                    current && 'bg-white text-brand-ink shadow-[0_1px_2px_rgb(80_8_12/0.25)]',
                    done && 'text-white hover:bg-white/10 cursor-pointer',
                    !current && !done && 'text-white/70'
                  )}
                >
                  <span
                    className={cx(
                      'flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                      current ? 'bg-brand text-white' : done ? 'bg-white/20 text-white' : 'ring-1 ring-inset ring-white/40 text-white/80'
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {label}
                </button>
                {i < STEPS.length - 1 && <span className="h-px w-8 bg-white/35" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </PageHeader>

      {editing?.rejectionReason && (
        <div className="rounded-[14px] border border-line/80 bg-surface px-5 py-4 text-[13px] shadow-card">
          <span className="font-semibold text-brand-strong">Catatan {editing.reviewedBy}: </span>
          <span className="text-ink">{editing.rejectionReason}</span>
        </div>
      )}

      {step === 0 && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Data customer" description="Muncul di kop surat penawaran.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nama instansi / perusahaan" error={errors.companyName} className="sm:col-span-2">
              {p => <Input {...p} value={customer.companyName} onChange={e => setCustomer({ ...customer, companyName: e.target.value })} placeholder="PT Maju Bersama" />}
            </Field>
            <Field label="Nama kontak (u.p.)" error={errors.contactPerson}>
              {p => <Input {...p} value={customer.contactPerson} onChange={e => setCustomer({ ...customer, contactPerson: e.target.value })} placeholder="Bapak Hendra Wijaya" />}
            </Field>
            <Field label="Telepon kontak" error={errors.phone}>
              {p => <Input {...p} type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="+62 811-2233-4455" />}
            </Field>
            <Field label="Email" optional error={errors.email}>
              {p => <Input {...p} type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} placeholder="procurement@perusahaan.co.id" />}
            </Field>
            <Field label="Kota" optional>
              {p => <Input {...p} value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} placeholder="Jakarta Selatan" />}
            </Field>
            <Field label="Alamat" optional className="sm:col-span-2">
              {p => <Textarea {...p} rows={2} value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />}
            </Field>
          </div>

          <fieldset className="mt-6">
            <legend className="text-[13px] font-semibold text-ink">Segmen customer</legend>
            <p className="mt-0.5 text-xs text-ink-3">Menentukan saran diskon otomatis.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SEGMENTS.map(s => {
                const active = customer.category === s.value;
                return (
                  <label
                    key={s.value}
                    className={cx(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                      active ? 'border-link bg-link-soft/50' : 'border-line hover:border-line-strong'
                    )}
                  >
                    <input
                      type="radio"
                      name="segment"
                      className="mt-0.5 size-4 accent-[var(--color-link)]"
                      checked={active}
                      onChange={() => setCustomer({ ...customer, category: s.value })}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{s.label}</span>
                      <span className="block text-xs text-ink-3">{s.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Panel>
        <Panel title="Setelah Anda mengajukan">
          <ol className="relative ml-3 border-l border-line">
            {[
              ['Sales Support mereview', 'HPP, harga final, dan diskon dicek terhadap batas margin.'],
              ['PDF resmi terbit', 'Surat ber-kop Agusta dengan tanda tangan elektronik.'],
              ['Dikirim ke WhatsApp Anda', 'Link PDF siap diteruskan ke customer.'],
            ].map(([t, d], i) => (
              <li key={t} className="relative pb-5 pl-6 last:pb-0">
                <span className="absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-bold tabular-nums text-brand-ink ring-4 ring-surface">
                  {i + 1}
                </span>
                <p className="text-[13px] font-semibold text-ink">{t}</p>
                <p className="mt-0.5 text-xs text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </Panel>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Panel bodyClassName="">
            <div className="border-b border-line p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input
                  aria-label="Cari produk atau tulis permintaan customer"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Tulis permintaan customer, mis. “20 kursi ergonomis di bawah 2,5 juta dan 5 AIO core i7”"
                  className="pl-9"
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-3">Sistem membaca jumlah, budget, spesifikasi, dan beberapa barang sekaligus.</p>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cx(
                      'h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer',
                      category === c ? 'bg-link text-white' : 'bg-canvas text-ink-2 hover:text-ink'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <SmartSuggestions
              products={products}
              query={query}
              cartQty={id => lines.find(l => l.productId === id)?.qty ?? 0}
              onAdd={(id, qty) => {
                addProduct(id, qty);
                notify(`${byId(id).name} ditambahkan (${qty} ${byId(id).unit.toLowerCase()}).`, 'info');
              }}
              onCustomRequest={openCustomRequest}
              onRequestPrice={(p, qty) => requestPrice(p, qty)}
            />

            <AgustaWebResults
              query={query}
              catalog={products}
              onRequestPrice={a =>
                requestPrice({ name: a.name, category: a.category, specs: a.specs, image: agustaImageUrl(a.imagePath), sourceUrl: a.url })
              }
            />

            {results.length === 0 ? (
              <EmptyState
                icon={<PackageSearch className="size-5" />}
                title="Produk tidak ditemukan"
                description="Coba kata lain, atau ajukan sebagai barang custom agar Sales Support menghitung harganya."
                action={<Button size="sm" onClick={() => openCustomRequest(query)}>Ajukan barang custom</Button>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {results.map(p => {
                  const inCart = lines.find(l => l.productId === p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-4 px-4 py-3">
                      <ProductImage src={p.image} alt="" hint={p.category} className="size-16 shrink-0 rounded-lg border border-line" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-link">{p.category}</p>
                        <p className="truncate font-semibold text-ink">{p.name}</p>
                        <p className="text-xs text-ink-3">
                          {p.sku} · {p.isCustom ? 'barang custom, dibuat sesuai pesanan' : `stok ${p.stock} ${p.unit.toLowerCase()}`}
                          {p.eKatalogLkpp && ' · e-Katalog LKPP'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {p.basePrice > 0 ? (
                          <>
                            <span className="text-[13px] font-semibold tabular-nums text-ink">{formatRupiah(p.basePrice)}</span>
                            <Button size="sm" variant={inCart ? 'ghost' : 'secondary'} icon={<Plus className="size-3.5" />} onClick={() => addProduct(p.id)}>
                              {inCart ? `Tambah (${inCart.qty})` : 'Tambah'}
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-ink-3">Harga belum ada</span>
                            <Button size="sm" icon={<MessageSquarePlus className="size-3.5" />} onClick={() => requestPrice(p)}>
                              Minta harga
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <aside className="xl:sticky xl:top-0 xl:self-start">
            <Panel title="Item penawaran" description={`${lines.length} produk · ${customer.companyName || 'customer'}`} bodyClassName="">
              {lines.length === 0 ? (
                <EmptyState icon={<ShoppingCart className="size-5" />} title="Belum ada produk" description="Pilih produk dari daftar di sebelah kiri." />
              ) : (
                <ul className="divide-y divide-line">
                  {priced.map(({ l, p, subtotal: st }) => {
                    const s = suggest(l.qty);
                    const over = l.discountPercent > s.maxAllowedPercent;
                    return (
                      <li key={p.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] font-semibold leading-snug text-ink">{p.name}</p>
                          <button
                            onClick={() => changeQty(p.id, 0)}
                            className="shrink-0 rounded p-1 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
                            aria-label={`Hapus ${p.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-lg border border-line-strong">
                            <button onClick={() => changeQty(p.id, l.qty - 1)} className="flex size-8 items-center justify-center text-ink-2 hover:text-ink cursor-pointer" aria-label="Kurangi">
                              <Minus className="size-3.5" />
                            </button>
                            <input
                              aria-label={`Jumlah ${p.name}`}
                              inputMode="numeric"
                              value={l.qty}
                              onChange={e => changeQty(p.id, Number(e.target.value.replace(/\D/g, '')) || 0)}
                              className="h-8 w-12 border-x border-line text-center text-[13px] font-semibold tabular-nums focus:outline-none"
                            />
                            <button onClick={() => changeQty(p.id, l.qty + 1)} className="flex size-8 items-center justify-center text-ink-2 hover:text-ink cursor-pointer" aria-label="Tambah">
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-ink-2">
                            Diskon
                            <input
                              inputMode="decimal"
                              value={l.discountPercent}
                              onChange={e => setLine(p.id, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })}
                              className={cx(
                                'h-8 w-14 rounded-md border px-2 text-right text-[13px] tabular-nums focus:outline-none focus:ring-3',
                                over ? 'border-amber-400 focus:ring-amber-200' : 'border-line-strong focus:border-link focus:ring-link/15'
                              )}
                            />
                            %
                          </label>
                        </div>
                        <p className={cx('mt-1.5 text-xs', over ? 'text-amber-700' : 'text-ink-3')}>
                          {over
                            ? `Di atas batas ${s.maxAllowedPercent}%. Sales Support perlu menyetujui khusus.`
                            : `Saran ${s.suggestedPercent}%, maks. ${s.maxAllowedPercent}% untuk ${l.qty} ${p.unit.toLowerCase()}.`}
                        </p>
                        <input
                          aria-label={`Catatan ${p.name}`}
                          value={l.notes}
                          onChange={e => setLine(p.id, { notes: e.target.value })}
                          placeholder="Catatan item (warna, varian)…"
                          className="mt-2 h-8 w-full rounded-md border border-transparent bg-canvas px-2.5 text-xs text-ink placeholder:text-ink-3 focus:border-link focus:bg-surface focus:outline-none"
                        />
                        <p className="mt-2 text-right text-[13px] font-semibold tabular-nums text-ink">{formatRupiah(st)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-2">Subtotal</dt>
                  <dd className="tabular-nums">{formatRupiah(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">PPN 11%</dt>
                  <dd className="tabular-nums">{formatRupiah(tax)}</dd>
                </div>
                <div className="flex justify-between pt-1 text-[15px] font-semibold">
                  <dt>Estimasi total</dt>
                  <dd className="tabular-nums">{formatRupiah(subtotal + tax)}</dd>
                </div>
              </dl>
            </Panel>
          </aside>
        </div>
      )}

      {step === 2 && preview && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 rounded-[14px] bg-[#e4e2e2] p-3 shadow-card sm:p-8">
            <QuotationSheet quotation={preview} />
          </div>
          <aside className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
            <Panel title="Catatan untuk Sales Support">
              <Textarea
                aria-label="Catatan untuk Sales Support"
                rows={5}
                value={salesNotes}
                onChange={e => setSalesNotes(e.target.value)}
                placeholder="Urgensi, permintaan margin khusus, pesaing yang ikut tender…"
              />
              <p className="mt-2 text-xs text-ink-3">Harga final, HPP, dan tanda tangan diisi setelah disetujui Sales Support.</p>
            </Panel>
          </aside>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
        <Button
          variant="ghost"
          icon={step > 0 ? <ChevronLeft className="size-4" /> : undefined}
          onClick={() => (step === 0 ? navigate({ view: editing ? 'quotation-detail' : 'dashboard', id: editing?.id }) : setStep(s => s - 1))}
        >
          {step === 0 ? 'Batal' : 'Kembali'}
        </Button>
        <div className="flex items-center gap-4">
          {step > 0 && (
            <span className="hidden text-[13px] text-ink-2 sm:inline">
              Total <span className="font-semibold tabular-nums text-ink">{formatRupiah(subtotal + tax)}</span>
            </span>
          )}
          {step < 2 ? (
            <Button variant="primary" onClick={next}>
              {step === 0 ? 'Lanjut pilih produk' : 'Lanjut tinjau'}
            </Button>
          ) : (
            <Button variant="primary" loading={submitting} onClick={submit}>
              {editing ? 'Ajukan ulang' : 'Ajukan ke Sales Support'}
            </Button>
          )}
        </div>
      </div>

      {customDraft && (
        <NewRequestDrawer
          key={`${customDraft.productName}-${customDraft.estimatedQty}`}
          open
          initial={customDraft}
          onClose={() => setCustomDraft(null)}
          onPickProduct={id => addProduct(id, customDraft.estimatedQty)}
        />
      )}
    </div>
  );
}
