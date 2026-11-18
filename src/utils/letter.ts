/**
 * Agusta's quotation letter: company details, standard terms, numbering and file names.
 * Shared by the browser and the server (api/whatsapp.ts), so only type imports, with .js.
 */
import type { DiscountMode, LetterSettings, PaymentTerm, Quotation, TaxMode } from '../types/index.js';

export const COMPANY = {
  name: 'PT. Agusta Triasa',
  street: 'Jl. Pandanaran No.62',
  city: 'Semarang 50134',
  country: 'INDONESIA',
  phone: '024 844 733',
  whatsapp: '0857 2706 6550',
  email: 'agusta@agusta.co.id',
  /** Place written before the letter date. */
  place: 'Semarang',
  bank: { name: 'BANK BCA Cabang Gang Tengah, Semarang', holder: 'PT AGUSTA TRIASA', account: '182 9888 333' },
};

/** "Keterangan" when Sales has not written its own. */
export const DEFAULT_TERMS = ['Harga franco Kota Semarang', 'Harga dan stok tidak mengikat'];

/** One-tap additions in the editor, taken from Agusta's letters. */
export const TERM_SUGGESTIONS = [
  'Harga franco Kota Semarang',
  'Harga dan stok tidak mengikat',
  'Sudah termasuk pengiriman dan pemasangan',
  'Delivery time 4 minggu',
  'Produksi terhitung sejak diterimanya pembayaran dan disetujui gambar kerja',
  'Garansi resmi 1 tahun',
  'Tidak termasuk tambahan daya listrik/pasang baru',
  'Semua produk tetap menjadi milik PT. Agusta Triasa hingga pembayaran penuh diterima',
  'Barang yang sudah dipesan tidak dapat diubah atau dikembalikan setelah PO dikeluarkan',
];

export const PAYMENT_PRESETS: { label: string; terms: PaymentTerm[] }[] = [
  { label: 'DP 50% · pelunasan 50%', terms: [{ label: 'Down Payment', percent: 50 }, { label: 'Pelunasan sebelum pengiriman', percent: 50 }] },
  { label: 'DP 35% · pelunasan setelah instal 65%', terms: [{ label: 'Down Payment', percent: 35 }, { label: 'Pelunasan setelah instal', percent: 65 }] },
  { label: 'DP 30% · pelunasan 70%', terms: [{ label: 'Down Payment', percent: 30 }, { label: 'Pelunasan setelah barang diterima', percent: 70 }] },
];

export const taxModeOf = (q: Pick<Quotation, 'taxMode' | 'showTax'>): TaxMode => q.taxMode ?? (q.showTax === false ? 'EXCLUDED' : 'ADDED');
export const discountModeOf = (q: Pick<Quotation, 'discountMode' | 'showDiscount'>): DiscountMode =>
  q.discountMode ?? (q.showDiscount === false ? 'HIDDEN' : 'PERCENT');

export function letterSettingsOf(q: Quotation): LetterSettings {
  return { taxMode: taxModeOf(q), discountMode: discountModeOf(q), terms: q.terms ?? DEFAULT_TERMS, paymentTerms: q.paymentTerms ?? [] };
}

export const DEFAULT_LETTER: LetterSettings = { taxMode: 'ADDED', discountMode: 'PERCENT', terms: DEFAULT_TERMS, paymentTerms: [] };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** 0088/FHM/AG/VIII/26 — same scheme as the database trigger. */
export function agustaNumber(seq: number, code: string, date: Date = new Date()): string {
  return `${String(seq).padStart(4, '0')}/${code}/AG/${ROMAN[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

/** The number printed on the letter: revisions keep the original number. */
export const letterNumber = (quotationNumber: string) => quotationNumber.replace(/-R\d+$/, '');

export const revisionNoOf = (q: Pick<Quotation, 'quotationNumber' | 'revisionNo'>) =>
  q.revisionNo || Number(q.quotationNumber.match(/-R(\d+)$/)?.[1] ?? 0);

/** "Penawaran Harga" or "Penawaran Harga (Revisi 2)". */
export function letterSubject(q: Pick<Quotation, 'quotationNumber' | 'revisionNo'>): string {
  const rev = revisionNoOf(q);
  return rev ? `Penawaran Harga (Revisi ${rev})` : 'Penawaran Harga';
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "18 November 2026" from yyyy-mm-dd, else the stored display date. */
export function letterDate(q: Pick<Quotation, 'issuedOn' | 'date'>): string {
  const m = q.issuedOn?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return q.date;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Agusta's file naming: "PNWR 0088 - Universitas Muria Kudus - Rev1.pdf".
 * Older QTN-… numbers: "Penawaran QTN-251103-0087 - PT X.pdf".
 */
export function quotationFileName(q: { quotationNumber: string; customerName: string; revisionNo?: number }): string {
  const root = letterNumber(q.quotationNumber);
  const seq = root.match(/^(\d{4})\//)?.[1];
  const rev = q.revisionNo || Number(q.quotationNumber.match(/-R(\d+)$/)?.[1] ?? 0);
  const company = q.customerName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const base = seq ? `PNWR ${seq}` : `Penawaran ${root.replace(/\//g, '-')}`;
  return `${base}${company ? ` - ${company}` : ''}${rev ? ` - Rev${rev}` : ''}.pdf`;
}

/** Same name, safe as a storage object key. */
export const storageFileName = (fileName: string) => fileName.replace(/[^A-Za-z0-9._-]+/g, '_');
