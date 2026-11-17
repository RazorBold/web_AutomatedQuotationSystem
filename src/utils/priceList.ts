/**
 * R9: supplier price list → HPP updates. A price list arrives as rows of cells (Excel/CSV) or as
 * text lines (PDF). Rows are matched to catalog products by SKU (or exact product name), the price is
 * read from the price column (or, without one, the last rupiah amount on the row), and the result is
 * shown as a preview before anything is saved. Supplier price = HPP; selling prices stay manual (Q9).
 */
import type { Product } from '../types';
import { parseRupiah } from './marketResearch';

export type Cell = string | number | boolean | Date | null | undefined;
export type Row = Cell[];

export interface PriceListColumns {
  /** Column holding the SKU / product code; -1 = search every cell. */
  sku: number;
  /** Column holding the price; -1 = last rupiah amount on the row. */
  price: number;
  /** Index of the header row, -1 when none was found. */
  headerRow: number;
}

export interface PriceMatch {
  productId: string;
  sku: string;
  name: string;
  oldCogs: number;
  newCogs: number;
  basePrice: number;
  /** 1-based row number in the file, for the user to look it up. */
  line: number;
  /** Price moved more than 50% (or the old HPP was empty): needs a look before saving. */
  suspicious: boolean;
  /** Same product found again further down; the first row wins. */
  duplicate?: boolean;
}

export interface PriceListResult {
  columns: PriceListColumns;
  matches: PriceMatch[];
  /** Rows that look like price rows (have an amount) but match no product. */
  unmatched: { line: number; text: string; price: number }[];
}

/** Big moves are flagged so a wrong column or a typo does not slip through. */
export const SUSPICIOUS_CHANGE = 0.5;

const MIN_PRICE = 1000;

export const normalizeSku = (s: Cell) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const normalizeName = (s: Cell) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const cellText = (c: Cell) => (c instanceof Date ? '' : String(c ?? '').trim());

/** A cell that is only an amount: 2250000 · "2.250.000" · "Rp 2.250.000,00" · "IDR 950,000". */
export function cellPrice(c: Cell): number {
  if (typeof c === 'number') return Number.isFinite(c) && c >= MIN_PRICE ? Math.round(c) : 0;
  const t = cellText(c);
  if (!/^(?:rp\.?|idr)?\s*\d[\d.,]*\s*(?:,-)?$/i.test(t)) return 0;
  const v = parseRupiah(t);
  return v >= MIN_PRICE ? v : 0;
}

/** Amounts written inside a text line (PDF): grouped thousands or plain numbers of 4+ digits. */
export function lineAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?:rp\.?\s*|idr\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,})(?![\d])/gi)) {
    const v = parseRupiah(m[1]!);
    if (v >= MIN_PRICE) out.push(v);
  }
  return out;
}

const SKU_HEADER = /^(sku|kode|kode barang|kode produk|item code|part ?(no|number)|article|artikel|tipe|type|model)\b/i;
const PRICE_HEADER = /\b(harga|price|hpp|net|dealer|distributor|modal|cost)\b/i;

/** Finds the header row (first 15 rows) and the SKU/price columns in it. */
export function detectColumns(rows: Row[]): PriceListColumns {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r]!.map(cellText);
    const sku = cells.findIndex(c => SKU_HEADER.test(c));
    // Prefer the most specific price column: net/dealer/hpp before a generic "harga".
    const priceCols = cells.map((c, i) => ({ c, i })).filter(x => PRICE_HEADER.test(x.c));
    const specific = priceCols.find(x => /\b(net|dealer|distributor|hpp|modal|cost)\b/i.test(x.c));
    const price = (specific ?? priceCols[0])?.i ?? -1;
    if (sku >= 0 || (price >= 0 && priceCols.length && cells.filter(Boolean).length >= 2)) {
      return { sku, price, headerRow: r };
    }
  }
  return { sku: -1, price: -1, headerRow: -1 };
}

/** Header labels for column pickers ("Kolom B · Harga Net"). */
export function columnOptions(rows: Row[], columns: PriceListColumns): { value: number; label: string }[] {
  const width = Math.max(0, ...rows.slice(0, 50).map(r => r.length));
  const header = columns.headerRow >= 0 ? rows[columns.headerRow]! : [];
  return Array.from({ length: width }, (_, i) => {
    const letter = String.fromCharCode(65 + (i % 26));
    const title = cellText(header[i]);
    return { value: i, label: title ? `Kolom ${letter} · ${title}` : `Kolom ${letter}` };
  });
}

