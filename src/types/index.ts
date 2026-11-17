export type UserRole = 'SALES' | 'SALES_SUPPORT' | 'MANAGEMENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  avatar: string;
  phone: string;
  email: string;
  status: UserStatus;
  /** Local demo mode only. With Supabase, passwords live (hashed) in Supabase Auth and never reach the client. */
  password?: string;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * DRAFT → PENDING_REVIEW → (PENDING_MANAGEMENT →) PENDING_REVIEW → APPROVED → PDF_SENT
 * REJECTED: back to Sales. REVISED: superseded by a newer revision (-R1, -R2 …), kept as archive.
 */
export type QuotationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PENDING_MANAGEMENT' | 'APPROVED' | 'REJECTED' | 'PDF_SENT' | 'REVISED';

/** Additional charge outside the catalog (R6). Subject to PPN, not discounted, no margin. */
export type ChargeKind = 'INSTALL' | 'SHIPPING' | 'OTHER';
export interface QuotationCharge {
  id: string;
  kind: ChargeKind;
  /** Free text shown on the document, e.g. "Jasa pasang 20 unit" or "Ongkir ke Bandung". */
  label: string;
  amount: number;
}

/** Forwarding to Management (R7), for a quotation or a custom request. */
export interface Escalation {
  /** Why Sales Support forwarded it. */
  note: string;
  by: string;
  byId?: string;
  at: string;
  decision?: 'APPROVED' | 'RETURNED';
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
}

/** R9: one HPP change, entered by hand or from a supplier price list. */
export interface PriceChange {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  oldCogs?: number;
  newCogs: number;
  source: 'MANUAL' | 'IMPORT';
  /** Price list name / file for imports. */
  reference?: string;
  by: string;
  at: string;
  atIso: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  basePrice: number;
  cogs: number; // Cost of Goods Sold (Harga Modal/HPP) - Sensitive
  image: string;
  stock: number;
  unit: string;
  weightKg?: number;
  dimensions?: string;
  specs: string;
  description: string;
  isCustom?: boolean;
  isBestSeller?: boolean;
  eKatalogLkpp?: boolean;
  keywords?: string[];
  /** Product id on agusta.co.id when imported from the website. */
  sourceId?: string;
  /** Product page on agusta.co.id. */
  sourceUrl?: string;
}

export interface QuotationItemData {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  image: string;
  qty: number;
  unit: string;
  cogs: number; // Sensitive, editable by Sales Support
  basePrice: number;
  sellingPrice: number;
  discountPercent: number;
  subtotal: number;
  notes?: string;
  specs?: string;
}

export type CustomerCategory = 'BUMN_GOV' | 'CORPORATE' | 'EDUCATION' | 'RETAIL';

export interface CustomerInfo {
  companyName: string;
  contactPerson: string;
  /** Optional. */
  phone: string;
  email: string;
  address: string;
  city: string;
  /** Optional: without a segment there is no automatic discount suggestion. */
  category?: CustomerCategory;
}

