/**
 * Smart search: turns a sales rep's free-text request into catalog suggestions.
 *
 *   "20 kursi ergonomis di bawah 2,5 juta dan 5 komputer core i7 16gb TKDN"
 *     → segment 1: qty 20 · maks Rp 2.500.000 · kursi, ergonomis  → KURSI INDACHI VINO I CR, …
 *     → segment 2: qty 5 · AIO · Core i7 · RAM 16 GB · TKDN       → LENOVO AIO ThinkCentre Neo 50a, …
 *
 * Pure and deterministic (no network, no model): runs instantly on every keystroke and is unit-tested.
 * Imports keep the .js extension so the module also runs as native ESM on the server.
 */

export interface SmartProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  keywords?: string[];
  description?: string;
  specs?: string;
  basePrice?: number;
  stock?: number;
  unit?: string;
  eKatalogLkpp?: boolean;
  isCustom?: boolean;
}

export interface RequestSegment {
  /** The part of the request this segment came from. */
  text: string;
  qty?: number;
  /** Category named in the request (may not exist in the catalog — see categoryInCatalog). */
  category?: string;
  categoryInCatalog?: boolean;
  minPrice?: number;
  maxPrice?: number;
  cpu?: number; // Intel Core tier: 3, 5, 7, 9
  ramGb?: number;
  storageGb?: number;
  pax?: number;
  tkdn?: boolean;
  lkpp?: boolean;
  /** Remaining descriptive words (ergonomis, mesh, hitam…). */
  terms: string[];
}

export interface ProductSuggestion<T extends SmartProduct> {
  product: T;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  /** Suggested quantity (from the request, default 1). */
  qty: number;
  /** Why it matched, for display ("Core i7", "Dalam budget"…). */
  reasons: string[];
  /** Where it falls short of the request ("Di atas budget", "Stok 12"…). */
  warnings: string[];
}

export interface SegmentResult<T extends SmartProduct> {
  segment: RequestSegment;
  suggestions: ProductSuggestion<T>[];
}

// ───────────────────────────── Vocabulary ─────────────────────────────

/** Phrases that name a product category. Bare "kursi"/"meja"/"lemari" are deliberately absent: they span several categories. */
const CATEGORY_LEXICON: Record<string, string[]> = {
  'Kursi Kantor': ['kursi kantor', 'kursi kerja', 'kursi direktur', 'kursi manager', 'kursi manajer', 'kursi staf', 'kursi staff', 'office chair'],
  'Kursi Tunggu': ['kursi tunggu', 'bangku tunggu', 'waiting chair', 'kursi ruang tunggu'],
  AIO: ['all in one', 'all-in-one', 'aio', 'komputer', 'computer', 'pc desktop', 'desktop', 'pc'],
  Laptop: ['laptop', 'notebook'],
  Proyektor: ['proyektor', 'projector', 'infocus'],
  'Meja Rapat': ['meja rapat', 'meja meeting', 'conference table', 'meja konferensi', 'boardroom'],
  'Meja Kerja Partisi': ['meja partisi', 'meja kerja partisi', 'workstation', 'cubicle', 'kubikel', 'partisi'],
  'Meja Kerja': ['meja kerja', 'meja kantor', 'meja staf', 'meja staff', 'meja direktur', 'office desk'],
  'Lemari Arsip': ['lemari arsip', 'filing cabinet', 'filling cabinet', 'lemari dokumen', 'filing', 'cabinet', 'arsip'],
  Printer: ['printer', 'pencetak'],
};

/** Multi-word phrases rewritten to catalog vocabulary before tokenizing. */
const PHRASES: [RegExp, string][] = [
  [/sandaran kepala/g, 'headrest'],
  [/sandaran tinggi/g, 'highback'],
  [/sandaran sedang/g, 'mediumback'],
  [/penyangga (punggung|pinggang)/g, 'lumbar'],
  [/high back/g, 'highback'],
  [/medium back/g, 'mediumback'],
  [/kaki (chrome|krom)/g, 'chrome'],
  [/pintu geser/g, 'sliding'],
];

