import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, FileText, PencilLine, Send, Undo2 } from 'lucide-react';
import { errorMessage, useStore } from '../store/AppStore';
import { can } from '../auth/permissions';
import type { Quotation, QuotationItemData } from '../types';
import { Badge, Button, EmptyState, PageHeader, Panel, ProductImage, StatusBadge, Textarea, cx } from '../components/ui';
import { MarginValue, MARGIN_FLOOR } from '../components/QuotationTable';
import { PdfDialog, QuotationSheet, WhatsAppDialog, downloadQuotationPdf } from '../components/QuotationDocument';
import { calculateLineSubtotal, calculateQuotationTotals, formatRupiah, validateMarginSafety } from '../utils/quotationEngine';
import type { Route } from '../App';

const CATEGORY_LABEL = { BUMN_GOV: 'BUMN / Pemerintah', CORPORATE: 'Korporasi', EDUCATION: 'Pendidikan', RETAIL: 'Retail' } as const;

function Timeline({ q }: { q: Quotation }) {
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {(q.history ?? []).map((h, i, arr) => (
        <li key={i} className="relative pb-4 pl-5 last:pb-0">
          <span
            className={cx(
              'absolute -left-[5px] top-1.5 size-[9px] rounded-full ring-2 ring-surface',
              i === arr.length - 1 ? 'bg-link' : 'bg-line-strong'
            )}
          />
          <p className="text-[13px] font-medium text-ink">{h.label}</p>
          <p className="text-xs text-ink-3">
            {h.by} · {h.at}
          </p>
          {h.note && <p className="mt-1 rounded-md bg-canvas px-2.5 py-1.5 text-xs text-ink-2">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

function CustomerBlock({ q }: { q: Quotation }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
      <dt className="text-ink-3">Customer</dt>
      <dd className="font-semibold text-ink">{q.customer.companyName}</dd>
      <dt className="text-ink-3">Segmen</dt>
      <dd className="text-ink">{CATEGORY_LABEL[q.customer.category]}</dd>
      <dt className="text-ink-3">Kontak</dt>
      <dd className="text-ink">
        {q.customer.contactPerson}
        <span className="block text-ink-3">{q.customer.phone}</span>
      </dd>
      <dt className="text-ink-3">Sales</dt>
      <dd className="text-ink">{q.salesName}</dd>
      <dt className="text-ink-3">Berlaku s.d.</dt>
      <dd className="text-ink">{q.validUntil}</dd>
    </dl>
  );
}

const MONEY_INPUT =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-[13px] tabular-nums text-ink hover:border-ink-3/60 focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15';

function ReviewWorkspace({ q, navigate, onApproved }: { q: Quotation; navigate: (r: Route) => void; onApproved: () => void }) {
  const { approveQuotation, rejectQuotation, updateQuotationPricing, notify, discountRules } = useStore();
  const [items, setItems] = useState<QuotationItemData[]>(() => q.items.map(i => ({ ...i })));
  const [notes, setNotes] = useState(q.supportNotes ?? '');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [acceptLowMargin, setAcceptLowMargin] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | 'save' | null>(null);

  const floor = Math.min(MARGIN_FLOOR, ...discountRules.map(r => r.minMarginPercent));
  const totals = calculateQuotationTotals(items, true, 11);
  const lines = items.map(it => ({
    it,
    subtotal: calculateLineSubtotal(it),
    safety: validateMarginSafety(it.cogs, it.sellingPrice, it.discountPercent, floor),
  }));
  const unsafe = lines.filter(l => !l.safety.isSafe);
  const dirty = JSON.stringify(items) !== JSON.stringify(q.items) || notes !== (q.supportNotes ?? '');

  const patch = (idx: number, p: Partial<QuotationItemData>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const num = (v: string) => Math.max(0, Number(v.replace(/[^\d]/g, '')) || 0);

  const approve = async () => {
    setBusy('approve');
    try {
      const { delivery } = await approveQuotation(q.id, items, notes);
      if (!delivery.ok) {
        notify(`${q.quotationNumber} disetujui, tetapi WhatsApp gagal dikirim: ${delivery.error} Kirim ulang dari halaman ini.`, 'error');
      } else if (delivery.whatsapp.mode === 'live') {
        notify(`${q.quotationNumber} disetujui. PDF diterbitkan dan dikirim ke WhatsApp ${q.salesName}.`);
      } else {
        notify(`${q.quotationNumber} disetujui. PDF diterbitkan. WhatsApp masih mode simulasi.`, 'info');
      }
      onApproved();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (reason.trim().length < 10) {
      setReasonError('Tulis alasan minimal 10 karakter agar Sales tahu apa yang harus diperbaiki.');
      return;
    }
    setBusy('reject');
    try {
      await rejectQuotation(q.id, reason.trim());
      notify(`${q.quotationNumber} dikembalikan ke ${q.salesName} untuk revisi.`, 'info');
      navigate({ view: 'quotations' });
    } catch (e) {
      notify(errorMessage(e), 'error');
      setBusy(null);
    }
  };

  const savePricing = async () => {
    setBusy('save');
    try {
      await updateQuotationPricing(q.id, items, notes);
      notify('Perubahan harga disimpan.');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
      <div className="flex min-w-0 flex-col gap-6">
        {q.salesNotes && (
          <div className="rounded-[14px] border border-line/80 bg-surface px-5 py-4 shadow-card">
            <p className="text-[13px] font-semibold text-ink">Catatan dari {q.salesName}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{q.salesNotes}</p>
          </div>
        )}

        <Panel
          title="Item, HPP & harga final"
          description={`Margin per item dihitung dari harga setelah diskon. Batas aman ${floor}%.`}
          bodyClassName="overflow-x-auto"
        >
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-5 py-2.5 font-medium">Produk</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">HPP / unit</th>
                <th className="w-32 px-2 py-2.5 text-right font-medium">Harga jual / unit</th>
                <th className="w-16 px-2 py-2.5 text-right font-medium">Disc. %</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">Jumlah</th>
                <th className="w-24 px-4 py-2.5 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map(({ it, subtotal, safety }, idx) => (
                <tr key={it.id} className={cx('align-top', !safety.isSafe && 'bg-brand-soft/40')}>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <span className="hidden shrink-0 2xl:block"><ProductImage src={it.image} alt="" hint={it.category} className="size-12 rounded-md border border-line" /></span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug text-ink">{it.productName}</p>
                        <p className="text-xs text-ink-3">
                          {it.qty} {it.unit} · katalog {formatRupiah(it.basePrice)}
                        </p>
                        {it.notes && <p className="mt-0.5 text-xs text-ink-2">“{it.notes}”</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <input
                      aria-label={`HPP ${it.productName}`}
                      inputMode="numeric"
                      className={MONEY_INPUT}
                      value={it.cogs.toLocaleString('id-ID')}
                      onChange={e => patch(idx, { cogs: num(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <input
                      aria-label={`Harga jual ${it.productName}`}
                      inputMode="numeric"
                      className={MONEY_INPUT}
                      value={it.sellingPrice.toLocaleString('id-ID')}
                      onChange={e => patch(idx, { sellingPrice: num(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <input
                      aria-label={`Diskon ${it.productName}`}
                      inputMode="decimal"
                      className={MONEY_INPUT}
                      value={it.discountPercent}
                      onChange={e => patch(idx, { discountPercent: Math.min(100, Number(e.target.value.replace(',', '.')) || 0) })}
                    />
                  </td>
                  <td className="px-2 py-3 pt-5 text-right font-semibold tabular-nums text-ink">{formatRupiah(subtotal)}</td>
                  <td className="px-4 py-3 pt-5 text-right">
                    <MarginValue value={safety.currentMarginPercent} />
                    {!safety.isSafe && (
                      <p className="mt-0.5 whitespace-nowrap text-[11px] text-brand-strong">min. {formatRupiah(safety.minSellingPrice)}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Catatan Sales Support" description="Ikut tersimpan di riwayat. Tidak dicetak di PDF.">
          <Textarea
            aria-label="Catatan Sales Support"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Contoh: Harga Lenovo mengikuti promo distributor sampai 30 Nov."
          />
        </Panel>
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
        <Panel title="Ringkasan">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">PPN 11%</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
              <dt className="text-ink">Total penawaran</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.grandTotal)}</dd>
            </div>
          </dl>
          <dl className="mt-4 space-y-2 rounded-lg bg-canvas p-3.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Total HPP</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.totalCogs)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Laba kotor</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.grossProfit)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-ink-2">Margin kotor</dt>
              <dd>
                <MarginValue value={totals.grossMarginPercent} className="text-lg" />
              </dd>
            </div>
          </dl>

          {unsafe.length > 0 && (
            <div className="mt-4 rounded-lg bg-brand-soft px-3.5 py-3 text-[13px] text-brand-strong">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" /> {unsafe.length} item di bawah margin {floor}%
              </p>
              <p className="mt-1 text-[12.5px]">Naikkan harga jual atau kurangi diskon, atau setujui dengan konfirmasi di bawah.</p>
              <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[12.5px] text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--color-brand)]"
                  checked={acceptLowMargin}
                  onChange={e => setAcceptLowMargin(e.target.checked)}
                />
                Saya menyetujui margin di bawah batas untuk penawaran ini.
              </label>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button variant="primary" onClick={approve} loading={busy === 'approve'} disabled={(unsafe.length > 0 && !acceptLowMargin) || (busy !== null && busy !== 'approve')}>
              Setujui &amp; terbitkan PDF
            </Button>
            <p className="text-center text-xs text-ink-3">PDF langsung dikirim ke WhatsApp {q.salesName}.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={!dirty || busy !== null} loading={busy === 'save'} onClick={savePricing}>
                Simpan perubahan
              </Button>
              <Button variant="danger" icon={<Undo2 className="size-4" />} onClick={() => setRejecting(r => !r)} aria-expanded={rejecting}>
                Kembalikan
              </Button>
            </div>
          </div>

          {rejecting && (
            <div className="mt-4 border-t border-line pt-4 animate-fade-in">
              <label htmlFor="reject-reason" className="text-[13px] font-semibold text-ink">
                Apa yang perlu direvisi Sales?
              </label>
              <Textarea
                id="reject-reason"
                rows={3}
                className="mt-1.5"
                value={reason}
                aria-invalid={reasonError ? true : undefined}
                onChange={e => {
                  setReason(e.target.value);
                  setReasonError('');
                }}
                placeholder="Contoh: Diskon meja rapat maksimal 8% untuk segmen korporasi. Mohon sesuaikan."
              />
              {reasonError && <p className="mt-1 text-xs text-brand-strong">{reasonError}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Batal
                </Button>
                <Button size="sm" variant="danger" onClick={reject} loading={busy === 'reject'}>
                  Kembalikan ke Sales
                </Button>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Detail">
          <CustomerBlock q={q} />
        </Panel>

        <Panel title="Riwayat">
          <Timeline q={q} />
        </Panel>
      </aside>

    </div>
  );
}

export function QuotationDetailPage({ id, navigate }: { id: string; navigate: (r: Route) => void }) {
  const { quotations, currentUser, users } = useStore();
  const q = quotations.find(x => x.id === id);
  const [waOpen, setWaOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const director = useMemo(() => users.find(u => u.role === 'MANAGEMENT' && u.status === 'ACTIVE') ?? { name: 'Direktur Komersial', title: 'Direktur Komersial' }, [users]);

  const isReviewer = can(currentUser, 'quotation:review');
  const canSeeCogs = can(currentUser, 'cogs:view');
  const backLabel = isReviewer ? 'Antrean review' : 'Penawaran saya';

  if (!q || (!can(currentUser, 'quotation:view-all') && q.salesId !== currentUser?.id)) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="Penawaran tidak ditemukan"
        description="Penawaran ini mungkin sudah dihapus, atau bukan milik akun Anda."
        action={<Button onClick={() => navigate({ view: 'quotations' })}>Kembali ke {backLabel.toLowerCase()}</Button>}
      />
    );
  }

  const issued = q.status === 'APPROVED' || q.status === 'PDF_SENT';
  const reviewing = isReviewer && q.status === 'PENDING_REVIEW';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={q.customer.companyName}
        back={{ label: backLabel, onClick: () => navigate({ view: 'quotations' }) }}
        meta={
          <>
            <span className="font-mono">{q.quotationNumber}</span>
            <StatusBadge status={q.status} />
            <span>
              {q.items.length} item · {formatRupiah(q.grandTotal)}
            </span>
          </>
        }
        actions={
          !reviewing && (
            <>
              {issued && (
                <Button icon={<Download className="size-4" />} onClick={() => downloadQuotationPdf(q, director)}>
                  Unduh PDF
                </Button>
              )}
              {issued && isReviewer && (
                <Button variant="primary" icon={<Send className="size-4" />} onClick={() => setWaOpen(true)}>
                  {q.status === 'PDF_SENT' ? 'Kirim ulang WhatsApp' : 'Kirim ke WhatsApp'}
                </Button>
              )}
              {q.status === 'REJECTED' && q.salesId === currentUser?.id && (
                <Button variant="primary" icon={<PencilLine className="size-4" />} onClick={() => navigate({ view: 'create-quotation', id: q.id })}>
                  Revisi penawaran
                </Button>
              )}
            </>
          )
        }
      />

      {reviewing ? (
        <ReviewWorkspace q={q} navigate={navigate} onApproved={() => setPdfOpen(true)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-[14px] bg-[#e4e2e2] p-3 shadow-card sm:p-8">
            <QuotationSheet quotation={q} />
          </div>
          <aside className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
            {q.status === 'REJECTED' && (
              <div className="rounded-xl border border-brand/25 bg-brand-soft px-5 py-4">
                <p className="text-[13px] font-semibold text-brand-strong">Perlu revisi dari {q.reviewedBy}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{q.rejectionReason}</p>
              </div>
            )}
            {q.status === 'PENDING_REVIEW' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-900">
                Sedang direview Sales Support. Anda akan menerima PDF lewat WhatsApp begitu disetujui.
              </div>
            )}
            {canSeeCogs && (
              <Panel title="Data internal" actions={<Badge tone="gray">Tidak dicetak</Badge>}>
                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Total HPP</dt>
                    <dd className="tabular-nums">{formatRupiah(q.totalCogs)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Laba kotor</dt>
                    <dd className="tabular-nums">{formatRupiah(q.grossProfit)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Margin kotor</dt>
                    <dd>
                      <MarginValue value={q.grossMarginPercent} />
                    </dd>
                  </div>
                </dl>
                {q.supportNotes && <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-xs text-ink-2">{q.supportNotes}</p>}
              </Panel>
            )}
            <Panel title="Detail">
              <CustomerBlock q={q} />
            </Panel>
            <Panel title="Riwayat">
              <Timeline q={q} />
            </Panel>
          </aside>
        </div>
      )}

      <PdfDialog
        quotation={q}
        open={pdfOpen && !waOpen}
        onClose={() => setPdfOpen(false)}
        onSendWhatsApp={isReviewer ? () => setWaOpen(true) : undefined}
      />
      <WhatsAppDialog
        quotation={q}
        open={waOpen}
        onClose={() => {
          setWaOpen(false);
          setPdfOpen(false);
        }}
      />
    </div>
  );
}