export interface QuotationEvent {
  at: string;
  /** ISO instant (analytics). Older events only have the display string. */
  atIso?: string;
  by: string;
  label: string;
  note?: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g. QTN-251103-0087
  date: string;
  validUntil: string;
  status: QuotationStatus;
  customer: CustomerInfo;
  salesId: string;
  salesName: string;
  salesPhone: string;
  items: QuotationItemData[];
  /** After every discount (item discounts and the extra discount), before PPN. */
  subtotal: number;
  /** Quotation-level discount in rupiah, taken off the item lines before PPN. */
  extraDiscount?: number;
  /** PDF display: show the PPN line (default true). When false the document says "harga belum termasuk PPN". */
  showTax?: boolean;
  /** PDF display: show the discount column (default true). When false unit prices are shown after discount. */
  showDiscount?: boolean;
  /** Additional charges: jasa pasang, ongkir, lainnya (R6). */
  charges?: QuotationCharge[];
  /** Latest forwarding to Management, if any (R7). */
  escalation?: Escalation;
  /** Revision chain (R5): the quotation this one revises, its revision number, and the newer one. */
  revisionOf?: string;
  revisionNo?: number;
  revisedTo?: string;
  /** Outcome after the PDF was sent (R13): latest status from the weekly updates. */
  outcome?: FollowUpStatus;
  /** Weekly updates by Sales, oldest first (R13). */
  followUps?: FollowUp[];
  /** ISO instants for analytics (R8/R13/R14). */
  createdAtIso?: string;
  reviewedAtIso?: string;
  taxRatePercent: number;
  taxAmount: number;
  grandTotal: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  salesNotes: string;
  supportNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  pdfGeneratedAt?: string;
  pdfDownloadUrl?: string;
  /** Storage path of the issued PDF (Supabase mode). */
  pdfPath?: string;
  whatsAppStatus?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  whatsAppMessageLog?: string;
  history?: QuotationEvent[];
}

export type NotificationType =
  | 'QUOTATION_SUBMITTED'
  | 'QUOTATION_RESUBMITTED'
  | 'QUOTATION_APPROVED'
  | 'QUOTATION_REJECTED'
  | 'CUSTOM_REQUEST_SUBMITTED'
  | 'CUSTOM_REQUEST_PRICED'
  | 'CUSTOM_REQUEST_APPROVED'
  | 'CUSTOM_REQUEST_REJECTED'
  | 'QUOTATION_ESCALATED'
  | 'QUOTATION_MGMT_DECIDED'
  | 'CUSTOM_REQUEST_ESCALATED'
  | 'CUSTOM_REQUEST_MGMT_DECIDED'
  | 'FOLLOWUP_REMINDER';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  quotationId?: string;
  requestId?: string;
  /** Display string (id-ID). */
  createdAt: string;
  /** ISO timestamp, for ordering and "x menit lalu". */
  createdAtIso: string;
  read: boolean;
}

export type CustomRequestStatus = 'PENDING_PRICING' | 'PENDING_MANAGEMENT' | 'PRICED' | 'APPROVED' | 'REJECTED';

export interface CustomProductRequest {
  id: string;
  salesId: string;
  salesName: string;
  productName: string;
  category: string;
  estimatedQty: number;
  /** Legacy: target price per unit (before pagu/anggaran). Kept for older requests. */
  targetPricePerUnit: number;
  /** Customer's budget (pagu/anggaran) for the whole quantity, in rupiah (R11). */
  budgetTotal?: number;
  specs: string;
  referenceUrlOrNotes: string;
  submittedAt: string;
  status: CustomRequestStatus;
  assignedCogs?: number;
  assignedSellingPrice?: number;
  supportNotes?: string;
  /** Catalog product created when the price is approved, so the item can be quoted. */
  productId?: string;
  /** Photo of the requested item (e.g. from agusta.co.id), used for the catalog product once approved. */
  imageUrl?: string;
  /** Where the item was found (agusta.co.id product page). */
  sourceUrl?: string;
  /** Supplier chosen during market research (Sales Support / Management only — like HPP). */
  supplier?: { name: string; url?: string; price: number };
  /** Forwarding to Management for special pricing (R7). */
  escalation?: Escalation;
}

/** R13: what happened with the customer after the quotation was sent. */
export type FollowUpStatus = 'WAITING' | 'NEGOTIATION' | 'WON' | 'LOST' | 'CANCELLED';
export type LostReason = 'PRICE' | 'COMPETITOR' | 'BUDGET' | 'SPEC' | 'OTHER';

export interface FollowUp {
  id: string;
  status: FollowUpStatus;
  note: string;
  /** Value of the purchase order, when won. */
  poValue?: number;
  lostReason?: LostReason;
  by: string;
  at: string;
  atIso: string;
}