/** Matches price-list rows to products. `columns` defaults to auto-detection. */
export function matchPriceList(rows: Row[], products: Product[], columns: PriceListColumns = detectColumns(rows)): PriceListResult {
  const bySku = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of products) {
    const k = normalizeSku(p.sku);
    if (k.length >= 3 && !bySku.has(k)) bySku.set(k, p);
    const n = normalizeName(p.name);
    if (n && !byName.has(n)) byName.set(n, p);
  }

  const find = (row: Row): Product | undefined => {
    const cells = columns.sku >= 0 ? [row[columns.sku]] : row;
    for (const c of cells) {
      const p = bySku.get(normalizeSku(c)) ?? byName.get(normalizeName(c));
      if (p) return p;
    }
    // Text lines (PDF) or "code + name" cells: look at each word; short codes only as a whole cell (above).
    for (const c of cells) {
      for (const token of cellText(c).split(/\s+/)) {
        const k = normalizeSku(token);
        if (k.length >= 4 && bySku.has(k)) return bySku.get(k);
      }
    }
    return undefined;
  };

  const priceOf = (row: Row, p?: Product): number => {
    if (columns.price >= 0) {
      const c = row[columns.price];
      if (typeof c === 'number') return cellPrice(c);
      const v = parseRupiah(cellText(c));
      return v >= MIN_PRICE ? v : 0;
    }
    const skuKey = p ? normalizeSku(p.sku) : '';
    const amounts: number[] = [];
    for (const c of row) {
      if (skuKey && normalizeSku(c) === skuKey) continue;
      const whole = cellPrice(c);
      if (whole) amounts.push(whole);
      else if (typeof c === 'string') amounts.push(...lineAmounts(c.replace(p?.sku ?? '\u0000', ' ')));
    }
    return amounts.at(-1) ?? 0;
  };

  const matches: PriceMatch[] = [];
  const seen = new Set<string>();
  const unmatched: PriceListResult['unmatched'] = [];

  rows.forEach((row, i) => {
    if (i <= columns.headerRow) return;
    const p = find(row);
    const price = priceOf(row, p);
    if (!p) {
      if (price) unmatched.push({ line: i + 1, text: row.map(cellText).filter(Boolean).join(' · ').slice(0, 160), price });
      return;
    }
    if (!price) return;
    const duplicate = seen.has(p.id);
    seen.add(p.id);
    const change = p.cogs > 0 ? Math.abs(price - p.cogs) / p.cogs : Infinity;
    matches.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      oldCogs: p.cogs,
      newCogs: price,
      basePrice: p.basePrice,
      line: i + 1,
      suspicious: change > SUSPICIOUS_CHANGE,
      duplicate: duplicate || undefined,
    });
  });

  return { columns, matches, unmatched };
}

/** Rows that would actually change something (first occurrence, different price). */
export const effectiveChanges = (m: PriceMatch[]) => m.filter(x => !x.duplicate && x.newCogs !== x.oldCogs);

/** Minimal CSV reader: quotes, "" escapes, and `,` / `;` / tab delimiters (auto-detected). */
export function parseCsv(text: string): Row[] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', '\t', ','].map(d => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0]!.d;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim()));
}

/**
 * PDF text items → rows: items on the same baseline form a line; a wide horizontal gap starts a new
 * cell, so table columns survive as cells.
 */
export function pdfItemsToRows(items: { str: string; x: number; y: number; width: number }[]): Row[] {
  const lines = new Map<number, typeof items>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const key = Math.round(it.y / 3);
    lines.set(key, [...(lines.get(key) ?? []), it]);
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, line]) => {
      const sorted = line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let end = -Infinity;
      for (const it of sorted) {
        if (cells.length && it.x - end < 8) cells[cells.length - 1] += (it.x - end > 1 ? ' ' : '') + it.str;
        else cells.push(it.str);
        end = it.x + it.width;
      }
      return cells.map(c => c.trim());
    });
}
