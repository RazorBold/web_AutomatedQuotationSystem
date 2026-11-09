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

export type QuotationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PDF_SENT';

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
  phone: string;
  email: string;
  address: string;
  city: string;
  category: CustomerCategory;
}

export interface QuotationEvent {
  at: string;
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
  subtotal: number;
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
  | 'CUSTOM_REQUEST_REJECTED';

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

export type CustomRequestStatus ='PENDING_PRICING' | 'PRICED' | 'APPROVED' | 'REJECTED';

export interface CustomProductRequest {
  id: string;
  salesId: string;
  salesName: string;
  productName: string;
  category: string;
  estimatedQty: number;
  targetPricePerUnit: number;
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
}