/** Single words expanded to the words products actually use. */
const SYNONYMS: Record<string, string[]> = {
  ergonomis: ['ergonomic', 'lumbar', 'headrest'],
  ergonomic: ['ergonomis', 'lumbar', 'headrest'],
  direktur: ['highback', 'executive'],
  manager: ['highback'],
  manajer: ['highback'],
  staf: ['mediumback'],
  staff: ['mediumback'],
  highback: ['high'],
  mediumback: ['medium'],
  jaring: ['mesh'],
  besi: ['steel', 'baja'],
  baja: ['steel', 'besi'],
  kaca: ['glass'],
  kayu: ['wood', 'walnut', 'hpl', 'mfc'],
  hitam: ['black'],
  putih: ['white'],
  krom: ['chrome'],
  geser: ['sliding'],
  rapat: ['meeting', 'boardroom', 'conference'],
  meeting: ['rapat', 'boardroom'],
  komputer: ['aio', 'pc'],
  sekolah: ['lab', 'pendidikan'],
  lab: ['laboratorium', 'sekolah'],
  pemerintah: ['tkdn', 'lkpp', 'bumn'],
  bumn: ['tkdn', 'lkpp'],
};

const STOPWORDS = new Set(
  (
    'butuh perlu mau minta tolong cari carikan ada yang dengan untuk buat bagi di ke dari dan atau serta ' +
    'unit pcs pc buah set biji ea lot harga sekitar kisaran budget anggaran per kantor customer klien client pt cv ' +
    'ruang ruangan baru warna jenis tipe type model merk merek sama seperti kira kira-kira kurang lebih yg utk dgn ' +
    'the a an for with of to and rp juta jt ribu rb'
  ).split(/\s+/)
);

const NUMBER_WORDS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, selusin: 12, seratus: 100,
};

// ───────────────────────────── Parsing ─────────────────────────────

function parseAmount(num: string, unit?: string): number {
  const u = (unit ?? '').toLowerCase();
  if (u === 'juta' || u === 'jt') return Math.round(Number(num.replace(',', '.')) * 1_000_000);
  if (u === 'ribu' || u === 'rb' || u === 'k') return Math.round(Number(num.replace(',', '.')) * 1_000);
  return Number(num.replace(/[.,]/g, ''));
}

/** Detects the category named in `text` (longest phrase wins). */
function detectCategory(text: string, catalogCategories: string[]): { category: string; phrase: string; inCatalog: boolean } | undefined {
  const known = new Map(catalogCategories.map(c => [c.toLowerCase(), c]));
  const candidates: { category: string; phrase: string }[] = [];
  for (const [cat, phrases] of Object.entries(CATEGORY_LEXICON)) {
    for (const p of [cat.toLowerCase(), ...phrases]) candidates.push({ category: cat, phrase: p });
  }
  // Catalog categories outside the lexicon still match by their own name.
  for (const c of catalogCategories) if (!CATEGORY_LEXICON[c]) candidates.push({ category: c, phrase: c.toLowerCase() });

  let best: { category: string; phrase: string } | undefined;
  for (const c of candidates) {
    const re = new RegExp(`(^|[^a-z0-9])${c.phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`);
    if (re.test(text) && (!best || c.phrase.length > best.phrase.length)) best = c;
  }
  if (!best) return undefined;
  const inCatalog = known.has(best.category.toLowerCase());
  return { category: inCatalog ? known.get(best.category.toLowerCase())! : best.category, phrase: best.phrase, inCatalog };
}

