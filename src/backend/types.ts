import type { AppNotification, CustomProductRequest, CustomerInfo, Product, Quotation, QuotationItemData, UserProfile } from '../types';
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
}

export type NewCustomRequestInput = Pick<
  CustomProductRequest,
  'productName' | 'category' | 'estimatedQty' | 'targetPricePerUnit' | 'specs' | 'referenceUrlOrNotes' | 'imageUrl' | 'sourceUrl'
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
  saveQuotationPricing(actor: UserProfile, id: string, items: QuotationItemData[], supportNotes?: string): Promise<void>;
  approveQuotation(actor: UserProfile, id: string, items: QuotationItemData[], supportNotes?: string): Promise<void>;
  rejectQuotation(actor: UserProfile, id: string, reason: string): Promise<void>;
  /** Stores the issued PDF so the WhatsApp message can link to it. */
  attachQuotationPdf(actor: UserProfile, quotation: Quotation, pdf: Blob): Promise<void>;
  sendWhatsApp(actor: UserProfile, id: string): Promise<WhatsAppSendResult>;

  submitCustomRequest(actor: UserProfile, req: NewCustomRequestInput): Promise<void>;
  priceCustomRequest(actor: UserProfile, id: string, patch: CustomRequestPricing): Promise<void>;
  setDiscountRules(actor: UserProfile, rules: DiscountRule[]): Promise<void>;
  updateProduct(actor: UserProfile, id: string, patch: Partial<Pick<Product, 'cogs' | 'basePrice' | 'stock'>>): Promise<void>;

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
