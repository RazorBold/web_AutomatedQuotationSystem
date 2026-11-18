import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CopyPlus, Download, FileText, PencilLine, Send, ShieldCheck, ShieldQuestion, Undo2 } from 'lucide-react';
import { errorMessage, useStore } from '../store/AppStore';
import { can } from '../auth/permissions';
import type { LetterSettings, Quotation, QuotationItemData } from '../types';
import { Badge, Button, EmptyState, PageHeader, Panel, ProductImage, StatusBadge, Textarea, cx } from '../components/ui';
import { MarginValue, MARGIN_FLOOR } from '../components/QuotationTable';
import { PdfDialog, QuotationSheet, WhatsAppDialog, downloadQuotationPdf, useSigner } from '../components/QuotationDocument';
import { calculateLineSubtotal, calculateQuotationTotals, formatRupiah, getSuggestedDiscount, validateMarginSafety } from '../utils/quotationEngine';
import type { Route } from '../App';
import { DiscountInput, RupiahInput } from '../components/DiscountInput';
import { ChargesEditor, chargeRows, chargesTotal, cleanCharges } from '../components/ChargesEditor';
import { LetterEditor, cleanLetter, letterProblems } from '../components/LetterEditor';
import { letterSettingsOf } from '../utils/letter';
import type { ChargeInput, QuotationAdjustments } from '../backend';
import { FollowUpPanel } from '../components/FollowUpPanel';

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
      <dd className="text-ink">{q.customer.category ? CATEGORY_LABEL[q.customer.category] : 'Tidak ditentukan'}</dd>
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

/** Escalation note from Sales Support and Management's decision (R7). */
function EscalationCard({ q }: { q: Quotation }) {
  const e = q.escalation;
  if (!e) return null;
  const pending = q.status === 'PENDING_MANAGEMENT';
  const tone = pending
    ? 'border-violet-200 bg-violet-50 text-violet-900'
    : e.decision === 'APPROVED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div className={cx('rounded-xl border px-5 py-4 text-[13px]', tone)}>
      <p className="flex items-center gap-1.5 font-semibold">
        {pending || !e.decision ? <ShieldQuestion className="size-4" /> : <ShieldCheck className="size-4" />}
        {pending
          ? 'Menunggu keputusan Management'
          : e.decision === 'APPROVED'
            ? `Disetujui Management · ${e.decidedBy}`
            : `Dikembalikan Management · ${e.decidedBy}`}
      </p>
      <p className="mt-1.5 text-xs opacity-80">
        Diteruskan oleh {e.by} · {e.at}
      </p>
      <p className="mt-1 leading-relaxed">“{e.note}”</p>
      {e.decisionNote && (
        <p className="mt-2 border-t border-current/15 pt-2 leading-relaxed">
          <span className="font-semibold">Catatan Management: </span>
          {e.decisionNote}
        </p>
      )}
    </div>
  );
}

/** Links between revisions (R5). */
function RevisionLinks({ q, navigate }: { q: Quotation; navigate: (r: Route) => void }) {
  const { quotations } = useStore();
  const older = q.revisionOf ? quotations.find(x => x.id === q.revisionOf) : undefined;
  const newer = q.revisedTo ? quotations.find(x => x.id === q.revisedTo) : undefined;
  if (!older && !newer) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4 text-[13px] shadow-card">
      {newer && (
        <p className="text-ink">
          Penawaran ini sudah direvisi. PDF lama tetap tersimpan sebagai arsip.
          <button onClick={() => navigate({ view: 'quotation-detail', id: newer.id })} className="mt-1 flex items-center gap-1 font-semibold text-link hover:text-link-strong cursor-pointer">
            Buka versi terbaru <span className="font-mono">{newer.quotationNumber}</span> <ArrowRight className="size-3.5" />
          </button>
        </p>
      )}
      {older && (
        <p className={cx('text-ink-2', newer && 'mt-3 border-t border-line pt-3')}>
          Revisi dari{' '}
          <button onClick={() => navigate({ view: 'quotation-detail', id: older.id })} className="font-mono font-semibold text-link hover:text-link-strong cursor-pointer">
            {older.quotationNumber}
          </button>
        </p>
      )}
    </div>
  );
}