function parseSegment(original: string, catalogCategories: string[]): RequestSegment {
  let t = ` ${original.toLowerCase().replace(/[“”"'`]/g, ' ').replace(/\s+/g, ' ')} `;
  const seg: RequestSegment = { text: original.trim(), terms: [] };
  const cut = (re: RegExp) => {
    t = t.replace(re, ' ');
  };

  // Budget: "di bawah 3 juta", "maks Rp 2.500.000", "sekitar 9jt", "budget total 50 juta"
  const priceRe =
    /(di\s*bawah|dibawah|maks(?:imal|imum)?|max|budget|anggaran|kurang\s+dari|tidak\s+lebih\s+dari|di\s*atas|diatas|minimal|min|lebih\s+dari|sekitar|kisaran)?\s*(total\s+)?(?:(?:rp\.?\s*)(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?!\s*(?:gb|tb))|(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b)(\s*(?:per|\/)\s*(?:unit|pcs|buah))?/;
  const pm = t.match(priceRe);
  if (pm) {
    const value = pm[3] ? parseAmount(pm[3]) : parseAmount(pm[4]!, pm[5]);
    const q = (pm[1] ?? '').replace(/\s+/g, ' ');
    const isTotal = Boolean(pm[2]);
    if (/atas|minimal|^min$|lebih dari/.test(q)) seg.minPrice = value;
    else if (/sekitar|kisaran/.test(q)) {
      seg.minPrice = Math.round(value * 0.8);
      seg.maxPrice = Math.round(value * 1.2);
    } else seg.maxPrice = value;
    if (isTotal) (seg as RequestSegment & { _totalBudget?: boolean })._totalBudget = true;
    t = t.replace(pm[0], ' ');
  }

  // Specs
  const cpu = t.match(/(?:intel\s*)?(?:core\s*)?\bi\s?([3579])\b/);
  if (cpu) {
    seg.cpu = Number(cpu[1]);
    cut(/(?:intel\s*)?(?:core\s*)?\bi\s?[3579]\b(?:[-\s]?\d{4,5}[a-z]{0,2})?/);
  }
  const storage = t.match(/(\d+)\s*(tb|gb)\s*(?:ssd|nvme|hdd|storage)|(?:ssd|nvme|hdd)\s*(\d+)\s*(tb|gb)/);
  if (storage) {
    const n = Number(storage[1] ?? storage[3]);
    seg.storageGb = (storage[2] ?? storage[4]) === 'tb' ? n * 1024 : n;
    t = t.replace(storage[0], ' ');
  }
  const ram = t.match(/(?:ram\s*)?(\d{1,3})\s*gb(?:\s*(?:ram|ddr\d?))?/);
  if (ram && Number(ram[1]) <= 128) {
    seg.ramGb = Number(ram[1]);
    t = t.replace(ram[0], ' ');
  }
  const pax = t.match(/(?:untuk\s+)?(\d+)\s*(?:-\s*(\d+)\s*)?(?:pax|orang|seater|peserta)\b/);
  if (pax) {
    seg.pax = Number(pax[2] ?? pax[1]);
    t = t.replace(pax[0], ' ');
  }
  if (/\btkdn\b/.test(t)) {
    seg.tkdn = true;
    cut(/\btkdn\b/g);
  }
  if (/\blkpp\b|e-?katalog|ekatalog/.test(t)) {
    seg.lkpp = true;
    cut(/\blkpp\b|e-?katalog|ekatalog/g);
  }

  // Quantity: "20 unit", "x20", "20x", "selusin", "dua lusin"
  const lusin = t.match(/(\d+|[a-z]+)\s+lusin\b/);
  if (lusin) {
    const n = Number(lusin[1]) || NUMBER_WORDS[lusin[1]!] || 1;
    seg.qty = n * 12;
    t = t.replace(lusin[0], ' ');
  } else {
    const qm = t.match(/\bx\s*(\d+)\b|\b(\d+)\s*x\b|(?:^|\s)(\d{1,4})(?=\s|$)(?:\s*(?:unit|pcs|pc|buah|set|biji|ea|lot)\b)?/);
    if (qm) {
      seg.qty = Number(qm[1] ?? qm[2] ?? qm[3]);
      t = t.replace(qm[0], ' ');
    } else {
      for (const [w, n] of Object.entries(NUMBER_WORDS)) {
        const re = new RegExp(`(^|\\s)${w}(\\s|$)`);
        if (re.test(t)) {
          seg.qty = n;
          t = t.replace(re, ' ');
          break;
        }
      }
    }
  }
  const total = (seg as RequestSegment & { _totalBudget?: boolean })._totalBudget;
  if (total) {
    delete (seg as RequestSegment & { _totalBudget?: boolean })._totalBudget;
    if (seg.qty && seg.maxPrice) seg.maxPrice = Math.round(seg.maxPrice / seg.qty);
  }

  // Category
  const cat = detectCategory(t, catalogCategories);
  if (cat) {
    seg.category = cat.category;
    seg.categoryInCatalog = cat.inCatalog;
    t = t.replace(cat.phrase, ' ');
  }

  // Descriptive terms
  for (const [re, rep] of PHRASES) t = t.replace(re, ` ${rep} `);
  seg.terms = Array.from(
    new Set(
      t
        .split(/[^a-z0-9-]+/)
        .map(w => w.replace(/^-+|-+$/g, ''))
        .filter(w => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    )
  );
  return seg;
}

const hasSubject = (s: RequestSegment) => Boolean(s.category) || s.terms.length > 0;

/**
 * Splits a request into item segments ("… dan …", commas, new lines) and parses each.
 * Fragments that only add detail ("warna hitam", "20 unit") are merged into the item before them.
 */
export function parseSalesRequest(text: string, catalogCategories: string[]): RequestSegment[] {
  const parts = text
    .split(/(?<!\d)[,;](?!\d)|\n|\s\+\s|\s(?:dan|serta|plus|&)\s/i)
    .map(s => s.trim())
    .filter(Boolean);
  const segments: RequestSegment[] = [];
  for (const part of parts) {
    const seg = parseSegment(part, catalogCategories);
    const prev = segments[segments.length - 1];
    const startsNewItem = !prev || seg.category !== undefined || (seg.qty !== undefined && prev.qty !== undefined && hasSubject(seg));
    if (startsNewItem) segments.push(seg);
    else segments[segments.length - 1] = parseSegment(`${prev.text}, ${part}`, catalogCategories);
  }
  return segments.filter(s => hasSubject(s) || s.cpu || s.ramGb || s.tkdn || s.lkpp || s.pax);
}

// ───────────────────────────── Matching ─────────────────────────────

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]!);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

interface ProductFacts {
  name: string;
  keywords: string;
  specs: string;
  description: string;
  brand: string;
  sku: string;
  words: string[];
  cpu?: number;
  ramGb?: number;
  storageGb?: number;
  paxMin?: number;
  paxMax?: number;
  tkdn: boolean;
}

const factsCache = new WeakMap<SmartProduct, ProductFacts>();

function facts(p: SmartProduct): ProductFacts {
  const cached = factsCache.get(p);
  if (cached) return cached;
  const name = p.name.toLowerCase().replace(/high back/g, 'highback').replace(/medium back/g, 'mediumback');
  const keywords = (p.keywords ?? []).join(' ').toLowerCase().replace(/medium back/g, 'mediumback');
  const specs = (p.specs ?? '').toLowerCase().replace(/high back/g, 'highback').replace(/medium back/g, 'mediumback');
  const description = (p.description ?? '').toLowerCase();
  const all = `${name} ${keywords} ${specs} ${description} ${p.category.toLowerCase()}`;
  const cpu = all.match(/\bi([3579])(?:[-\s]?\d{4,5}|\b)/);
  const ram = all.match(/(?:ram\s*)?(\d{1,3})\s*gb\s*(?:ram|ddr\d?)|ram\s*(\d{1,3})\s*gb/);
  const storage = all.match(/(\d+)\s*(tb|gb)\s*(?:ssd|nvme|hdd)|(?:ssd|nvme|hdd)\s*(\d+)\s*(tb|gb)/);
  const pax = all.match(/(\d+)\s*(?:-\s*(\d+)\s*)?pax/);
  const f: ProductFacts = {
    name,
    keywords,
    specs,
    description,
    brand: (p.brand ?? '').toLowerCase(),
    sku: p.sku.toLowerCase(),
    words: Array.from(new Set(all.split(/[^a-z0-9]+/).filter(w => w.length >= 3))),
    cpu: cpu ? Number(cpu[1]) : undefined,
    ramGb: ram ? Number(ram[1] ?? ram[2]) : undefined,
    storageGb: storage ? Number(storage[1] ?? storage[3]) * ((storage[2] ?? storage[4]) === 'tb' ? 1024 : 1) : undefined,
    paxMin: pax ? Number(pax[1]) : undefined,
    paxMax: pax ? Number(pax[2] ?? pax[1]) : undefined,
    tkdn: /tkdn/.test(all),
  };
  factsCache.set(p, f);
  return f;
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

function scoreProduct<T extends SmartProduct>(p: T, seg: RequestSegment): ProductSuggestion<T> | null {
  const f = facts(p);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let evidence = 0; // matches that say "this is the thing asked for"

  if (seg.category) {
    if (!seg.categoryInCatalog || p.category !== seg.category) return null;
    score += 40;
    evidence++;
    reasons.push(p.category);
  }

  // Descriptive terms (with synonyms and typo tolerance)
  const matchedTerms: string[] = [];
  for (const term of seg.terms) {
    const alts = [term, ...(SYNONYMS[term] ?? [])];
    let best = 0;
    for (const a of alts) {
      const exact = a === term ? 1 : 0.7;
      let s = 0;
      if (f.sku === a || f.sku.includes(a) && a.length >= 4) s = 20;
      else if (f.name.includes(a)) s = 15;
      else if (f.brand && f.brand === a) s = 12;
      else if (f.keywords.includes(a)) s = 12;
      else if (f.specs.includes(a)) s = 8;
      else if (f.description.includes(a)) s = 5;
      else if (a.length >= 3 && f.words.some(w => w.startsWith(a))) s = 8;
      else if (a.length >= 5 && f.words.some(w => editDistance(a, w, a.length >= 8 ? 2 : 1) <= (a.length >= 8 ? 2 : 1))) s = 7;
      best = Math.max(best, s * exact);
    }
    if (best > 0) {
      score += best;
      matchedTerms.push(term);
      if (best >= 12) evidence++;
    } else {
      score -= 2;
    }
  }
  if (matchedTerms.length) reasons.push(`Cocok: ${matchedTerms.slice(0, 4).join(', ')}`);

  // Specs
  if (seg.cpu) {
    if (f.cpu === seg.cpu) {
      score += 25;
      evidence++;
      reasons.push(`Core i${f.cpu}`);
    } else if (f.cpu && f.cpu > seg.cpu) {
      score += 12;
      reasons.push(`Core i${f.cpu} (lebih tinggi)`);
    } else if (f.cpu) {
      score -= 15;
      warnings.push(`Core i${f.cpu}, di bawah permintaan i${seg.cpu}`);
    }
  }
  if (seg.ramGb && f.ramGb) {
    if (f.ramGb >= seg.ramGb) {
      score += 12;
      reasons.push(`RAM ${f.ramGb} GB`);
    } else {
      score -= 12;
      warnings.push(`RAM ${f.ramGb} GB, kurang dari ${seg.ramGb} GB`);
    }
  }
  if (seg.storageGb && f.storageGb) {
    if (f.storageGb >= seg.storageGb) {
      score += 8;
      reasons.push(`SSD ${f.storageGb >= 1024 ? `${f.storageGb / 1024} TB` : `${f.storageGb} GB`}`);
    } else {
      score -= 8;
      warnings.push(`Penyimpanan ${f.storageGb} GB, kurang dari permintaan`);
    }
  }
  if (seg.pax && f.paxMax) {
    if (seg.pax >= (f.paxMin ?? 0) - 2 && seg.pax <= f.paxMax) {
      score += 20;
      evidence++;
      reasons.push(`${f.paxMin === f.paxMax ? f.paxMax : `${f.paxMin}–${f.paxMax}`} orang`);
    } else {
      score -= 10;
      warnings.push(`Kapasitas ${f.paxMin}–${f.paxMax} orang`);
    }
  }
  if (seg.tkdn) {
    if (f.tkdn) {
      score += 15;
      reasons.push('TKDN');
    } else warnings.push('Tidak tercatat TKDN');
  }
  if (seg.lkpp) {
    if (p.eKatalogLkpp) {
      score += 15;
      reasons.push('e-Katalog LKPP');
    } else warnings.push('Belum di e-Katalog LKPP');
  }

  if (evidence === 0 && score < 15) return null;

  // Budget
  if (p.basePrice !== undefined) {
    if (seg.maxPrice) {
      if (p.basePrice <= seg.maxPrice) {
        score += 15;
        reasons.push('Dalam budget');
      } else {
        const over = (p.basePrice - seg.maxPrice) / seg.maxPrice;
        score -= over <= 0.1 ? 5 : 20;
        warnings.push(`Di atas budget ${rupiah(seg.maxPrice)}`);
      }
    }
    if (seg.minPrice && p.basePrice < seg.minPrice) {
      score -= 5;
      warnings.push(`Di bawah kisaran ${rupiah(seg.minPrice)}`);
    }
  }

  const qty = seg.qty ?? 1;
  if (p.stock !== undefined && !p.isCustom && qty > p.stock) warnings.push(`Stok ${p.stock}, kurang dari ${qty}`);

  const confidence: ProductSuggestion<T>['confidence'] =
    evidence >= 1 && warnings.length === 0 && (score >= 40 || evidence >= 2) ? 'high' : score >= 20 && warnings.length <= 1 ? 'medium' : 'low';
  return { product: p, score, confidence, qty, reasons, warnings };
}

/** Best catalog matches for each item in the request. */
export function suggestProducts<T extends SmartProduct>(products: T[], request: string, limit = 3): SegmentResult<T>[] {
  const categories = Array.from(new Set(products.map(p => p.category)));
  return parseSalesRequest(request, categories).map(segment => ({
    segment,
    suggestions: products
      .map(p => scoreProduct(p, segment))
      .filter((s): s is ProductSuggestion<T> => s !== null && s.score >= 15)
      .sort((a, b) => b.score - a.score || (a.product.basePrice ?? 0) - (b.product.basePrice ?? 0))
      .slice(0, limit),
  }));
}

/** Every product that matches any item in the query, best first — for filtering lists. */
export function rankProducts<T extends SmartProduct>(products: T[], query: string): T[] {
  if (!query.trim()) return products;
  const categories = Array.from(new Set(products.map(p => p.category)));
  const segments = parseSalesRequest(query, categories);
  if (!segments.length) return [];
  const best = new Map<T, number>();
  for (const seg of segments) {
    for (const p of products) {
      const s = scoreProduct(p, seg);
      if (s && s.score > 0) best.set(p, Math.max(best.get(p) ?? -Infinity, s.score));
    }
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

/** Short Indonesian description of what was understood, for chips in the UI. */
export function describeSegment(s: RequestSegment): string[] {
  const out: string[] = [];
  if (s.qty) out.push(`${s.qty} unit`);
  if (s.category) out.push(s.category);
  if (s.cpu) out.push(`Core i${s.cpu}`);
  if (s.ramGb) out.push(`RAM ${s.ramGb} GB`);
  if (s.storageGb) out.push(`SSD ${s.storageGb >= 1024 ? `${s.storageGb / 1024} TB` : `${s.storageGb} GB`}`);
  if (s.pax) out.push(`${s.pax} orang`);
  if (s.tkdn) out.push('TKDN');
  if (s.lkpp) out.push('e-Katalog LKPP');
  if (s.minPrice && s.maxPrice) out.push(`${rupiah(s.minPrice)}–${rupiah(s.maxPrice)}`);
  else if (s.maxPrice) out.push(`maks ${rupiah(s.maxPrice)}`);
  else if (s.minPrice) out.push(`min ${rupiah(s.minPrice)}`);
  out.push(...s.terms.map(t => (t === 'highback' ? 'high back' : t === 'mediumback' ? 'medium back' : t)));
  return out;
}

/** True when the query reads like a request (quantity, budget, spec, several items) rather than a single keyword. */
export function isDetailedRequest(segments: RequestSegment[]): boolean {
  if (segments.length > 1) return true;
  const s = segments[0];
  if (!s) return false;
  return Boolean(s.qty || s.maxPrice || s.minPrice || s.cpu || s.ramGb || s.storageGb || s.pax || s.tkdn || s.lkpp || s.terms.length + (s.category ? 1 : 0) >= 2);
}
