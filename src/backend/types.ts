import type { AppNotification, CustomProductRequest, CustomerInfo, FollowUpStatus, LostReason, Product, Quotation, QuotationCharge, QuotationItemData, UserProfile } from '../types';
import type { DiscountRule } from '../utils/quotationEngine';
import type { WhatsAppSendResult } from '../utils/whatsapp';
import type { AgustaProduct } from '../utils/agustaCatalog';
import type { MarketSearchResult, SupplierRef } from '../utils/marketResearch';

export type Result = { ok: true } | { ok: false; error: string };

export interface Snapshot {
  users: UserProfile[];
  quotations: Quotation[];
  products: Product[];
  customRequests: CustomProductRequest[];
  discountRules: DiscountRule[];
  /** The signed-in user's notifications, newest first. */
  notifications: AppNotification[];
}

export interface NewQuotationInput {
  customer: CustomerInfo;
  items: Pick<QuotationItemData, 'productId' | 'qty' | 'discountPercent' | 'notes'>[];
  salesNotes: string;
  /** Quotation-level discount in rupiah (diskon tambahan). */
  extraDiscount?: number;
  /** Additional charges (jasa pasang, ongkir, lainnya). */
  charges?: ChargeInput[];
}

export type ChargeInput = Omit<QuotationCharge, 'id'>;

/** Quotation-level settings Sales Support (or Management, while escalated) can change. */
export interface QuotationAdjustments {
  extraDiscount?: number;
  showTax?: boolean;
  showDiscount?: boolean;
  charges?: ChargeInput[];
}

export type EscalationDecision = 'APPROVED' | 'RETURNED';

/** R13: weekly update by Sales on an issued quotation. */
export interface FollowUpInput {
  status: FollowUpStatus;
  note: string;
  poValue?: number;
  lostReason?: LostReason;
}

export type NewCustomRequestInput = Pick<
  CustomProductRequest,
  'productName' | 'category' | 'estimatedQty' | 'targetPricePerUnit' | 'budgetTotal' | 'specs' | 'referenceUrlOrNotes' | 'imageUrl' | 'sourceUrl'
>;

export type CustomRequestPricing = Pick<CustomProductRequest, 'assignedCogs' | 'assignedSellingPrice' | 'supportNotes' | 'status'>;

export type NewUserInput = Omit<UserProfile, 'id' | 'createdAt' | 'avatar' | 'lastLoginAt'> & { password: string };
export type UserPatch = Partial<Omit<UserProfile, 'id' | 'createdAt' | 'avatar' | 'lastLoginAt'>>;

/**
 * Everything the UI needs from a data source. Two implementations:
 *   local    — localStorage demo (no setup), same behaviour as the original prototype
 *   supabase — Postgres + Auth + Storage, writes through role-checked RPC functions
 * Mutations throw an Error with a user-readable Indonesian message.
 */
export interface Backend {
  mode: 'local' | 'supabase';
  restoreSession(): Promise<string | null>;
  /** Fires when the session ends or changes outside the app (expired token, other tab). */
  onSessionChange(cb: (userId: string | null) => void): () => void;
  login(email: string, password: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  logout(): Promise<void>;
  load(userId: string): Promise<Snapshot>;
  /** Live updates (other users approving, submitting). Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;

  createQuotation(actor: UserProfile, input: NewQuotationInput, existingId?: string): Promise<string>;
  saveQuotationPricing(actor: UserProfile, id: string, items: QuotationItemData[], supportNotes?: string, adjustments?: QuotationAdjustments): Promise<void>;
  approveQuotation(actor: UserProfile, id: string, items: QuotationItemData[], supportNotes?: string, adjustments?: QuotationAdjustments): Promise<void>;
  rejectQuotation(actor: UserProfile, id: string, reason: string): Promise<void>;
  /** Stores the issued PDF so the WhatsApp message can link to it. */
  attachQuotationPdf(actor: UserProfile, quotation: Quotation, pdf: Blob): Promise<void>;
  sendWhatsApp(actor: UserProfile, id: string): Promise<WhatsAppSendResult>;

  submitCustomRequest(actor: UserProfile, req: NewCustomRequestInput): Promise<void>;
  priceCustomRequest(actor: UserProfile, id: string, patch: CustomRequestPricing): Promise<void>;
  setDiscountRules(actor: UserProfile, rules: DiscountRule[]): Promise<void>;
  updateProduct(actor: UserProfile, id: string, patch: Partial<Pick<Product, 'cogs' | 'basePrice' | 'stock' | 'brand'>>): Promise<void>;

  /** R7: Sales Support forwards a quotation to Management (saving the current pricing first). */
  escalateQuotation(actor: UserProfile, id: string, note: string, items: QuotationItemData[], supportNotes?: string, adjustments?: QuotationAdjustments): Promise<void>;
  /** R7: Management approves (possibly with edited pricing) or returns; back to Sales Support. */
  decideQuotationEscalation(actor: UserProfile, id: string, decision: EscalationDecision, note: string, items: QuotationItemData[], adjustments?: QuotationAdjustments): Promise<void>;
  escalateCustomRequest(actor: UserProfile, id: string, note: string, cogs: number, sellingPrice: number): Promise<void>;
  decideCustomRequestEscalation(actor: UserProfile, id: string, decision: EscalationDecision, note: string, cogs: number, sellingPrice: number): Promise<void>;
  /** R5: new version (-R1, -R2 …) of an issued quotation; returns its id. */
  createQuotationRevision(actor: UserProfile, id: string): Promise<string>;
  /** R13: record what happened with the customer. */
  addQuotationFollowUp(actor: UserProfile, id: string, input: FollowUpInput): Promise<void>;

  addUser(actor: UserProfile, input: NewUserInput): Promise<Result>;
  updateUser(actor: UserProfile, id: string, patch: UserPatch): Promise<Result>;

  /** Products on agusta.co.id matching a sales request (via the server proxy). */
  searchAgusta(query: string): Promise<AgustaProduct[]>;
  /** One page (12 products) of the agusta.co.id catalog, for syncing. */
  fetchAgustaPage(page: number): Promise<{ products: AgustaProduct[]; page: number; lastPage: number; total: number }>;
  /** Upserts website products into the catalog (new ones have no price yet). */
  importAgustaProducts(actor: UserProfile, items: AgustaProduct[]): Promise<{ inserted: number; updated: number }>;

  /** Comparable offers on the web for a custom request (Sales Support). */
  searchMarket(query: string): Promise<MarketSearchResult>;
  /** Saves (or clears, with null) the supplier reference of a custom request. */
  setCustomRequestSupplier(actor: UserProfile, id: string, supplier: SupplierRef | null): Promise<void>;

  /** Marks the given notifications (or all, when omitted) as read. */
  markNotificationsRead(actor: UserProfile, ids?: string[]): Promise<void>;

  /** Local demo only. */
  resetDemoData?(): Promise<void>;
}