const MONEY_INPUT =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-[13px] tabular-nums text-ink hover:border-ink-3/60 focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15';

type Mode = 'review' | 'management';

/**
 * Pricing workspace.
 *  - review: Sales Support on a quotation waiting for review — approve, return to Sales, or forward to Management.
 *  - management: Management on an escalated quotation — adjust pricing, approve or return to Sales Support.
 */
function ReviewWorkspace({ q, navigate, onApproved, mode }: { q: Quotation; navigate: (r: Route) => void; onApproved: () => void; mode: Mode }) {
  const {
    approveQuotation,
    rejectQuotation,
    updateQuotationPricing,
    escalateQuotation,
    decideQuotationEscalation,
    notify,
    discountRules,
    products,
  } = useStore();
  const [items, setItems] = useState<QuotationItemData[]>(() => q.items.map(i => ({ ...i })));
  const [notes, setNotes] = useState(q.supportNotes ?? '');
  const [panel, setPanel] = useState<'reject' | 'escalate' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [acceptLowMargin, setAcceptLowMargin] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | 'save' | 'escalate' | 'return' | null>(null);
  const initialCharges = chargeRows(q.charges);
  const initialLetter = letterSettingsOf(q);
  const [adj, setAdj] = useState<{ extraDiscount: number; letter: LetterSettings; charges: ChargeInput[] }>({
    extraDiscount: q.extraDiscount ?? 0,
    letter: initialLetter,
    charges: initialCharges,
  });

  const charges = cleanCharges(adj.charges);
  const totals = calculateQuotationTotals(items, true, 11, adj.extraDiscount, chargesTotal(charges));
  // Rules follow each item's brand (R12): margin floor and maximum discount per line.
  const lines = items.map(it => {
    const brand = products.find(p => p.id === it.productId)?.brand;
    const rule = getSuggestedDiscount(it.qty, brand, discountRules);
    const floor = Math.min(MARGIN_FLOOR, rule.minMarginPercent);
    return {
      it,
      brand,
      rule,
      floor,
      subtotal: calculateLineSubtotal(it),
      safety: validateMarginSafety(it.cogs, it.sellingPrice, it.discountPercent, floor),
      overMax: it.discountPercent > rule.maxAllowedPercent,
    };
  });
  const unsafe = lines.filter(l => !l.safety.isSafe);
  const overMax = lines.filter(l => l.overMax);
  const needsManagement = (unsafe.length > 0 || overMax.length > 0) && q.escalation?.decision !== 'APPROVED';

  const letter = cleanLetter(adj.letter);
  const letterError = letterProblems(adj.letter)[0];
  const adjustments: QuotationAdjustments = { extraDiscount: totals.extraDiscount, charges, letter };
  const adjChanged =
    adj.extraDiscount !== (q.extraDiscount ?? 0) ||
    JSON.stringify(letter) !== JSON.stringify(cleanLetter(initialLetter)) ||
    JSON.stringify(charges) !== JSON.stringify(cleanCharges(initialCharges));
  const dirty = JSON.stringify(items) !== JSON.stringify(q.items) || notes !== (q.supportNotes ?? '') || adjChanged;

  const patch = (idx: number, p: Partial<QuotationItemData>) => setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const num = (v: string) => Math.max(0, Number(v.replace(/[^\d]/g, '')) || 0);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    if (letterError && kind !== 'reject') {
      notify(letterError, 'error');
      return;
    }
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const approve = () =>
    run('approve', async () => {
      const { delivery } = await approveQuotation(q.id, items, notes, adjustments);
      if (!delivery.ok) {
        notify(`${q.quotationNumber} disetujui, tetapi WhatsApp gagal dikirim: ${delivery.error} Kirim ulang dari halaman ini.`, 'error');
      } else if (delivery.whatsapp.mode === 'live') {
        notify(`${q.quotationNumber} disetujui. PDF diterbitkan dan dikirim ke WhatsApp ${q.salesName}.`);
      } else {
        notify(`${q.quotationNumber} disetujui. PDF diterbitkan. WhatsApp masih mode simulasi.`, 'info');
      }
      onApproved();
    });

  const needReason = (min: number, msg: string) => {
    if (reason.trim().length < min) {
      setReasonError(msg);
      return false;
    }
    return true;
  };

  const submitPanel = () => {
    if (panel === 'reject') {
      if (!needReason(10, 'Tulis alasan minimal 10 karakter agar Sales tahu apa yang harus diperbaiki.')) return;
      void run('reject', async () => {
        await rejectQuotation(q.id, reason.trim());
        notify(`${q.quotationNumber} dikembalikan ke ${q.salesName} untuk revisi.`, 'info');
        navigate({ view: 'quotations' });
      });
    } else if (panel === 'escalate') {
      if (!needReason(5, 'Tulis alasan untuk Management, mis. diskon tambahan di luar standar.')) return;
      void run('escalate', async () => {
        await escalateQuotation(q.id, reason.trim(), items, notes, adjustments);
        notify(`${q.quotationNumber} diteruskan ke Management.`, 'info');
        navigate({ view: 'quotations' });
      });
    } else if (panel === 'return') {
      if (!needReason(5, 'Tulis catatan untuk Sales Support.')) return;
      void run('return', async () => {
        await decideQuotationEscalation(q.id, 'RETURNED', reason.trim(), items, adjustments);
        notify(`${q.quotationNumber} dikembalikan ke Sales Support.`, 'info');
        navigate({ view: 'quotations' });
      });
    }
  };

  const managementApprove = () =>
    run('approve', async () => {
      await decideQuotationEscalation(q.id, 'APPROVED', reason.trim(), items, adjustments);
      notify(`Harga ${q.quotationNumber} disetujui. Sales Support akan menerbitkan PDF final.`);
      navigate({ view: 'quotations' });
    });

  const savePricing = () =>
    run('save', async () => {
      await updateQuotationPricing(q.id, items, notes, adjustments);
      notify('Perubahan harga disimpan.');
    });

  const PANEL_TEXT = {
    reject: { label: 'Apa yang perlu direvisi Sales?', placeholder: 'Contoh: Diskon meja rapat maksimal 8%. Mohon sesuaikan.', submit: 'Kembalikan ke Sales' },
    escalate: {
      label: 'Alasan diteruskan ke Management',
      placeholder: 'Contoh: Customer minta diskon tambahan 12% di luar standar, tender 50 unit.',
      submit: 'Teruskan ke Management',
    },
    return: { label: 'Catatan untuk Sales Support', placeholder: 'Contoh: Diskon maksimal 10%, ongkir ditanggung customer.', submit: 'Kembalikan ke Sales Support' },
  } as const;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
      <div className="flex min-w-0 flex-col gap-6">
        {mode === 'management' && <EscalationCard q={q} />}
        {mode === 'review' && q.escalation?.decision && <EscalationCard q={q} />}
        {q.salesNotes && (
          <div className="rounded-[14px] border border-line/80 bg-surface px-5 py-4 shadow-card">
            <p className="text-[13px] font-semibold text-ink">Catatan dari {q.salesName}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{q.salesNotes}</p>
          </div>
        )}

        <Panel
          title="Item, HPP & harga final"
          description="Margin per item dihitung dari harga setelah diskon. Batas diskon & margin mengikuti aturan merek."
          bodyClassName="overflow-x-auto"
        >
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-5 py-2.5 font-medium">Produk</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">HPP / unit</th>
                <th className="w-32 px-2 py-2.5 text-right font-medium">Harga jual / unit</th>
                <th className="w-44 px-2 py-2.5 text-right font-medium">Diskon (% / Rp per unit)</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">Jumlah</th>
                <th className="w-24 px-4 py-2.5 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map(({ it, brand, rule, safety, overMax: over }, idx) => (
                <tr key={it.id} className={cx('align-top', (!safety.isSafe || over) && 'bg-brand-soft/40')}>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <span className="hidden shrink-0 2xl:block">
                        <ProductImage src={it.image} alt="" hint={it.category} className="size-12 rounded-md border border-line" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug text-ink">{it.productName}</p>
                        <p className="text-xs text-ink-3">
                          {it.qty} {it.unit} · katalog {formatRupiah(it.basePrice)} · {brand || 'merek lain'}
                        </p>
                        {it.notes && <p className="mt-0.5 text-xs text-ink-2">“{it.notes}”</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <input aria-label={`HPP ${it.productName}`} inputMode="numeric" className={MONEY_INPUT} value={it.cogs.toLocaleString('id-ID')} onChange={e => patch(idx, { cogs: num(e.target.value) })} />
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
                  <td className="px-2 py-3 text-right">
                    <DiscountInput label={`Diskon ${it.productName}`} percent={it.discountPercent} unitPrice={it.sellingPrice} warn={over} onChange={discountPercent => patch(idx, { discountPercent })} />
                    <p className={cx('mt-1 text-[11px]', over ? 'text-brand-strong' : 'text-ink-3')}>maks. {rule.maxAllowedPercent}%</p>
                  </td>
                  <td className="px-2 py-3 pt-5 text-right font-semibold tabular-nums text-ink">{formatRupiah(it.qty ? calculateLineSubtotal(it) : 0)}</td>
                  <td className="px-4 py-3 pt-5 text-right">
                    <MarginValue value={safety.currentMarginPercent} />
                    {!safety.isSafe && <p className="mt-0.5 whitespace-nowrap text-[11px] text-brand-strong">min. {formatRupiah(safety.minSellingPrice)}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Jasa & biaya tambahan" description="Jasa pasang, pengiriman, testing, dan sebagainya. Dicetak sebagai baris bernomor di tabel. Centang Termasuk bila tanpa biaya. Kena PPN, tidak kena diskon, tidak dihitung di margin.">
          <ChargesEditor charges={adj.charges} onChange={c => setAdj(a => ({ ...a, charges: c }))} />
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
              <dt className="text-ink-2">Total item</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.itemsTotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Diskon tambahan (Rp)</dt>
              <dd>
                <RupiahInput
                  label="Diskon tambahan untuk seluruh penawaran"
                  value={adj.extraDiscount}
                  max={totals.itemsTotal}
                  onChange={extraDiscount => setAdj(a => ({ ...a, extraDiscount }))}
                  className="w-32"
                />
              </dd>
            </div>
            {totals.chargesTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-2">Biaya tambahan</dt>
                <dd className="tabular-nums text-ink">{formatRupiah(totals.chargesTotal)}</dd>
              </div>
            )}
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
              <dt className="text-ink-2">Laba kotor (barang)</dt>
              <dd className="tabular-nums text-ink">{formatRupiah(totals.grossProfit)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-ink-2">Margin kotor</dt>
              <dd>
                <MarginValue value={totals.grossMarginPercent} className="text-lg" />
              </dd>
            </div>
          </dl>

          <details className="group mt-4 rounded-lg border border-line" open>
            <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[13px] font-semibold text-ink marker:hidden">Format surat</summary>
            <div className="border-t border-line px-3.5 py-3.5">
              <LetterEditor value={adj.letter} onChange={l => setAdj(a => ({ ...a, letter: l }))} />
            </div>
          </details>

          {mode === 'review' && needsManagement && (
            <div className="mt-4 rounded-lg bg-violet-50 px-3.5 py-3 text-[13px] text-violet-900">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldQuestion className="size-4" /> Disarankan diteruskan ke Management
              </p>
              <p className="mt-1 text-[12.5px]">
                {overMax.length > 0 && `${overMax.length} item diskonnya di atas batas aturan merek. `}
                {unsafe.length > 0 && `${unsafe.length} item margin di bawah batas aman.`}
              </p>
            </div>
          )}

          {mode === 'review' && unsafe.length > 0 && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12.5px] text-ink">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" checked={acceptLowMargin} onChange={e => setAcceptLowMargin(e.target.checked)} />
              <span className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-brand-strong" />
                Saya menyetujui margin di bawah batas untuk penawaran ini tanpa eskalasi.
              </span>
            </label>
          )}

          <div className="mt-5 flex flex-col gap-2">
            {mode === 'review' ? (
              <>
                <Button
                  variant="primary"
                  onClick={approve}
                  loading={busy === 'approve'}
                  disabled={(unsafe.length > 0 && !acceptLowMargin && q.escalation?.decision !== 'APPROVED') || (busy !== null && busy !== 'approve')}
                >
                  Setujui &amp; terbitkan PDF
                </Button>
                <p className="text-center text-xs text-ink-3">PDF langsung dikirim ke WhatsApp {q.salesName}.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={!dirty || busy !== null} loading={busy === 'save'} onClick={savePricing}>
                    Simpan perubahan
                  </Button>
                  <Button variant="danger" icon={<Undo2 className="size-4" />} onClick={() => setPanel(p => (p === 'reject' ? null : 'reject'))} aria-expanded={panel === 'reject'}>
                    Kembalikan
                  </Button>
                </div>
                <Button icon={<ShieldQuestion className="size-4" />} onClick={() => setPanel(p => (p === 'escalate' ? null : 'escalate'))} aria-expanded={panel === 'escalate'}>
                  Teruskan ke Management
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" icon={<ShieldCheck className="size-4" />} onClick={managementApprove} loading={busy === 'approve'} disabled={busy !== null && busy !== 'approve'}>
                  Setujui harga
                </Button>
                <p className="text-center text-xs text-ink-3">Kembali ke Sales Support untuk diterbitkan PDF final.</p>
                <Button variant="danger" icon={<Undo2 className="size-4" />} onClick={() => setPanel(p => (p === 'return' ? null : 'return'))} aria-expanded={panel === 'return'}>
                  Kembalikan ke Sales Support
                </Button>
              </>
            )}
          </div>

          {panel && (
            <div className="mt-4 border-t border-line pt-4 animate-fade-in">
              <label htmlFor="panel-reason" className="text-[13px] font-semibold text-ink">
                {PANEL_TEXT[panel].label}
              </label>
              <Textarea
                id="panel-reason"
                rows={3}
                className="mt-1.5"
                value={reason}
                aria-invalid={reasonError ? true : undefined}
                onChange={e => {
                  setReason(e.target.value);
                  setReasonError('');
                }}
                placeholder={PANEL_TEXT[panel].placeholder}
              />
              {reasonError && <p className="mt-1 text-xs text-brand-strong">{reasonError}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>
                  Batal
                </Button>
                <Button size="sm" variant={panel === 'escalate' ? 'secondary' : 'danger'} onClick={submitPanel} loading={busy === panel || (panel === 'reject' && busy === 'reject')}>
                  {PANEL_TEXT[panel].submit}
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
  const { quotations, currentUser, users, createQuotationRevision, notify } = useStore();
  const q = quotations.find(x => x.id === id);
  const [waOpen, setWaOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [revising, setRevising] = useState(false);
  const signer = useSigner(q ?? null);

  const isReviewer = can(currentUser, 'quotation:review');
  const isManagement = currentUser?.role === 'MANAGEMENT';
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
  const isOwner = q.salesId === currentUser?.id;
  const mode: Mode | null =
    isReviewer && q.status === 'PENDING_REVIEW' ? 'review' : isManagement && q.status === 'PENDING_MANAGEMENT' ? 'management' : null;
  const canRevise = issued && (isReviewer || isOwner);

  const createRevision = async () => {
    if (!window.confirm(`Buat revisi ${q.quotationNumber}? Versi ini akan diarsipkan dan revisi baru perlu direview ulang.`)) return;
    setRevising(true);
    try {
      const newId = await createQuotationRevision(q.id);
      notify('Revisi dibuat. Versi lama tersimpan sebagai arsip.', 'info');
      navigate(isReviewer ? { view: 'quotation-detail', id: newId } : { view: 'create-quotation', id: newId });
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setRevising(false);
    }
  };

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
          !mode && (
            <>
              {(issued || q.status === 'REVISED') && q.pdfGeneratedAt && (
                <Button icon={<Download className="size-4" />} onClick={() => downloadQuotationPdf(q, signer)}>
                  {q.status === 'REVISED' ? 'Unduh PDF arsip' : 'Unduh PDF'}
                </Button>
              )}
              {canRevise && (
                <Button icon={<CopyPlus className="size-4" />} onClick={createRevision} loading={revising}>
                  Buat revisi
                </Button>
              )}
              {issued && isReviewer && (
                <Button variant="primary" icon={<Send className="size-4" />} onClick={() => setWaOpen(true)}>
                  {q.status === 'PDF_SENT' ? 'Kirim ulang WhatsApp' : 'Kirim ke WhatsApp'}
                </Button>
              )}
              {(q.status === 'REJECTED' || q.status === 'DRAFT') && isOwner && (
                <Button variant="primary" icon={<PencilLine className="size-4" />} onClick={() => navigate({ view: 'create-quotation', id: q.id })}>
                  {q.status === 'DRAFT' ? 'Lanjutkan revisi' : 'Revisi penawaran'}
                </Button>
              )}
            </>
          )
        }
      />

      {mode ? (
        <ReviewWorkspace key={`${q.id}-${q.status}`} q={q} navigate={navigate} onApproved={() => setPdfOpen(true)} mode={mode} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-[14px] bg-[#e4e2e2] p-3 shadow-card sm:p-8">
            <QuotationSheet quotation={q} />
          </div>
          <aside className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
            <RevisionLinks q={q} navigate={navigate} />
            {q.status === 'REJECTED' && (
              <div className="rounded-xl border border-brand/25 bg-brand-soft px-5 py-4">
                <p className="text-[13px] font-semibold text-brand-strong">Perlu revisi dari {q.reviewedBy}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{q.rejectionReason}</p>
              </div>
            )}
            {q.status === 'DRAFT' && (
              <div className="rounded-xl border border-line bg-surface px-5 py-4 text-[13px] text-ink-2 shadow-card">
                Draf revisi. Ubah bila perlu, lalu ajukan ulang ke Sales Support.
              </div>
            )}
            {q.status === 'PENDING_REVIEW' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-900">
                Sedang direview Sales Support. Anda akan menerima PDF lewat WhatsApp begitu disetujui.
              </div>
            )}
            {q.status === 'PENDING_MANAGEMENT' && !isReviewer && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-4 text-[13px] text-violet-900">
                Harga sedang dihitung bersama Management. Anda akan menerima PDF lewat WhatsApp begitu disetujui.
              </div>
            )}
            {isReviewer && <EscalationCard q={q} />}
            {issued && <FollowUpPanel key={`${q.id}-${q.followUps?.length ?? 0}`} q={q} />}
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

      <PdfDialog quotation={q} open={pdfOpen && !waOpen} onClose={() => setPdfOpen(false)} onSendWhatsApp={isReviewer ? () => setWaOpen(true) : undefined} />
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
