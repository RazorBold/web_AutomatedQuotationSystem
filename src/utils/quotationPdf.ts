/**
 * Formal quotation PDF (jsPDF) in Agusta's letter format. Pure: no React, no store — used for
 * downloads and for the copy uploaded to storage and attached to the WhatsApp notification.
 * Layout and numbers come from documentView(), the same source as the on-screen letter.
 */
import type { Quotation, UserProfile } from '../types';
import { formatRupiah } from './quotationEngine';
import { pdfSafeImageUrl } from './agustaCatalog';
import { customerAddress, documentView, type DocumentRow } from './quotationView';
import { COMPANY, letterDate, letterNumber, letterSubject, quotationFileName } from './letter';

export { COMPANY } from './letter';

export type Signer = Pick<UserProfile, 'name' | 'title'>;

export const isIssued = (q: Quotation) => q.status === 'APPROVED' || q.status === 'PDF_SENT';

/** The letter is signed by the Sales person who made it, with their job title. */
export function signerFor(q: Pick<Quotation, 'salesId' | 'salesName'> | null, users: UserProfile[]): Signer {
  if (!q) return { name: '', title: '' };
  const u = users.find(x => x.id === q.salesId);
  return { name: u?.name ?? q.salesName, title: u?.title ?? '' };
}

interface PdfImage {
  data: string;
  w: number;
  h: number;
}

/** Loads a product photo and flattens it onto white as JPEG, so jsPDF can embed any source format. */
function loadPdfImage(original: string | undefined): Promise<PdfImage | null> {
  const src = original ? pdfSafeImageUrl(original) : '';
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ data: canvas.toDataURL('image/jpeg', 0.85), w, h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // A slow photo must not block the document: give up on it after 25 s.
    window.setTimeout(() => resolve(null), 25_000);
    img.src = src;
  });
}

/** The standard PDF fonts only cover Latin-1: replace typographic characters. */
const t = (s: string) => s.replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/ /g, ' ');
const money = (v: number | null) => (v === null ? 'Termasuk' : t(formatRupiah(v)));

