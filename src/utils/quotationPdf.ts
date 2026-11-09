/**
 * Formal quotation PDF (jsPDF). Pure: no React, no store — used for downloads and for the
 * copy uploaded to storage and attached to the WhatsApp notification.
 */
import type { Quotation, UserProfile } from '../types';
import { formatRupiah } from './quotationEngine';

export const COMPANY = {
  address: 'Jl. Industri Raya No. 88, Kawasan Niaga Terpadu, Jakarta 14350',
  contact: 'Telp. (021) 5890-1234 · sales@agusta.co.id · agusta.co.id',
};

export type Signer = Pick<UserProfile, 'name' | 'title'>;

export const isIssued = (q: Quotation) => q.status === 'APPROVED' || q.status === 'PDF_SENT';

/** The signing director: the first active Management account. */
export function getDirector(users: UserProfile[]): Signer {
  const d = users.find(u => u.role === 'MANAGEMENT' && u.status === 'ACTIVE');
  return d ?? { name: 'Direktur Komersial', title: 'Direktur Komersial' };
}

interface PdfImage {
  data: string;
  w: number;
  h: number;
}

/** Loads a product photo and flattens it onto white as JPEG, so jsPDF can embed any source format. */
function loadPdfImage(src: string): Promise<PdfImage | null> {
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
    img.src = src;
  });
}

export async function buildQuotationPdf(q: Quotation, director: Signer): Promise<Blob> {
  const [{ jsPDF }, images] = await Promise.all([import('jspdf'), Promise.all(q.items.map(it => loadPdfImage(it.image)))]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [29, 42, 110];
  const red: [number, number, number] = [214, 32, 42];
  const L = 18;
  const R = 192;

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(22);
  doc.setTextColor(...red);
  doc.text('AGUSTA', L, 22);
  doc.setFontSize(8);
  doc.setTextColor(...navy);
  doc.text('Business & Office Equipment', L, 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(COMPANY.address, R, 20, { align: 'right' });
  doc.text(COMPANY.contact.replace(/·/g, '|'), R, 25, { align: 'right' });
  doc.setDrawColor(...navy);
  doc.setLineWidth(1);
  doc.line(L, 31, R, 31);

  doc.setFontSize(9);
  doc.setTextColor(110, 117, 134);
  doc.text('Kepada Yth.', L, 40);
  doc.setTextColor(20, 24, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(q.customer.companyName, L, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`u.p. ${q.customer.contactPerson}`, L, 51);
  doc.text(doc.splitTextToSize(`${q.customer.address}, ${q.customer.city}`, 95), L, 56);

  [['Nomor', q.quotationNumber], ['Tanggal', q.date], ['Berlaku s.d.', q.validUntil], ['Perihal', 'Penawaran harga']].forEach(
    ([k, v], i) => {
      doc.setTextColor(110, 117, 134);
      doc.text(k!, 135, 40 + i * 5);
      doc.setTextColor(20, 24, 33);
      doc.text(v!, 158, 40 + i * 5);
    }
  );

  doc.text('Dengan hormat,', L, 72);
  doc.text(`Bersama surat ini kami sampaikan penawaran harga untuk kebutuhan ${q.customer.companyName}:`, L, 77);

  let y = 84;
  doc.setFillColor(...navy);
  doc.rect(L, y, R - L, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('No', L + 2, y + 5.3);
  doc.text('Produk', L + 10, y + 5.3);
  doc.text('Qty', 118, y + 5.3, { align: 'right' });
  doc.text('Harga satuan', 146, y + 5.3, { align: 'right' });
  doc.text('Disc.', 160, y + 5.3, { align: 'right' });
  doc.text('Jumlah', R - 2, y + 5.3, { align: 'right' });
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 24, 33);
  const THUMB = 15;
  const textX = L + 10 + THUMB + 3;
  const textW = 60;
  q.items.forEach((it, i) => {
    doc.setFontSize(9);
    const name = doc.splitTextToSize(it.productName, textW);
    doc.setFontSize(7.5);
    const spec = it.specs ? doc.splitTextToSize(it.specs, textW).slice(0, 3) : [];
    doc.setFontSize(9);
    const h = Math.max(name.length * 4 + spec.length * 3.5, THUMB) + 4;
    if (y + h > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(i + 1), L + 2, y);

    // Product photo, fitted inside a square frame at the top of the row.
    const top = y - 3.2;
    const img = images[i];
    doc.setDrawColor(227, 230, 236);
    doc.setLineWidth(0.2);
    if (img) {
      const s = Math.min(THUMB / img.w, THUMB / img.h);
      const w = img.w * s;
      const ih = img.h * s;
      doc.addImage(img.data, 'JPEG', L + 10 + (THUMB - w) / 2, top + (THUMB - ih) / 2, w, ih);
    } else {
      doc.setFillColor(245, 246, 248);
      doc.rect(L + 10, top, THUMB, THUMB, 'F');
      doc.setFontSize(6);
      doc.setTextColor(110, 117, 134);
      doc.text('Tanpa foto', L + 10 + THUMB / 2, top + THUMB / 2 + 1, { align: 'center' });
      doc.setTextColor(20, 24, 33);
      doc.setFontSize(9);
    }
    doc.rect(L + 10, top, THUMB, THUMB, 'S');

    doc.setFont('helvetica', 'bold');
    doc.text(name, textX, y);
    doc.setFont('helvetica', 'normal');
    if (spec.length) {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(spec, textX, y + name.length * 4);
      doc.setTextColor(20, 24, 33);
      doc.setFontSize(9);
    }
    doc.text(`${it.qty} ${it.unit}`, 118, y, { align: 'right' });
    doc.text(formatRupiah(it.sellingPrice), 146, y, { align: 'right' });
    doc.text(it.discountPercent ? `${it.discountPercent}%` : '-', 160, y, { align: 'right' });
    doc.text(formatRupiah(it.subtotal), R - 2, y, { align: 'right' });
    y += h;
    doc.setDrawColor(227, 230, 236);
    doc.setLineWidth(0.2);
    doc.line(L, y - 3, R, y - 3);
    y += 2;
  });

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 130, y);
    doc.text(value, R - 2, y, { align: 'right' });
    y += 6;
  };
  y += 2;
  row('Subtotal', formatRupiah(q.subtotal));
  row(`PPN ${q.taxRatePercent}%`, formatRupiah(q.taxAmount));
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.6);
  doc.line(128, y - 4, R, y - 4);
  doc.setFontSize(10.5);
  row('Total', formatRupiah(q.grandTotal), true);
  doc.setFontSize(9);

  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('Demikian penawaran ini kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.', L, y);
  y += 10;
  doc.text('Hormat kami,', L, y);
  doc.text('Mengetahui,', 120, y);
  if (isIssued(q)) {
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.5);
    [L, 120].forEach(x => {
      doc.lines([[8, -6], [6, 8], [10, -9], [8, 7], [10, -4]], x + 2, y + 16);
    });
  }
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.text(q.salesName, L, y);
  doc.text(director.name, 120, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Account Executive', L, y + 4.5);
  doc.text(director.title, 120, y + 4.5);
  if (isIssued(q)) {
    doc.setTextColor(110, 117, 134);
    doc.text(`Ditandatangani secara elektronik. Disetujui oleh ${q.reviewedBy ?? '-'} pada ${q.reviewedAt ?? '-'}.`, L, 285);
  }

  return doc.output('blob');
}

export async function downloadQuotationPdf(q: Quotation, director: Signer) {
  const blob = await buildQuotationPdf(q, director);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Penawaran_${q.quotationNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
