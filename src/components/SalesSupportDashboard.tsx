import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Save,
  Send,
  Building2,
  Calendar,
  User,
  ShieldAlert,
  Percent,
  Download,
  Eye,
  Edit3,
} from 'lucide-react';
import { Quotation, QuotationStatus, QuotationItemData } from '../types';
import {
  formatRupiah,
  calculateLineSubtotal,
  calculateQuotationTotals,
  validateMarginSafety,
} from '../utils/quotationEngine';
import { ProductAssetThumb } from './ProductAssetThumb';

interface SalesSupportDashboardProps {
  quotations: Quotation[];
  onApproveAndGeneratePdf: (quotation: Quotation) => void;
  onRejectQuotation: (quotationId: string, reason: string) => void;
  onUpdateQuotationPricing: (quotationId: string, updatedItems: QuotationItemData[]) => void;
  onOpenPdfPreview: (quotation: Quotation) => void;
  onOpenWhatsApp: (quotation: Quotation) => void;
}

export const SalesSupportDashboard: React.FC<SalesSupportDashboardProps> = ({
  quotations,
  onApproveAndGeneratePdf,
  onRejectQuotation,
  onUpdateQuotationPricing,
  onOpenPdfPreview,
  onOpenWhatsApp,
}) => {
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchFilter, setSearchFilter] = useState('');
  const [detailTab, setDetailTab] = useState<'ITEMS' | 'NOTES'>('ITEMS');

  // Editable items state inside Detail view
  const [editableItems, setEditableItems] = useState<QuotationItemData[]>([]);
  const [supportNoteInput, setSupportNoteInput] = useState('');
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleSelectQuotation = (q: Quotation) => {
    setSelectedQuotation(q);
    setEditableItems(JSON.parse(JSON.stringify(q.items)));
    setSupportNoteInput(q.supportNotes || '');
    setShowRejectPrompt(false);
  };

  const handleCogsChange = (index: number, newCogs: number) => {
    const updated = [...editableItems];
    updated[index].cogs = Math.max(0, newCogs);
    setEditableItems(updated);
  };

  const handlePriceChange = (index: number, newPrice: number) => {
    const updated = [...editableItems];
    updated[index].sellingPrice = Math.max(0, newPrice);
    updated[index].subtotal = calculateLineSubtotal({
      qty: updated[index].qty,
      sellingPrice: newPrice,
      discountPercent: updated[index].discountPercent,
    });
    setEditableItems(updated);
  };

  const handleDiscountChange = (index: number, newDiscount: number) => {
    const updated = [...editableItems];
    updated[index].discountPercent = Math.min(100, Math.max(0, newDiscount));
    updated[index].subtotal = calculateLineSubtotal({
      qty: updated[index].qty,
      sellingPrice: updated[index].sellingPrice,
      discountPercent: updated[index].discountPercent,
    });
    setEditableItems(updated);
  };

  // Recalculate totals on the fly for support review
  const liveTotals = calculateQuotationTotals(editableItems, true, 11);

  const handleSaveChanges = () => {
    if (!selectedQuotation) return;
    onUpdateQuotationPricing(selectedQuotation.id, editableItems);
    alert('Perubahan harga dan COGS (HPP) berhasil disimpan.');
  };

  const handleApprove = () => {
    if (!selectedQuotation) return;
    const updatedQuotation: Quotation = {
      ...selectedQuotation,
      items: editableItems,
      subtotal: liveTotals.subtotal,
      taxAmount: liveTotals.taxAmount,
      grandTotal: liveTotals.grandTotal,
      totalCogs: liveTotals.totalCogs,
      grossProfit: liveTotals.grossProfit,
      grossMarginPercent: liveTotals.grossMarginPercent,
      supportNotes: supportNoteInput,
    };
    onApproveAndGeneratePdf(updatedQuotation);
  };

  const handleConfirmReject = () => {
    if (!selectedQuotation) return;
    if (!rejectReason.trim()) {
      alert('Mohon isi alasan penolakan/revisi agar tim Sales dapat memperbaiki.');
      return;
    }
    onRejectQuotation(selectedQuotation.id, rejectReason);
    setShowRejectPrompt(false);
    setSelectedQuotation(null);
  };

  // Filter list
  const filteredList = quotations.filter(q => {
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      q.customer.companyName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      q.salesName.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'PENDING') return q.status === 'PENDING_REVIEW';
    if (activeTab === 'APPROVED') return q.status === 'APPROVED' || q.status === 'PDF_SENT';
    if (activeTab === 'REJECTED') return q.status === 'REJECTED';
    return true;
  });

  const pendingCount = quotations.filter(q => q.status === 'PENDING_REVIEW').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* If a quotation is selected: show SCREEN 4 (Detail Pengajuan Penawaran) */}
      {selectedQuotation ? (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedQuotation(null)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Detail Pengajuan Penawaran</span>
            </button>

            <div className="flex items-center gap-2">
              {selectedQuotation.status === 'APPROVED' || selectedQuotation.status === 'PDF_SENT' ? (
                <>
                  <button
                    onClick={() => onOpenPdfPreview(selectedQuotation)}
                    className="px-3.5 py-1.5 rounded-lg border border-red-600 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Lihat Dokumen PDF</span>
                  </button>
                  <button
                    onClick={() => onOpenWhatsApp(selectedQuotation)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>WhatsApp Sales</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Quotation Meta Box matching screenshot 4 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl font-black text-slate-900 tracking-tight">
                  {selectedQuotation.quotationNumber}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {selectedQuotation.status === 'PENDING_REVIEW'
                    ? 'Menunggu Review'
                    : selectedQuotation.status === 'APPROVED'
                    ? 'Disetujui'
                    : selectedQuotation.status === 'PDF_SENT'
                    ? 'PDF Terkirim'
                    : 'Ditolak'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-6 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Customer:</span>{' '}
                  <strong className="text-slate-900">{selectedQuotation.customer.companyName}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Sales:</span>{' '}
                  <strong className="text-slate-900">{selectedQuotation.salesName}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Tanggal Pengajuan:</span>{' '}
                  <strong className="text-slate-900">{selectedQuotation.date}</strong>
                </div>
              </div>
            </div>

            {/* Total Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-right shrink-0">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Total Estimasi (Harga Jual)
              </div>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatRupiah(liveTotals.subtotal)}
              </div>
              <div className="text-[11px] text-slate-400">
                Grand Total inc. PPN: {formatRupiah(liveTotals.grandTotal)}
              </div>
            </div>
          </div>

          {/* Sensitive COGS & Margin Metrics Bar (Only visible to Sales Support & Management) */}
          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center font-bold">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  RBAC Sales Support · Analisis Sensitif COGS (HPP) & Margin
                </div>
                <div className="text-xs text-slate-300">
                  Data ini terenkripsi dan tersembunyi dari portal Sales. Anda dapat meng-override HPP dan diskon.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Total Modal (COGS):</span>
                <span className="font-bold text-amber-300 text-sm tabular-nums">
                  {formatRupiah(liveTotals.totalCogs)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Gross Profit:</span>
                <span className="font-bold text-emerald-400 text-sm tabular-nums">
                  {formatRupiah(liveTotals.grossProfit)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Gross Margin:</span>
                <span
                  className={`font-black text-sm tabular-nums px-2 py-0.5 rounded ${
                    liveTotals.grossMarginPercent >= 15
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {liveTotals.grossMarginPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Tabs: Rincian Produk / Catatan & Lampiran */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 px-6 pt-4 flex gap-6">
              <button
                onClick={() => setDetailTab('ITEMS')}
                className={`pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  detailTab === 'ITEMS'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Rincian Produk
              </button>
              <button
                onClick={() => setDetailTab('NOTES')}
                className={`pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  detailTab === 'NOTES'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Catatan & Lampiran
              </button>
            </div>

            {detailTab === 'ITEMS' && (
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">No</th>
                      <th className="py-3 px-4">Produk</th>
                      <th className="py-3 px-2 text-center w-16">Qty</th>
                      <th className="py-3 px-3 text-right bg-amber-50/50 text-amber-900 border-x border-amber-200/50">
                        COGS (HPP)
                      </th>
                      <th className="py-3 px-3 text-right">Harga Jual</th>
                      <th className="py-3 px-2 text-center w-24">Diskon</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editableItems.map((item, idx) => {
                      const safety = validateMarginSafety(
                        item.cogs,
                        item.sellingPrice,
                        item.discountPercent
                      );

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-3 text-center font-bold text-slate-500">
                            {idx + 1}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <ProductAssetThumb
                                category={item.category}
                                name={item.productName}
                                className="w-10 h-10 shrink-0 bg-white"
                              />
                              <div>
                                <div className="font-bold text-slate-900 text-xs">
                                  {item.productName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.sku}
                                </div>
                                {item.notes && (
                                  <div className="text-[10px] text-slate-500 italic mt-0.5">
                                    "{item.notes}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-2 text-center font-bold text-slate-900 tabular-nums">
                            {item.qty}
                          </td>

                          {/* Editable COGS / HPP (Only Sales Support can modify) */}
                          <td className="py-3.5 px-3 text-right bg-amber-50/30 border-x border-amber-200/30">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-amber-700 font-bold">Rp</span>
                              <input
                                type="number"
                                value={item.cogs}
                                onChange={e => handleCogsChange(idx, Number(e.target.value))}
                                className="w-24 px-1.5 py-1 text-right font-bold text-amber-900 bg-white border border-amber-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                            <span className="text-[9px] text-amber-700 block mt-0.5">
                              Margin: {safety.currentMarginPercent}%
                            </span>
                          </td>

                          {/* Editable Selling Price */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-400">Rp</span>
                              <input
                                type="number"
                                value={item.sellingPrice}
                                onChange={e => handlePriceChange(idx, Number(e.target.value))}
                                className="w-24 px-1.5 py-1 text-right font-bold text-slate-900 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                              />
                            </div>
                          </td>

                          {/* Editable Discount */}
                          <td className="py-3.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={50}
                                value={item.discountPercent}
                                onChange={e => handleDiscountChange(idx, Number(e.target.value))}
                                className="w-12 px-1 py-1 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                              />
                              <span className="text-slate-400 font-bold">%</span>
                            </div>
                            {!safety.isSafe && (
                              <span className="text-[9px] text-rose-600 font-bold flex items-center justify-center gap-0.5 mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Margin Tipis
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                            {formatRupiah(item.subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {detailTab === 'NOTES' && (
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">Catatan dari Sales (Ismi Putri):</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed italic">
                    "{selectedQuotation.salesNotes || 'Tidak ada catatan tambahan.'}"
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">Catatan Tim Sales Support & Ketentuan:</h4>
                  <textarea
                    rows={3}
                    value={supportNoteInput}
                    onChange={e => setSupportNoteInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-red-500"
                    placeholder="Tuliskan catatan internal, instruksi pengiriman, atau catatan persetujuan..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer matching screenshot 4 */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Perubahan COGS & Diskon otomatis memperbarui kalkulasi margin sebelum dokumen diterbitkan.
            </div>

            <div className="flex items-center gap-3">
              {/* Reject button */}
              <button
                onClick={() => setShowRejectPrompt(true)}
                className="px-5 py-2.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
              >
                Tolak / Minta Revisi
              </button>

              {/* Save Draft button */}
              <button
                onClick={handleSaveChanges}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Draft</span>
              </button>

              {/* Approve & Generate PDF button (matching screenshot) */}
              <button
                onClick={handleApprove}
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 flex items-center gap-2 transition-all cursor-pointer transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Setujui & Buat PDF</span>
              </button>
            </div>
          </div>

          {/* Rejection Modal Prompt */}
          {showRejectPrompt && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 text-rose-600">
                  <XCircle className="w-5 h-5" />
                  <span>Tolak Pengajuan Penawaran</span>
                </h3>
                <p className="text-xs text-slate-600">
                  Berikan alasan penolakan atau instruksi revisi harga/kuantitas agar tim Sales dapat menindaklanjuti.
                </p>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Contoh: Diskon terlalu tinggi (margin < 12%), mohon turunkan diskon meja ke 5%..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-rose-500"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowRejectPrompt(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmReject}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                  >
                    Kirim Penolakan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SCREEN 3: Pengajuan Penawaran Queue List */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Pengajuan Penawaran
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Review pengajuan surat penawaran dari tim Sales, periksa COGS, sesuaikan margin, dan setujui penerbitan PDF.
              </p>
            </div>
          </div>

          {/* Tabs matching screenshot 3 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'PENDING'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Menunggu Review</span>
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('APPROVED')}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'APPROVED'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Disetujui
              </button>

              <button
                onClick={() => setActiveTab('REJECTED')}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'REJECTED'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ditolak
              </button>

              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua
              </button>
            </div>

            {/* Search and Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Cari nomor, customer, atau sales..."
                  className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-red-500 w-64 bg-white"
                />
              </div>

              <button
                aria-label="Filter pengajuan"
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Table matching screenshot 3 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">No. Pengajuan</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Sales</th>
                    <th className="py-3.5 px-4">Tanggal</th>
                    <th className="py-3.5 px-4 text-right">Total Estimasi</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map(q => (
                    <tr
                      key={q.id}
                      onClick={() => handleSelectQuotation(q)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">
                        {q.quotationNumber}
                      </td>

                      <td className="py-4 px-4 font-semibold text-slate-900">
                        {q.customer.companyName}
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        {q.salesName}
                      </td>

                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                        {q.date}
                      </td>

                      <td className="py-4 px-4 text-right font-black text-slate-900 tabular-nums">
                        {formatRupiah(q.subtotal)}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                            q.status === 'PENDING_REVIEW'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : q.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : q.status === 'PDF_SENT'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {q.status === 'PENDING_REVIEW'
                            ? 'Menunggu Review'
                            : q.status === 'APPROVED'
                            ? 'Disetujui'
                            : q.status === 'PDF_SENT'
                            ? 'PDF Terkirim'
                            : 'Ditolak'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectQuotation(q);
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Review Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