export async function buildQuotationPdf(q: Quotation, signer: Signer): Promise<Blob> {
  const view = documentView(q);
  const [{ jsPDF }, images] = await Promise.all([import('jspdf'), Promise.all(view.rows.map(r => (r.kind === 'item' ? loadPdfImage(r.image) : Promise.resolve(null))))]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const red: [number, number, number] = [214, 32, 42];
  const navy: [number, number, number] = [29, 42, 110];
  const ink: [number, number, number] = [20, 24, 33];
  const L = 18;
  const R = 192;
  const BOTTOM = 280;
  const font = (style: 'normal' | 'bold' | 'italic' | 'bolditalic', size: number) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  // ── Letterhead ──
  // Mark: red ball with white swooshes, as on Agusta's letterhead.
  doc.setFillColor(...red);
  doc.circle(L + 6, 19.5, 6, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.lines([[3, 0.4, 7, -0.6, 10.5, -3.2]], L + 0.8, 18.2);
  doc.lines([[3.6, 0.5, 8, -0.8, 11.6, -4]], L + 0.2, 21.4);
  doc.lines([[3.2, 0.1, 6.6, -1.4, 9.4, -4.4]], L + 1.6, 24.4);
  font('bolditalic', 24);
  doc.setTextColor(...red);
  doc.text('AGUSTA', L + 14, 22);
  font('bolditalic', 8);
  doc.setTextColor(...navy);
  doc.text('Business & Office Equipment', L + 14.5, 27);
  doc.setTextColor(...ink);
  const HX = 140;
  font('bold', 7);
  doc.text(COMPANY.name, HX, 15);
  font('normal', 7);
  [COMPANY.street, COMPANY.city, COMPANY.country].forEach((line, i) => doc.text(line, HX, 18.5 + i * 3.3));
  [
    ['Telephone', COMPANY.phone],
    ['WA Center', COMPANY.whatsapp],
    ['Email', COMPANY.email],
  ].forEach(([k, v], i) => {
    font(k === 'Email' ? 'bold' : 'normal', 7);
    doc.text(k!, HX, 30 + i * 3.3);
    doc.text(`: ${v}`, HX + 16, 30 + i * 3.3);
  });

  // ── Date, number, addressee ──
  let y = 48;
  font('normal', 10);
  doc.text(`${COMPANY.place}, ${letterDate(q)}`, L, y);
  y += 7;
  doc.text('Nomor', L, y);
  doc.text(`: ${letterNumber(q.quotationNumber)}`, L + 16, y);
  y += 5;
  doc.text('Perihal', L, y);
  doc.text(`: ${letterSubject(q)}`, L + 16, y);
  y += 9;
  doc.text('Kepada Yth :', L, y);
  font('bold', 11);
  y += 5.5;
  doc.text(t(q.customer.contactPerson ? `Bapak/Ibu ${q.customer.contactPerson}` : 'Bapak/Ibu'), L, y);
  y += 5.5;
  const company = doc.splitTextToSize(t(q.customer.companyName), R - L) as string[];
  doc.text(company, L, y);
  y += company.length * 5.5 - 1;
  font('normal', 10);
  const address = customerAddress(q);
  if (address) {
    const lines = doc.splitTextToSize(t(address), 110) as string[];
    doc.text(lines, L, y + 1);
    y += lines.length * 4.6;
  }
  y += 7;
  doc.text('Dengan hormat,', L, y);
  y += 5;
  doc.text('Dengan ini perkenankanlah kami mengajukan penawaran harga secara tidak mengikat sebagai berikut :', L, y);
  y += 4;

  // ── Table ──
  const widths = view.showDiscount ? [8, 76, 19, 26, 21, 24] : [8, 92, 20, 28, 26];
  let cursor = L;
  const xs = widths.map(w => {
    const x = cursor;
    cursor += w;
    return x;
  });
  const colX = (i: number) => xs[i]!;
  const colW = (i: number) => widths[i]!;
  const last = widths.length - 1;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.25);

  const header = () => {
    const h = 10;
    doc.setFillColor(242, 243, 245);
    doc.rect(L, y, R - L, h, 'F');
    font('bold', 8.5);
    const heads = view.showDiscount
      ? ['No', 'Nama dan Spesifikasi Produk', 'Qty', 'Harga Satuan', 'Discount', 'Total Harga']
      : ['No', 'Nama dan Spesifikasi Produk', 'Qty', 'Harga Satuan', 'Total Harga'];
    heads.forEach((label, i) => {
      doc.rect(colX(i), y, colW(i), h, 'S');
      doc.text(label, colX(i) + colW(i) / 2, y + 6.2, { align: 'center' });
    });
    y += h;
  };
  header();

  const IMG = 20;
  const drawRow = (r: DocumentRow, img: PdfImage | null) => {
    const descW = colW(1) - 4 - (img ? IMG + 2 : 0);
    font('bold', 9);
    const title = doc.splitTextToSize(t(r.title), descW) as string[];
    font('normal', 8);
    const detail = r.detail.flatMap(d => doc.splitTextToSize(t(d), descW) as string[]);
    font('bolditalic', 8);
    const note = r.note ? (doc.splitTextToSize(t(r.note), descW) as string[]) : [];
    const textH = title.length * 4 + (detail.length ? 1 + detail.length * 3.6 : 0) + (note.length ? 1.5 + note.length * 3.6 : 0);
    const h = Math.max(textH + 4, img ? IMG + 4 : 0, 9);
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 18;
      header();
    }
    widths.forEach((_, i) => doc.rect(colX(i), y, colW(i), h, 'S'));
    const top = y + 4.8;
    font('normal', 9);
    doc.text(String(r.no), colX(0) + colW(0) / 2, top, { align: 'center' });
    let ty = top;
    font('bold', 9);
    doc.text(title, colX(1) + 2, ty);
    ty += title.length * 4;
    if (detail.length) {
      font('normal', 8);
      ty += 1;
      doc.text(detail, colX(1) + 2, ty - 0.4);
      ty += detail.length * 3.6;
    }
    if (note.length) {
      font('bolditalic', 8);
      ty += 1.5;
      doc.text(note, colX(1) + 2, ty - 0.4);
    }
    if (img) {
      const s = Math.min(IMG / img.w, IMG / img.h);
      doc.addImage(img.data, 'JPEG', colX(1) + colW(1) - 2 - img.w * s, y + 2, img.w * s, img.h * s);
    }
    font('normal', 9);
    doc.text(`${r.qty} ${r.unit}`, colX(2) + colW(2) / 2, top, { align: 'center' });
    doc.text(money(r.unitPrice), colX(3) + colW(3) - 2, top, { align: 'right' });
    if (view.showDiscount) doc.text(t(r.discountText ?? ''), colX(4) + colW(4) - 2, top, { align: 'right' });
    if (r.amount !== null) doc.text(money(r.amount), colX(last) + colW(last) - 2, top, { align: 'right' });
    y += h;
  };
  view.rows.forEach((r, i) => drawRow(r, images[i] ?? null));

  for (const row of view.totals) {
    if (y + 7 > BOTTOM) {
      doc.addPage();
      y = 18;
    }
    font(row.strong ? 'bold' : 'normal', 9);
    doc.rect(L, y, colX(last) - L, 7, 'S');
    doc.rect(colX(last), y, colW(last), 7, 'S');
    doc.text(t(row.label), colX(last) - 2, y + 4.8, { align: 'right' });
    doc.text(t(row.value), R - 2, y + 4.8, { align: 'right' });
    y += 7;
  }

  // ── Keterangan ──
  const ensure = (need: number) => {
    if (y + need > BOTTOM) {
      doc.addPage();
      y = 18;
    }
  };
  y += 7;
  ensure(12);
  font('normal', 9.5);
  doc.text('Keterangan :', L, y);
  y += 5;
  const bullet = (lines: string[]) => {
    ensure(lines.length * 4.4 + 1);
    doc.circle(L + 3, y - 1.2, 0.7, 'F');
    doc.text(lines, L + 6, y);
    y += lines.length * 4.4 + 0.6;
  };
  doc.setFillColor(...ink);
  for (const term of view.terms) bullet(doc.splitTextToSize(t(term), R - L - 8) as string[]);
  if (view.paymentTerms.length) {
    bullet(['Termin Pembayaran']);
    for (const p of view.paymentTerms) {
      ensure(6);
      doc.rect(L + 6, y - 3.8, 60, 5.4, 'S');
      doc.rect(L + 66, y - 3.8, 20, 5.4, 'S');
      doc.text(t(p.label), L + 8, y);
      doc.text(`${p.percent}%`, L + 84, y, { align: 'right' });
      y += 5.4;
    }
    y += 1;
  }
  bullet(['Pembayaran dapat ditransfer ke rekening perusahaan']);
  ensure(14);
  font('bold', 9.5);
  doc.text(COMPANY.bank.name, L + 22, y);
  font('normal', 9.5);
  doc.text('an. ', L + 22, y + 4.4);
  font('bold', 9.5);
  doc.text(COMPANY.bank.holder, L + 22 + doc.getTextWidth('an. '), y + 4.4);
  font('normal', 9.5);
  doc.text('rek. ', L + 22, y + 8.8);
  font('bold', 9.5);
  doc.text(COMPANY.bank.account, L + 22 + doc.getTextWidth('rek. '), y + 8.8);
  y += 15;

  // ── Closing & signature ──
  ensure(40);
  font('normal', 9.5);
  doc.text('Kami tunggu kabar baik selanjutnya, atas perhatian dan kerjasamanya kami ucapkan terima kasih.', L, y);
  y += 6;
  doc.text('Hormat kami,', L, y);
  if (isIssued(q)) {
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.5);
    doc.lines([[8, -6], [6, 8], [10, -9], [8, 7], [10, -4]], L + 2, y + 15);
  }
  y += 22;
  font('bold', 9.5);
  const name = t(signer.name.toUpperCase());
  doc.text(name, L, y);
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.3);
  doc.line(L, y + 0.8, L + doc.getTextWidth(name), y + 0.8);
  if (signer.title) {
    doc.text(t(signer.title), L, y + 4.6);
  }

  return doc.output('blob');
}

export async function downloadQuotationPdf(q: Quotation, signer: Signer) {
  const blob = await buildQuotationPdf(q, signer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = quotationFileName({ quotationNumber: q.quotationNumber, customerName: q.customer.companyName, revisionNo: q.revisionNo });
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
