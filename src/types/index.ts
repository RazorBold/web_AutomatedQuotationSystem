export type UserRole = 'SALES' | 'SALES_SUPPORT' | 'MANAGEMENT';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  avatar: string;
  phone: string;
  email: string;
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
}

export interface CustomerInfo {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  category: 'BUMN_GOV' | 'CORPORATE' | 'EDUCATION' | 'RETAIL';
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
  whatsAppStatus?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ';
  whatsAppMessageLog?: string;
}

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
  status: 'PENDING_PRICING' | 'PRICED' | 'APPROVED' | 'REJECTED';
  assignedCogs?: number;
  assignedSellingPrice?: number;
  supportNotes?: string;
}
