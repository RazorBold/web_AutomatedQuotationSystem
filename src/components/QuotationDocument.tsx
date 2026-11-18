import React, { useState } from 'react';
import { Check, Copy, Download, Printer, Send, X } from 'lucide-react';
import type { Quotation } from '../types';
import { formatRupiah, formatWhatsAppQuotationMessage } from '../utils/quotationEngine';
import { buildWhatsAppTemplatePayload } from '../utils/whatsapp';
import { Signer, downloadQuotationPdf, isIssued, signerFor } from '../utils/quotationPdf';
import { customerAddress, documentView } from '../utils/quotationView';
import { letterDate, letterNumber, letterSubject, quotationFileName } from '../utils/letter';
import { AgustaLogo } from './AgustaLogo';
import { Button, Dialog, IconButton, ProductImage } from './ui';
import { errorMessage, useStore } from '../store/AppStore';

export { downloadQuotationPdf } from '../utils/quotationPdf';

/** Who signs the letter: the Sales person who made it (Agusta's practice). */
export function useSigner(q: Quotation | null): Signer {
  const { users, currentUser } = useStore();
  return signerFor(q, currentUser ? [currentUser, ...users] : users);
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

const money = (v: number | null) => (v === null ? 'Termasuk' : formatRupiah(v));
const CELL = 'border border-ink/70 px-2 py-1.5';

/** The official quotation letter in Agusta's format, rendered as an A4 sheet. Never shows COGS or margin. */
export function QuotationSheet({ quotation: q }: { quotation: Quotation }) {
  const signer = useSigner(q);
  const { settings } = useStore();
  const issued = isIssued(q);
  const view = documentView(q, settings);
  const COMPANY = view.company;
  const address = customerAddress(q);
  const cols = view.showDiscount ? 6 : 5;
  return (
    <article className="print-sheet relative mx-auto w-full max-w-[794px] bg-white px-8 py-9 text-[12.5px] leading-relaxed text-ink shadow-paper sm:px-14 sm:py-12">
      {!issued && (
        <p className="no-print -mx-8 -mt-9 mb-8 bg-amber-50 px-8 py-2 text-[11.5px] font-medium text-amber-900 sm:-mx-14 sm:-mt-12 sm:px-14">
          Draf. Harga final dan tanda tangan terisi setelah disetujui Sales Support.
        </p>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AgustaLogo size="lg" />
        <div className="text-[10.5px] leading-snug text-ink-2">
          <p className="font-bold text-ink">{COMPANY.name}</p>
          <p>{COMPANY.street}</p>
          <p>{COMPANY.city}</p>
          <p>{COMPANY.country}</p>
          <table className="mt-1.5">
            <tbody>
              {[
                ['Telephone', COMPANY.phone],
                ['WA Center', COMPANY.whatsapp],
                ['Email', COMPANY.email],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="pr-3">{k}</td>
                  <td className={k === 'Email' ? 'font-bold text-ink' : ''}>: {v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </header>

      <p className="mt-7">
        {COMPANY.place}, {letterDate(q)}
      </p>
      <table className="mt-2">
        <tbody>
          <tr>
            <td className="pr-3">Nomor</td>
            <td>: {letterNumber(q.quotationNumber)}</td>
          </tr>
          <tr>
            <td className="pr-3">Perihal</td>
            <td>: {letterSubject(q)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <p>Kepada Yth :</p>
        <p className="text-[14px] font-bold">{q.customer.contactPerson ? `Bapak/Ibu ${q.customer.contactPerson}` : 'Bapak/Ibu'}</p>
        <p className="text-[14px] font-bold">{q.customer.companyName}</p>
        {address && <p className="max-w-[48ch]">{address}</p>}
      </div>

      <p className="mt-5">Dengan hormat,</p>
      <p>Dengan ini perkenankanlah kami mengajukan penawaran harga secara tidak mengikat sebagai berikut :</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-canvas text-center font-bold">
              <th className={`${CELL} w-8`}>No</th>
              <th className={CELL}>Nama dan Spesifikasi Produk</th>
              <th className={`${CELL} w-16`}>Qty</th>
              <th className={`${CELL} w-[104px]`}>Harga Satuan</th>
              {view.showDiscount && <th className={`${CELL} w-[92px]`}>Discount</th>}
              <th className={`${CELL} w-[108px]`}>Total Harga</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map(r => (
              <tr key={`${r.kind}-${r.no}`} className="align-top">
                <td className={`${CELL} text-center`}>{r.no}</td>
                <td className={CELL}>
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{r.title}</p>
                      {r.detail.length > 0 && (
                        <div className="mt-1 text-[11.5px]">
                          {r.detail.map((d, i) => (
                            <p key={i}>{d}</p>
                          ))}
                        </div>
                      )}
                      {r.note && <p className="mt-1 whitespace-pre-line text-[11.5px] font-semibold italic">{r.note}</p>}
                    </div>
                    {r.kind === 'item' && r.image && (
                      <ProductImage src={r.image} alt="" hint={r.category} className="size-14 shrink-0 sm:size-16" />
                    )}
                  </div>
                </td>
                <td className={`${CELL} whitespace-nowrap text-center`}>
                  {r.qty} {r.unit}
                </td>
                <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>{money(r.unitPrice)}</td>
                {view.showDiscount && <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>{r.discountText}</td>}
                <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>{r.amount === null ? '' : formatRupiah(r.amount)}</td>
              </tr>
            ))}
            {view.totals.map(t => (
              <tr key={t.label} className={t.strong ? 'font-bold' : ''}>
                <td colSpan={cols - 1} className={`${CELL} text-right`}>
                  {t.label}
                </td>
                <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>{t.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 text-[12px]">
        <p>Keterangan :</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-6">
          {view.terms.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
          {view.paymentTerms.length > 0 && (
            <li>
              Termin Pembayaran
              <table className="mt-1 border-collapse">
                <tbody>
                  {view.paymentTerms.map(p => (
                    <tr key={p.label}>
                      <td className={`${CELL} w-56 py-0.5`}>{p.label}</td>
                      <td className={`${CELL} w-20 py-0.5 text-right tabular-nums`}>{p.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          )}
          <li>
            Pembayaran dapat ditransfer ke rekening perusahaan
            <div className="mt-0.5 pl-12">
              <p className="font-bold">{view.bank.bank}</p>
              <p>
                an. <span className="font-bold">{view.bank.holder}</span>
              </p>
              <p>
                rek. <span className="font-bold">{view.bank.account}</span>
              </p>
            </div>
          </li>
        </ul>
      </div>

      <p className="mt-4">Kami tunggu kabar baik selanjutnya, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>

      <div className="mt-3">
        <p>Hormat kami,</p>
        <div className="flex h-16 items-end">{issued ? <Signature name={signer.name} /> : <span className="text-[11px] text-ink-3">Menunggu persetujuan</span>}</div>
        <p className="font-bold uppercase underline underline-offset-2">{signer.name}</p>
        {signer.title && <p className="font-semibold">{signer.title}</p>}
      </div>
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
  const signer = useSigner(quotation);
  const { settings } = useStore();
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
          <Button size="sm" variant="primary" icon={<Download className="size-4" />} onClick={() => downloadQuotationPdf(quotation, signer, settings)}>
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
    totalAmount: documentView(quotation).headlineTotal,
    includesTax: documentView(quotation).taxMode !== 'EXCLUDED',
    approvedBy: quotation.reviewedBy ?? currentUser?.name ?? 'Sales Support',
    approvalDate: quotation.reviewedAt ?? '',
    downloadUrl: pdfUrl,
  });
  const payload = buildWhatsAppTemplatePayload({
    salesName: quotation.salesName,
    salesPhone: quotation.salesPhone,
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customer.companyName,
    grandTotal: documentView(quotation).headlineTotal,
    includesTax: documentView(quotation).taxMode !== 'EXCLUDED',
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
            <span className="truncate font-medium">{quotationFileName({ quotationNumber: quotation.quotationNumber, customerName: quotation.customer.companyName, revisionNo: quotation.revisionNo })}</span>
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
