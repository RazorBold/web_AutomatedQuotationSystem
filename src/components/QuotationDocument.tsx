import React, { useState } from 'react';
import { Check, Copy, Download, Printer, Send, X } from 'lucide-react';
import type { Quotation } from '../types';
import { formatRupiah, formatWhatsAppQuotationMessage } from '../utils/quotationEngine';
import { buildWhatsAppTemplatePayload } from '../utils/whatsapp';
import { COMPANY, Signer, downloadQuotationPdf, getDirector, isIssued } from '../utils/quotationPdf';
import { AgustaLogo } from './AgustaLogo';
import { Button, Dialog, IconButton, ProductImage } from './ui';
import { errorMessage, useStore } from '../store/AppStore';

export { downloadQuotationPdf } from '../utils/quotationPdf';

export function useDirector(): Signer {
  const { users } = useStore();
  return getDirector(users);
}

/** Hand-drawn style e-signature mark, generated from the signer's name so each signer gets a stable shape. */
function Signature({ name }: { name: string }) {
  const seed = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  const a = 8 + (seed % 9);
  const b = 14 + (seed % 7);
  return (
    <svg viewBox="0 0 160 48" className="h-12 w-36" aria-label={`Tanda tangan elektronik ${name}`}>
      <path
        d={`M6 ${30 + (seed % 5)} C 20 ${a}, 30 ${44 - a}, 44 26 S 64 ${b}, 74 30 S 92 ${40 - (seed % 9)}, 104 22 S 128 ${12 + (seed % 11)}, 150 28`}
        fill="none"
        stroke="#1D2A6E"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d={`M40 38 L ${120 + (seed % 20)} 36`} stroke="#1D2A6E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** The official quotation letter, rendered as an A4 sheet. Never shows COGS or margin. */
export function QuotationSheet({ quotation: q }: { quotation: Quotation }) {
  const director = useDirector();
  const issued = isIssued(q);
  return (
    <article className="print-sheet relative mx-auto w-full max-w-[794px] bg-white px-8 py-9 text-[12.5px] leading-relaxed text-ink shadow-paper sm:px-14 sm:py-12">
      {!issued && (
        <p className="no-print -mx-8 -mt-9 mb-8 bg-amber-50 px-8 py-2 text-[11.5px] font-medium text-amber-900 sm:-mx-14 sm:-mt-12 sm:px-14">
          Draf. Harga final dan tanda tangan terisi setelah disetujui Sales Support.
        </p>
      )}

      <header className="flex flex-col gap-4 border-b-[3px] border-navy pb-4 sm:flex-row sm:items-end sm:justify-between">
        <AgustaLogo size="lg" />
        <div className="text-[11px] text-ink-2 sm:text-right">
          <p>{COMPANY.address}</p>
          <p>{COMPANY.contact}</p>
        </div>
      </header>

      <div className="mt-6 flex flex-col justify-between gap-6 sm:flex-row">
        <div>
          <p className="text-ink-3">Kepada Yth.</p>
          <p className="text-[14px] font-bold">{q.customer.companyName}</p>
          <p>u.p. {q.customer.contactPerson}</p>
          <p className="max-w-[40ch] text-ink-2">
            {q.customer.address}
            {q.customer.city && `, ${q.customer.city}`}
          </p>
        </div>
        <table className="h-fit text-[12px]">
          <tbody>
            {[
              ['Nomor', q.quotationNumber],
              ['Tanggal', q.date],
              ['Berlaku s.d.', q.validUntil],
              ['Perihal', 'Penawaran harga'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="pr-4 text-ink-3">{k}</td>
                <td className={k === 'Nomor' ? 'font-mono font-semibold' : 'font-medium'}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6">Dengan hormat,</p>
      <p className="mt-1 max-w-[75ch]">
        Bersama surat ini kami sampaikan penawaran harga untuk kebutuhan {q.customer.companyName} dengan rincian sebagai
        berikut:
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-navy text-left text-white">
              <th className="w-8 px-2 py-2 font-semibold">No</th>
              <th className="px-2 py-2 font-semibold">Produk &amp; spesifikasi</th>
              <th className="px-2 py-2 text-right font-semibold">Qty</th>
              <th className="px-2 py-2 text-right font-semibold">Harga satuan</th>
              <th className="px-2 py-2 text-right font-semibold">Disc.</th>
              <th className="px-2 py-2 text-right font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((it, i) => (
              <tr key={it.id} className="border-b border-line align-top">
                <td className="px-2 py-3 text-ink-3">{i + 1}</td>
                <td className="px-2 py-3">
                  <div className="flex gap-3">
                    <ProductImage src={it.image} alt="" hint={it.category} className="size-14 shrink-0 rounded border border-line" />
                    <div className="min-w-0">
                      <p className="font-semibold">{it.productName}</p>
                      <p className="text-[11px] text-ink-3">SKU {it.sku}</p>
                      {it.specs && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-2">{it.specs}</p>}
                      {it.notes && <p className="mt-0.5 text-[11px] italic text-ink-2">Catatan: {it.notes}</p>}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                  {it.qty} {it.unit}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{formatRupiah(it.sellingPrice)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{it.discountPercent ? `${it.discountPercent}%` : '–'}</td>
                <td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">{formatRupiah(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-[300px] text-[12.5px]">
          <div className="flex justify-between py-1">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="tabular-nums">{formatRupiah(q.subtotal)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ink-2">PPN {q.taxRatePercent}%</dt>
            <dd className="tabular-nums">{formatRupiah(q.taxAmount)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t-2 border-navy pt-2 text-[14px] font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatRupiah(q.grandTotal)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 max-w-[75ch] text-[11.5px] text-ink-2">
        <p className="font-semibold text-ink">Syarat &amp; ketentuan</p>
        <ol className="mt-1 list-decimal pl-4">
          <li>Harga sudah termasuk PPN {q.taxRatePercent}% dan pengiriman wilayah Jabodetabek.</li>
          <li>Penawaran berlaku sampai {q.validUntil}. Ketersediaan stok mengikuti saat PO diterima.</li>
          <li>Garansi resmi sesuai ketentuan masing-masing merek.</li>
        </ol>
      </div>

      <p className="mt-6">Demikian penawaran ini kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>

      <div className="mt-6 grid grid-cols-2 gap-8">
        {[
          { caption: 'Hormat kami,', name: q.salesName, title: 'Account Executive' },
          { caption: 'Mengetahui,', name: director.name, title: director.title },
        ].map(s => (
          <div key={s.caption}>
            <p>{s.caption}</p>
            <div className="flex h-16 items-end">{issued ? <Signature name={s.name} /> : <span className="text-[11px] text-ink-3">Menunggu persetujuan</span>}</div>
            <p className="mt-1 font-bold underline underline-offset-2">{s.name}</p>
            <p className="text-[11px] text-ink-2">{s.title}</p>
          </div>
        ))}
      </div>

      {issued && (
        <p className="mt-8 border-t border-line pt-3 text-[10.5px] text-ink-3">
          Ditandatangani secara elektronik melalui Agusta Quotation System. Disetujui oleh {q.reviewedBy} pada {q.reviewedAt}.
        </p>
      )}
    </article>
  );
}


export function PdfDialog({
  quotation,
  open,
  onClose,
  onSendWhatsApp,
}: {
  quotation: Quotation | null;
  open: boolean;
  onClose: () => void;
  onSendWhatsApp?: (q: Quotation) => void;
}) {
  const director = useDirector();
  if (!quotation) return null;
  return (
    <Dialog open={open} onClose={onClose} title={`Dokumen ${quotation.quotationNumber}`} width="max-w-[880px]" bare>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">Surat penawaran {quotation.customer.companyName}</p>
          <p className="font-mono text-xs text-ink-3">{quotation.quotationNumber}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} onClick={() => window.print()} className="hidden sm:inline-flex">
            Cetak
          </Button>
          {onSendWhatsApp && isIssued(quotation) && (
            <Button size="sm" icon={<Send className="size-4" />} onClick={() => onSendWhatsApp(quotation)}>
              WhatsApp
            </Button>
          )}
          <Button size="sm" variant="primary" icon={<Download className="size-4" />} onClick={() => downloadQuotationPdf(quotation, director)}>
            Unduh PDF
          </Button>
          <IconButton label="Tutup" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
      </div>
      <div className="max-h-[80vh] overflow-y-auto rounded-b-xl bg-[#e9ebef] p-3 sm:p-8">
        <QuotationSheet quotation={quotation} />
      </div>
    </Dialog>
  );
}

export function WhatsAppDialog({
  quotation,
  open,
  onClose,
}: {
  quotation: Quotation | null;
  open: boolean;
  onClose: () => void;
}) {
  const { sendWhatsApp, notify, currentUser } = useStore();
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  if (!quotation) return null;

  // The real PDF link is a short-lived signed URL created by the server at send time.
  const pdfUrl = '<link PDF dibuat server saat dikirim>';
  const message = formatWhatsAppQuotationMessage({
    salesName: quotation.salesName,
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customer.companyName,
    totalAmount: quotation.grandTotal,
    approvedBy: quotation.reviewedBy ?? currentUser?.name ?? 'Sales Support',
    approvalDate: quotation.reviewedAt ?? '',
    downloadUrl: pdfUrl,
  });
  const payload = buildWhatsAppTemplatePayload({
    salesName: quotation.salesName,
    salesPhone: quotation.salesPhone,
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customer.companyName,
    grandTotal: quotation.grandTotal,
    pdfUrl,
  });
  const alreadySent = quotation.status === 'PDF_SENT';

  const send = async () => {
    setSending(true);
    try {
      const res = await sendWhatsApp(quotation.id);
      notify(
        res.mode === 'live'
          ? `Dikirim ke WhatsApp ${quotation.salesName}.`
          : `Mode simulasi: pesan untuk ${quotation.salesName} dicatat, belum dikirim sungguhan.`,
        res.mode === 'live' ? 'success' : 'info'
      );
      onClose();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Kirim ke WhatsApp Sales"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" icon={<Send className="size-4" />} loading={sending} onClick={send}>
            {alreadySent ? 'Kirim ulang' : 'Kirim ke WhatsApp'}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-2">
        Penerima: <span className="font-semibold text-ink">{quotation.salesName}</span> · <span className="tabular-nums">{quotation.salesPhone}</span>.
        PDF dilampirkan sebagai dokumen.
      </p>

      <div className="mt-4 rounded-xl bg-[#ece5dd] p-4">
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#dcf8c6] p-3 text-[12.5px] leading-relaxed text-[#1f2c33] shadow-[0_1px_1px_rgb(0_0_0/0.12)]">
          <div className="mb-2 flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-2">
            <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</span>
            <span className="truncate font-medium">Penawaran_{quotation.quotationNumber}.pdf</span>
          </div>
          <p className="whitespace-pre-line">{message.replace(/\*/g, '').replace(/_/g, '')}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(message).catch(() => undefined);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-link hover:text-link-strong cursor-pointer"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Teks disalin' : 'Salin teks pesan'}
        </button>
        <button onClick={() => setShowPayload(v => !v)} className="text-[13px] font-medium text-ink-2 hover:text-ink cursor-pointer">
          {showPayload ? 'Sembunyikan payload API' : 'Lihat payload API'}
        </button>
      </div>
      {showPayload && (
        <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-2">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </Dialog>
  );
}
