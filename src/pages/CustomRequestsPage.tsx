import React, { useMemo, useState } from 'react';
import { FilePlus2, MessageSquarePlus, PackageOpen } from 'lucide-react';
import type { Route } from '../App';
import { errorMessage, useStore, useVisibleProducts } from '../store/AppStore';
import { can } from '../auth/permissions';
import type { CustomProductRequest, CustomRequestStatus } from '../types';
import { Badge, Button, Drawer, EmptyState, Field, Input, PageHeader, Panel, ProductImage, REQUEST_STATUS_META, Select, Textarea, cx } from '../components/ui';
import { MarginValue } from '../components/QuotationTable';
import { formatRupiah } from '../utils/quotationEngine';
import { suggestProducts } from '../utils/smartSearch';

export const CATEGORIES = ['Kursi Kantor', 'Kursi Tunggu', 'Meja Kerja', 'Meja Kerja Partisi', 'Meja Rapat', 'Lemari Arsip', 'AIO', 'Laptop', 'Proyektor', 'Lainnya'];
const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;

/** Catalog products that already match what is being typed, so Sales doesn't request what exists. */
function CatalogMatches({ text, onPick }: { text: string; onPick: (productId: string) => void }) {
  const products = useVisibleProducts();
  const matches = useMemo(() => {
    if (text.trim().length < 4) return [];
    return suggestProducts(products, text, 3)
      .flatMap(r => r.suggestions)
      .filter(s => s.confidence !== 'low')
      .slice(0, 3);
  }, [products, text]);
  if (!matches.length) return null;
  return (
    <div className="rounded-xl border border-link/25 bg-link-soft/40 p-3">
      <p className="text-[13px] font-semibold text-ink">Mungkin sudah ada di katalog</p>
      <p className="mt-0.5 text-xs text-ink-2">Pakai produk katalog jika cocok. Harganya sudah ada, jadi penawaran lebih cepat.</p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {matches.map(s => (
          <li key={s.product.id} className="flex items-center gap-3 rounded-lg bg-surface p-2">
            <ProductImage src={s.product.image} alt="" hint={s.product.category} className="size-10 shrink-0 rounded-md border border-line" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">{s.product.name}</span>
              <span className="block truncate text-xs text-ink-3">
                {formatRupiah(s.product.basePrice)} · {s.reasons.join(' · ')}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onPick(s.product.id)}>
              Pakai ini
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NewRequestDrawer({
  open,
  onClose,
  initial,
  onPickProduct,
}: {
  open: boolean;
  onClose: () => void;
  /** Prefill, e.g. from the wizard when the catalog has no match. */
  initial?: { productName?: string; estimatedQty?: number; category?: string };
  /** Called when the rep picks an existing catalog product instead. */
  onPickProduct?: (productId: string) => void;
}) {
  const { submitCustomRequest, notify } = useStore();
  const empty = { productName: '', category: CATEGORIES[0]!, estimatedQty: 1, targetPricePerUnit: 0, specs: '', referenceUrlOrNotes: '' };
  const [form, setForm] = useState(() => ({ ...empty, ...initial }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.productName.trim()) e.productName = 'Isi nama barang yang dibutuhkan.';
    if (form.specs.trim().length < 15) e.specs = 'Jelaskan spesifikasi minimal 15 karakter: ukuran, material, warna.';
    if (form.estimatedQty < 1) e.estimatedQty = 'Jumlah minimal 1.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    submitCustomRequest(form)
      .then(() => {
        notify('Request barang custom dikirim ke Sales Support.');
        setForm(empty);
        onClose();
      })
      .catch(err => notify(errorMessage(err), 'error'))
      .finally(() => setSaving(false));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ajukan barang custom"
      description="Untuk barang yang belum ada di katalog. Sales Support akan menghitung HPP dan harga jualnya."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Kirim request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Nama barang" error={errors.productName}>
          {p => <Input {...p} value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} placeholder="Meja kerja partisi 4 staff + panel akustik" />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kategori">
            {p => (
              <Select {...p} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Estimasi jumlah" error={errors.estimatedQty}>
            {p => <Input {...p} inputMode="numeric" className="tabular-nums" value={form.estimatedQty} onChange={e => setForm({ ...form, estimatedQty: num(e.target.value) })} />}
          </Field>
        </div>
        <Field label="Target harga per unit" optional hint="Harga yang diharapkan customer, jika ada.">
          {p => (
            <Input {...p} inputMode="numeric" className="tabular-nums" value={form.targetPricePerUnit ? form.targetPricePerUnit.toLocaleString('id-ID') : ''} onChange={e => setForm({ ...form, targetPricePerUnit: num(e.target.value) })} placeholder="7.500.000" />
          )}
        </Field>
        <Field label="Spesifikasi" error={errors.specs}>
          {p => <Textarea {...p} rows={4} value={form.specs} onChange={e => setForm({ ...form, specs: e.target.value })} placeholder="Dimensi 280 × 140 cm, top MFC 25 mm white oak, rangka hollow 50 × 50 powder coating putih…" />}
        </Field>
        <Field label="Referensi atau catatan" optional>
          {p => <Textarea {...p} rows={2} value={form.referenceUrlOrNotes} onChange={e => setForm({ ...form, referenceUrlOrNotes: e.target.value })} placeholder="Link katalog, nama arsitek, foto referensi…" />}
        </Field>
        {onPickProduct && (
          <CatalogMatches
            text={`${form.estimatedQty > 1 ? `${form.estimatedQty} ` : ''}${form.productName} ${form.specs}`}
            onPick={id => {
              onPickProduct(id);
              onClose();
            }}
          />
        )}
      </div>
    </Drawer>
  );
}

function PricingDrawer({ request, onClose }: { request: CustomProductRequest | null; onClose: () => void }) {
  const { priceCustomRequest, notify } = useStore();
  const [cogs, setCogs] = useState(0);
  const [price, setPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  const [saving, setSaving] = useState<CustomRequestStatus | null>(null);
  if (request && request.id !== lastId) {
    setLastId(request.id);
    setCogs(request.assignedCogs ?? 0);
    setPrice(request.assignedSellingPrice ?? request.targetPricePerUnit);
    setNotes(request.supportNotes ?? '');
  }
  if (!request) return null;
  const margin = price > 0 ? ((price - cogs) / price) * 100 : 0;

  const save = (status: CustomRequestStatus) => {
    setSaving(status);
    priceCustomRequest(request.id, { assignedCogs: cogs, assignedSellingPrice: price, supportNotes: notes, status })
      .then(() => {
        notify(
          status === 'REJECTED'
            ? 'Request ditandai tidak dapat diproses.'
            : status === 'APPROVED'
              ? 'Harga barang custom disetujui dan masuk katalog.'
              : 'Harga disimpan.'
        );
        onClose();
      })
      .catch(err => notify(errorMessage(err), 'error'))
      .finally(() => setSaving(null));
  };

  return (
    <Drawer
      open={!!request}
      onClose={onClose}
      title={request.productName}
      description={`Dari ${request.salesName} · ${request.submittedAt}`}
      footer={
        <>
          <Button variant="danger" onClick={() => save('REJECTED')} loading={saving === 'REJECTED'} disabled={!!saving} className="mr-auto">
            Tidak dapat diproses
          </Button>
          <Button onClick={() => save('PRICED')} loading={saving === 'PRICED'} disabled={!cogs || !price || !!saving}>
            Simpan harga
          </Button>
          <Button variant="primary" onClick={() => save('APPROVED')} loading={saving === 'APPROVED'} disabled={!cogs || !price || !!saving}>
            Setujui harga
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
        <dt className="text-ink-3">Kategori</dt>
        <dd>{request.category}</dd>
        <dt className="text-ink-3">Estimasi jumlah</dt>
        <dd className="tabular-nums">{request.estimatedQty} unit</dd>
        <dt className="text-ink-3">Target harga</dt>
        <dd className="tabular-nums">{request.targetPricePerUnit ? formatRupiah(request.targetPricePerUnit) : '–'}</dd>
        <dt className="text-ink-3">Spesifikasi</dt>
        <dd className="leading-relaxed">{request.specs}</dd>
        {request.referenceUrlOrNotes && (
          <>
            <dt className="text-ink-3">Referensi</dt>
            <dd>{request.referenceUrlOrNotes}</dd>
          </>
        )}
      </dl>

      <div className="mt-6 rounded-xl border border-line p-4">
        <p className="text-sm font-semibold text-ink">Perhitungan harga</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="HPP / unit">
            {p => <Input {...p} inputMode="numeric" className="text-right tabular-nums" value={cogs ? cogs.toLocaleString('id-ID') : ''} onChange={e => setCogs(num(e.target.value))} />}
          </Field>
          <Field label="Harga jual / unit">
            {p => <Input {...p} inputMode="numeric" className="text-right tabular-nums" value={price ? price.toLocaleString('id-ID') : ''} onChange={e => setPrice(num(e.target.value))} />}
          </Field>
        </div>
        <div className="mt-3 flex justify-between text-[13px]">
          <span className="text-ink-2">Margin</span>
          {cogs && price ? <MarginValue value={margin} /> : <span className="text-ink-3">Isi HPP dan harga jual</span>}
        </div>
        <div className="mt-1 flex justify-between text-[13px]">
          <span className="text-ink-2">Nilai estimasi ({request.estimatedQty} unit)</span>
          <span className="font-semibold tabular-nums">{formatRupiah(price * request.estimatedQty)}</span>
        </div>
      </div>

      <Field label="Catatan untuk Sales" optional className="mt-5">
        {p => <Textarea {...p} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Lead time produksi 4 minggu, DP 50%." />}
      </Field>
    </Drawer>
  );
}

export function CustomRequestsPage({ navigate }: { navigate: (r: Route) => void }) {
  const { currentUser, customRequests } = useStore();
  const canPrice = can(currentUser, 'custom-request:price');
  const canQuote = can(currentUser, 'quotation:create');
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = canPrice ? customRequests : customRequests.filter(r => r.salesId === currentUser?.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Barang custom"
        description={
          canPrice
            ? 'Request barang di luar katalog dari tim Sales. Hitung HPP dan harga jual, lalu setujui.'
            : 'Barang di luar katalog yang Anda ajukan. Harga dari Sales Support muncul di sini.'
        }
        actions={
          can(currentUser, 'custom-request:create') && (
            <Button variant="primary" icon={<MessageSquarePlus className="size-4" />} onClick={() => setNewOpen(true)}>
              Ajukan barang custom
            </Button>
          )
        }
      />

      <Panel bodyClassName="">
        {list.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="size-5" />}
            title="Belum ada request"
            description="Jika customer meminta barang yang tidak ada di katalog, ajukan spesifikasinya di sini."
            action={
              can(currentUser, 'custom-request:create') ? (
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  Ajukan barang custom
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map(r => {
              const meta = REQUEST_STATUS_META[r.status];
              const clickable = canPrice;
              const Row = clickable ? 'button' : 'div';
              return (
                <li key={r.id}>
                  <Row
                    {...(clickable ? { onClick: () => setOpenId(r.id) } : {})}
                    className={cx(
                      'grid w-full gap-x-6 gap-y-2 px-5 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto]',
                      clickable && 'transition-colors hover:bg-canvas cursor-pointer'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{r.productName}</span>
                      <span className="mt-0.5 line-clamp-1 block text-[13px] text-ink-2">{r.specs}</span>
                      <span className="mt-1 block text-xs text-ink-3">
                        {r.category} · {r.estimatedQty} unit · {canPrice ? `${r.salesName} · ` : ''}
                        {r.submittedAt}
                      </span>
                    </span>
                    <span className="text-left sm:text-right">
                      <span className="block text-xs text-ink-3">{r.assignedSellingPrice ? 'Harga dari Sales Support' : 'Target harga'}</span>
                      <span className="block font-semibold tabular-nums text-ink">
                        {formatRupiah(r.assignedSellingPrice ?? r.targetPricePerUnit)}
                      </span>
                    </span>
                    <span className="self-center">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </span>
                    {!canPrice && r.supportNotes && (
                      <span className="rounded-md bg-canvas px-3 py-2 text-xs text-ink-2 sm:col-span-3">Catatan Sales Support: {r.supportNotes}</span>
                    )}
                    {canQuote && r.status === 'APPROVED' && r.productId && (
                      <span className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
                        <span className="text-xs text-ink-2">Harga sudah disetujui. Barang ini sekarang bisa dipilih di penawaran.</span>
                        <Button size="sm" icon={<FilePlus2 className="size-4" />} onClick={() => navigate({ view: 'create-quotation', productId: r.productId })}>
                          Buat penawaran
                        </Button>
                      </span>
                    )}
                  </Row>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <NewRequestDrawer
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onPickProduct={productId => navigate({ view: 'create-quotation', productId })}
      />
      {canPrice && <PricingDrawer request={customRequests.find(r => r.id === openId) ?? null} onClose={() => setOpenId(null)} />}
    </div>
  );
}
