import React, { useState } from 'react';
import {
  USERS,
  PRODUCTS,
  INITIAL_QUOTATIONS,
  INITIAL_CUSTOM_REQUESTS,
} from './data/mockData';
import {
  UserProfile,
  UserRole,
  Quotation,
  Product,
  CustomerInfo,
  QuotationItemData,
  CustomProductRequest,
} from './types';
import {
  calculateQuotationTotals,
  generateQuotationNumber,
} from './utils/quotationEngine';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { SalesDashboard } from './components/SalesDashboard';
import { QuotationWizard } from './components/QuotationWizard';
import { SalesSupportDashboard } from './components/SalesSupportDashboard';
import { QuotationPdfModal } from './components/QuotationPdfModal';
import { WhatsAppModal } from './components/WhatsAppModal';
import { CatalogBrowser } from './components/CatalogBrowser';
import { CustomRequestModal } from './components/CustomRequestModal';
import { DiscountRulesModal } from './components/DiscountRulesModal';
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export default function App() {
  // Authentication & RBAC state
  const [currentUser, setCurrentUser] = useState<UserProfile>(USERS[0]); // Default: Ismi Putri (Sales)
  const currentRole = currentUser.role;

  // View state
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Database state
  const [quotations, setQuotations] = useState<Quotation[]>(INITIAL_QUOTATIONS);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [customRequests, setCustomRequests] = useState<CustomProductRequest[]>(
    INITIAL_CUSTOM_REQUESTS
  );

  // Modals state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [activePdfQuotation, setActivePdfQuotation] = useState<Quotation | null>(null);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [activeWhatsAppQuotation, setActiveWhatsAppQuotation] = useState<Quotation | null>(null);

  const [customRequestModalOpen, setCustomRequestModalOpen] = useState(false);
  const [discountRulesModalOpen, setDiscountRulesModalOpen] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Switch between Sales & Sales Support roles seamlessly
  const handleSwitchRole = () => {
    if (currentRole === 'SALES') {
      setCurrentUser(USERS[1]); // Rizki Saputra (Sales Support)
      setCurrentView('support-reviews');
      showToast('Beralih ke peran: Rizki Saputra (Sales Support)', 'info');
    } else {
      setCurrentUser(USERS[0]); // Ismi Putri (Sales)
      setCurrentView('dashboard');
      showToast('Beralih ke peran: Ismi Putri (Sales)', 'info');
    }
  };

  // Submit new quotation from Wizard (Sales)
  const handleCreateQuotation = (data: {
    customer: CustomerInfo;
    items: QuotationItemData[];
    salesNotes: string;
  }) => {
    const nextSeq = quotations.length + 88;
    const qtnNumber = generateQuotationNumber(nextSeq);
    const totals = calculateQuotationTotals(data.items, true, 11);

    const newQuotation: Quotation = {
      id: `qtn-${Date.now()}`,
      quotationNumber: qtnNumber,
      date: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      validUntil: new Date(Date.now() + 14 * 86400000).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      status: 'PENDING_REVIEW',
      customer: data.customer,
      salesId: currentUser.id,
      salesName: currentUser.name,
      salesPhone: currentUser.phone,
      items: data.items,
      subtotal: totals.subtotal,
      taxRatePercent: 11,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      totalCogs: totals.totalCogs,
      grossProfit: totals.grossProfit,
      grossMarginPercent: totals.grossMarginPercent,
      salesNotes: data.salesNotes,
      whatsAppStatus: 'PENDING',
    };

    setQuotations([newQuotation, ...quotations]);
    setCurrentView('dashboard');
    showToast(`Penawaran ${qtnNumber} berhasil diajukan ke Sales Support!`);
  };

  // Sales Support approval and PDF generation
  const handleApproveQuotation = (updatedQuotation: Quotation) => {
    const approved: Quotation = {
      ...updatedQuotation,
      status: 'APPROVED',
      reviewedBy: currentUser.name,
      reviewedAt: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      pdfGeneratedAt: new Date().toLocaleTimeString('id-ID'),
    };

    setQuotations(prev => prev.map(q => (q.id === approved.id ? approved : q)));
    setActivePdfQuotation(approved);
    setPdfModalOpen(true);
    showToast(`Pengajuan ${approved.quotationNumber} DISETUJUI & PDF berhasil diterbitkan!`);
  };

  // Sales Support reject quotation
  const handleRejectQuotation = (quotationId: string, reason: string) => {
    setQuotations(prev =>
      prev.map(q =>
        q.id === quotationId
          ? {
              ...q,
              status: 'REJECTED',
              rejectionReason: reason,
              reviewedBy: currentUser.name,
              reviewedAt: new Date().toLocaleString('id-ID'),
            }
          : q
      )
    );
    showToast('Pengajuan penawaran dikembalikan ke Sales untuk revisi.', 'info');
  };

  // Sales Support updates pricing or COGS
  const handleUpdateQuotationPricing = (quotationId: string, items: QuotationItemData[]) => {
    const totals = calculateQuotationTotals(items, true, 11);
    setQuotations(prev =>
      prev.map(q =>
        q.id === quotationId
          ? {
              ...q,
              items,
              subtotal: totals.subtotal,
              taxAmount: totals.taxAmount,
              grandTotal: totals.grandTotal,
              totalCogs: totals.totalCogs,
              grossProfit: totals.grossProfit,
              grossMarginPercent: totals.grossMarginPercent,
            }
          : q
      )
    );
    showToast('Pembaruan HPP/COGS dan harga berhasil disimpan.');
  };

  // Confirm WhatsApp simulated dispatch
  const handleConfirmWhatsApp = (quotationId: string) => {
    setQuotations(prev =>
      prev.map(q =>
        q.id === quotationId
          ? {
              ...q,
              status: 'PDF_SENT',
              whatsAppStatus: 'DELIVERED',
            }
          : q
      )
    );
    showToast('Notifikasi WhatsApp & link PDF berhasil dikirim ke Sales!');
  };

  // New Custom product request submission
  const handleCustomRequestSubmit = (
    req: Omit<CustomProductRequest, 'id' | 'submittedAt' | 'status'>
  ) => {
    const newReq: CustomProductRequest = {
      ...req,
      id: `req-${Date.now()}`,
      submittedAt: new Date().toLocaleString('id-ID'),
      status: 'PENDING_PRICING',
    };
    setCustomRequests([newReq, ...customRequests]);
    showToast('Request barang custom berhasil dikirim ke tim Sales Support!');
  };

  const pendingReviewCount = quotations.filter(q => q.status === 'PENDING_REVIEW').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-top-3 duration-200 border border-slate-700">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Responsive Dark Sidebar matching the reference design */}
      <Sidebar
        currentRole={currentRole}
        currentUser={currentUser}
        currentView={currentView}
        onNavigate={view => setCurrentView(view)}
        onSwitchRole={handleSwitchRole}
        pendingReviewCount={pendingReviewCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <TopBar
          title={
            currentView === 'dashboard' || currentView === 'support-dashboard'
              ? 'Beranda'
              : currentView === 'create-quotation'
              ? 'Buat Penawaran'
              : currentView === 'support-reviews'
              ? 'Pengajuan Penawaran'
              : currentView === 'catalog' || currentView === 'catalog-pricing'
              ? 'Katalog Produk'
              : currentView === 'discount-rules'
              ? 'Aturan Diskon'
              : currentView === 'custom-request'
              ? 'Request Custom'
              : 'Portal Penawaran'
          }
          subtitle={
            currentRole === 'SALES'
              ? 'Agusta Sales Portal · Automated Quotation System'
              : 'Agusta Sales Support & Management Portal'
          }
          currentRole={currentRole}
          currentUser={currentUser}
          onSwitchRole={handleSwitchRole}
          unreadCount={pendingReviewCount}
        />

        {/* Viewport Router */}
        <main className="flex-1 overflow-y-auto">
          {/* SALES VIEWS */}
          {currentRole === 'SALES' && (
            <>
              {currentView === 'dashboard' && (
                <SalesDashboard
                  quotations={quotations}
                  onStartNewQuotation={() => setCurrentView('create-quotation')}
                  onViewQuotation={q => {
                    if (q.status === 'APPROVED' || q.status === 'PDF_SENT') {
                      setActivePdfQuotation(q);
                      setPdfModalOpen(true);
                    } else {
                      showToast(`Penawaran ${q.quotationNumber} saat ini sedang dalam proses review Sales Support.`, 'info');
                    }
                  }}
                  onViewCatalog={() => setCurrentView('catalog')}
                  onViewCustomRequest={() => setCustomRequestModalOpen(true)}
                />
              )}

              {currentView === 'create-quotation' && (
                <QuotationWizard
                  products={products}
                  currentUser={currentUser}
                  onSubmitQuotation={handleCreateQuotation}
                  onCancel={() => setCurrentView('dashboard')}
                  onOpenCustomRequest={() => setCustomRequestModalOpen(true)}
                />
              )}

              {currentView === 'quotation-history' && (
                <div className="p-8 max-w-7xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        Riwayat Penawaran Harga
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Daftar lengkap seluruh pengajuan surat penawaran Anda
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentView('create-quotation')}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      + Buat Penawaran Baru
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">No. Penawaran</th>
                          <th className="py-3 px-4">Tanggal</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4 text-right">Total Penawaran</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Dokumen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quotations.map(q => (
                          <tr key={q.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {q.quotationNumber}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {q.date}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900">{q.customer.companyName}</div>
                              <div className="text-[11px] text-slate-500">{q.customer.contactPerson}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                              Rp {q.grandTotal.toLocaleString('id-ID')}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  q.status === 'APPROVED' || q.status === 'PDF_SENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : q.status === 'PENDING_REVIEW'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {q.status === 'APPROVED'
                                  ? 'Disetujui'
                                  : q.status === 'PDF_SENT'
                                  ? 'PDF Terbit'
                                  : q.status === 'PENDING_REVIEW'
                                  ? 'Menunggu Review'
                                  : 'Perlu Revisi'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {q.status === 'APPROVED' || q.status === 'PDF_SENT' ? (
                                <button
                                  onClick={() => {
                                    setActivePdfQuotation(q);
                                    setPdfModalOpen(true);
                                  }}
                                  className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded text-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Lihat PDF</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Menunggu Approval</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {currentView === 'catalog' && (
                <CatalogBrowser
                  products={products}
                  currentRole={currentRole}
                  onSelectProductForQuotation={product => {
                    setCurrentView('create-quotation');
                    showToast(`Produk ${product.name} siap ditambahkan ke penawaran baru!`);
                  }}
                />
              )}

              {currentView === 'custom-request' && (
                <div className="p-8 max-w-7xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        Daftar Request Barang Custom
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Status permohonan spesifikasi barang non-katalog yang diajukan ke tim Sales Support
                      </p>
                    </div>
                    <button
                      onClick={() => setCustomRequestModalOpen(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      + Ajukan Request Baru
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Nama Barang</th>
                          <th className="py-3 px-4">Kategori</th>
                          <th className="py-3 px-4 text-center">Estimasi Qty</th>
                          <th className="py-3 px-4 text-right">Target Harga</th>
                          <th className="py-3 px-4">Tanggal Pengajuan</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customRequests.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{req.productName}</div>
                              <div className="text-[11px] text-slate-500 line-clamp-1">{req.specs}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">{req.category}</td>
                            <td className="py-3.5 px-4 text-center font-bold tabular-nums">
                              {req.estimatedQty} Unit
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                              Rp {req.targetPricePerUnit.toLocaleString('id-ID')}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {req.submittedAt}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Menunggu Kalkulasi HPP
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SALES SUPPORT VIEWS */}
          {(currentRole === 'SALES_SUPPORT' || currentRole === 'MANAGEMENT') && (
            <>
              {(currentView === 'support-dashboard' || currentView === 'support-reviews') && (
                <SalesSupportDashboard
                  quotations={quotations}
                  onApproveAndGeneratePdf={handleApproveQuotation}
                  onRejectQuotation={handleRejectQuotation}
                  onUpdateQuotationPricing={handleUpdateQuotationPricing}
                  onOpenPdfPreview={q => {
                    setActivePdfQuotation(q);
                    setPdfModalOpen(true);
                  }}
                  onOpenWhatsApp={q => {
                    setActiveWhatsAppQuotation(q);
                    setWhatsAppModalOpen(true);
                  }}
                />
              )}

              {currentView === 'catalog-pricing' && (
                <CatalogBrowser
                  products={products}
                  currentRole={currentRole}
                />
              )}

              {currentView === 'discount-rules' && (
                <div className="p-8 max-w-7xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        Aturan Diskon & Safety Margin
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Konfigurasi aturan diskon otomatis bertingkat dan batas margin modal (COGS)
                      </p>
                    </div>
                    <button
                      onClick={() => setDiscountRulesModalOpen(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Buka Konfigurasi Diskon
                    </button>
                  </div>

                  <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sistem menggunakan aturan berbasis volume dan tipe akun untuk memberikan saran diskon saat Sales mengajukan kuantitas:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <strong className="text-slate-900 block mb-1">Corporate Tier</strong>
                        <span className="text-slate-500">
                          Qty &ge; 5: 5% diskon<br />
                          Qty &ge; 20: 8% diskon<br />
                          Qty &ge; 50: 10% diskon
                        </span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <strong className="text-slate-900 block mb-1">BUMN & Pemerintah</strong>
                        <span className="text-slate-500">
                          Saran diskon otomatis 5% standar pengadaan e-katalog LKPP.
                        </span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <strong className="text-slate-900 block mb-1">Floor Margin (COGS Safety)</strong>
                        <span className="text-slate-500">
                          Diskon yang menyebabkan margin jatuh di bawah 12% akan otomatis memicu peringatan merah.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'reports' && (
                <div className="p-8 max-w-7xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Laporan Finansial & Analisis Margin
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Agregasi perputaran modal (COGS) vs nilai jual penawaran disetujui
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-xs font-semibold text-slate-500">Total Penawaran Terbit</div>
                      <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
                        Rp 416.250.000
                      </div>
                    </div>
                    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-xs font-semibold text-slate-500">Total COGS (HPP Terikat)</div>
                      <div className="text-2xl font-black text-amber-700 mt-2 tabular-nums">
                        Rp 281.700.000
                      </div>
                    </div>
                    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-xs font-semibold text-slate-500">Rata-rata Gross Margin</div>
                      <div className="text-2xl font-black text-emerald-600 mt-2 tabular-nums">
                        32.3%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'users' && (
                <div className="p-8 max-w-7xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Manajemen Pengguna & Hak Akses (RBAC)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Daftar akun tim Sales dan Sales Support yang aktif dalam sistem penawaran
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Nama User</th>
                          <th className="py-3 px-4">Jabatan</th>
                          <th className="py-3 px-4">Role Akses</th>
                          <th className="py-3 px-4">WhatsApp / Telp</th>
                          <th className="py-3 px-4">Akses COGS (Modal)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {USERS.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4 font-bold text-slate-900">{u.name}</td>
                            <td className="py-3.5 px-4 text-slate-600">{u.title}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold ${
                                  u.role === 'SALES'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {u.role === 'SALES' ? 'Sales' : 'Sales Support'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">{u.phone}</td>
                            <td className="py-3.5 px-4">
                              {u.role === 'SALES' ? (
                                <span className="text-slate-400 font-medium">Tersembunyi (Hidden)</span>
                              ) : (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <ShieldCheck className="w-4 h-4" /> Akses Penuh & Override
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <QuotationPdfModal
        quotation={activePdfQuotation}
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        onOpenWhatsAppModal={q => {
          setActiveWhatsAppQuotation(q);
          setWhatsAppModalOpen(true);
        }}
      />

      <WhatsAppModal
        quotation={activeWhatsAppQuotation}
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        onConfirmSend={handleConfirmWhatsApp}
      />

      <CustomRequestModal
        isOpen={customRequestModalOpen}
        onClose={() => setCustomRequestModalOpen(false)}
        currentUser={currentUser}
        onSubmitRequest={handleCustomRequestSubmit}
      />

      <DiscountRulesModal
        isOpen={discountRulesModalOpen}
        onClose={() => setDiscountRulesModalOpen(false)}
      />
    </div>
  );
}
