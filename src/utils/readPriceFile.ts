/**
 * Browser-only: turns an uploaded supplier price list into rows for priceList.ts.
 * The Excel and PDF readers are loaded on demand so they stay out of the main bundle.
 */
import { parseCsv, pdfItemsToRows, type Row } from './priceList';

export const PRICE_FILE_ACCEPT = '.xlsx,.csv,.txt,.pdf';
const MAX_BYTES = 15 * 1024 * 1024;

export async function readPriceFile(file: File): Promise<{ rows: Row[]; kind: 'excel' | 'csv' | 'pdf' }> {
  if (file.size > MAX_BYTES) throw new Error('File terlalu besar (maks. 15 MB).');
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    return { rows: sheets.flatMap(s => s.data as Row[]), kind: 'excel' };
  }
  if (name.endsWith('.xls')) throw new Error('Format .xls lama belum didukung. Simpan ulang sebagai .xlsx atau .csv dari Excel.');
  if (name.endsWith('.csv') || name.endsWith('.txt')) return { rows: parseCsv(await file.text()), kind: 'csv' };

  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows: Row[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items
        .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it)
        .map(it => ({ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number, width: it.width }));
      rows.push(...pdfItemsToRows(items));
    }
    await doc.cleanup();
    if (!rows.length) {
      throw new Error('PDF ini tidak berisi teks (kemungkinan hasil scan). Minta file Excel atau PDF asli dari supplier.');
    }
    return { rows, kind: 'pdf' };
  }
  throw new Error('Format file belum didukung. Gunakan .xlsx, .csv, atau .pdf.');
}
