/**
 * Agusta's quotation letter: company details, standard terms, numbering and file names.
 * Shared by the browser and the server (api/whatsapp.ts), so only type imports, with .js.
 */
import type { AppSettings, BankAccount, CompanyInfo, DiscountMode, LetterSettings, LetterTemplates, Quotation, TaxMode } from '../types/index.js';

/** Letterhead until Pengaturan says otherwise (same values as the migration seed). */
export const DEFAULT_COMPANY: CompanyInfo = {
  name: 'PT. Agusta Triasa',
  street: 'Jl. Pandanaran No.62',
  city: 'Semarang 50134',
  country: 'INDONESIA',
  phone: '024 844 733',
  whatsapp: '0857 2706 6550',
  email: 'agusta@agusta.co.id',
  place: 'Semarang',
};

export const DEFAULT_BANKS: BankAccount[] = [
  { id: 'bca-gang-tengah', bank: 'BANK BCA Cabang Gang Tengah, Semarang', holder: 'PT AGUSTA TRIASA', account: '182 9888 333', isDefault: true },
];

/** "Keterangan" when Sales Support has not written its own. */
export const DEFAULT_TERMS = ['Harga franco Kota Semarang', 'Harga dan stok tidak mengikat'];

export const DEFAULT_TEMPLATES: LetterTemplates = {
  defaultTerms: DEFAULT_TERMS,
  suggestions: [
    'Harga franco Kota Semarang',
    'Harga dan stok tidak mengikat',
    'Sudah termasuk pengiriman dan pemasangan',
    'Delivery time 4 minggu',
    'Produksi terhitung sejak diterimanya pembayaran dan disetujui gambar kerja',
    'Garansi resmi 1 tahun',
    'Tidak termasuk tambahan daya listrik/pasang baru',
    'Semua produk tetap menjadi milik PT. Agusta Triasa hingga pembayaran penuh diterima',
    'Barang yang sudah dipesan tidak dapat diubah atau dikembalikan setelah PO dikeluarkan',
  ],
  paymentPresets: [
    { label: 'DP 50% · pelunasan 50%', terms: [{ label: 'Down Payment', percent: 50 }, { label: 'Pelunasan sebelum pengiriman', percent: 50 }] },
    { label: 'DP 35% · pelunasan setelah instal 65%', terms: [{ label: 'Down Payment', percent: 35 }, { label: 'Pelunasan setelah instal', percent: 65 }] },
    { label: 'DP 30% · pelunasan 70%', terms: [{ label: 'Down Payment', percent: 30 }, { label: 'Pelunasan setelah barang diterima', percent: 70 }] },
  ],
};

export const DEFAULT_SETTINGS: AppSettings = { company: DEFAULT_COMPANY, banks: DEFAULT_BANKS, templates: DEFAULT_TEMPLATES };

/** The default account of the list (first one when none is marked). */
export const defaultBank = (banks: BankAccount[]): BankAccount => banks.find(b => b.isDefault) ?? banks[0] ?? DEFAULT_BANKS[0]!;

/** Account printed on a letter: its own copy, else today's default. */
export const bankFor = (q: Pick<Quotation, 'bankAccount'>, settings: AppSettings = DEFAULT_SETTINGS): BankAccount =>
  q.bankAccount ?? defaultBank(settings.banks);

export const taxModeOf = (q: Pick<Quotation, 'taxMode' | 'showTax'>): TaxMode => q.taxMode ?? (q.showTax === false ? 'EXCLUDED' : 'ADDED');
export const discountModeOf = (q: Pick<Quotation, 'discountMode' | 'showDiscount'>): DiscountMode =>
  q.discountMode ?? (q.showDiscount === false ? 'HIDDEN' : 'PERCENT');

export function letterSettingsOf(q: Quotation, templates: LetterTemplates = DEFAULT_TEMPLATES): LetterSettings {
  return {
    taxMode: taxModeOf(q),
    discountMode: discountModeOf(q),
    terms: q.terms ?? templates.defaultTerms,
    paymentTerms: q.paymentTerms ?? [],
    bank: q.bankAccount ?? null,
  };
}

export const defaultLetter = (templates: LetterTemplates = DEFAULT_TEMPLATES): LetterSettings => ({
  taxMode: 'ADDED',
  discountMode: 'PERCENT',
  terms: templates.defaultTerms,
  paymentTerms: [],
  bank: null,
});
export const DEFAULT_LETTER: LetterSettings = defaultLetter();
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
