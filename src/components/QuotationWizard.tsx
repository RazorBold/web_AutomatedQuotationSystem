import React, { useState } from 'react';
import {
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { Product, CustomerInfo, QuotationItemData, UserProfile } from '../types';
import {
  smartProductSearch,
  getSuggestedDiscount,
  calculateLineSubtotal,
  formatRupiah,
} from '../utils/quotationEngine';
import { AgustaLogo } from './AgustaLogo';
import { ProductAssetThumb } from './ProductAssetThumb';

interface QuotationWizardProps {
  products: Product[];
  currentUser: UserProfile;
  onSubmitQuotation: (data: {
    customer: CustomerInfo;
    items: QuotationItemData[];
    salesNotes: string;
  }) => void;
  onCancel: () => void;
  onOpenCustomRequest: () => void;
}

export const QuotationWizard: React.FC<QuotationWizardProps> = ({
  products,
  currentUser,
  onSubmitQuotation,
  onCancel,
  onOpenCustomRequest,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Search & Selection
  const [searchQuery, setSearchQuery] = useState('kursi kantor ergonomis');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedItems, setSelectedItems] = useState<
    Array<{ product: Product; qty: number; discountPercent: number; notes: string }>
  >([
    // Pre-populate with reference item for immediate delight
    { product: products[0], qty: 10, discountPercent: 10, notes: 'Warna Sandaran Jaring Hitam' },
    { product: products[3], qty: 5, discountPercent: 5, notes: 'Termasuk Windows 11 Pro Original' },
  ]);

  // Step 2: Customer Data
  const [customer, setCustomer] = useState<CustomerInfo>({
    companyName: 'PT Maju Bersama',
    contactPerson: 'Bapak Hendra Wijaya',
    phone: '+62 811-2233-4455',
    email: 'procurement@majubersama.co.id',
    address: 'Gedung Menara Mandiri Lt. 18, Jl. Jend. Sudirman Kav. 54-55',
    city: 'Jakarta Selatan',
    category: 'CORPORATE',
  });

  // Step 3: Sales Notes
  const [salesNotes, setSalesNotes] = useState(
    'Kebutuhan untuk penambahan fasilitas kantor cabang. Client meminta kepastian delivery maksimal 2 minggu.'
  );

  const recommendationChips = [
    'kursi kantor',
    'kursi kerja',
    'ergonomis',
    'kursi direktur',
    'komputer aio',
    'meja rapat',
  ];

  // Filter products by smart search
  const filteredProducts = smartProductSearch(products, searchQuery).filter(p =>
    selectedCategory === 'ALL' ? true : p.category === selectedCategory
  );

  const handleSelectItem = (product: Product) => {
    const existingIndex = selectedItems.findIndex(i => i.product.id === product.id);
    if (existingIndex > -1) {
      // Increment
      const updated = [...selectedItems];
      updated[existingIndex].qty += 1;
      setSelectedItems(updated);
    } else {
      // Add with suggested discount
      const suggested = getSuggestedDiscount(1, customer.category);
      setSelectedItems([
        ...selectedItems,
        {
          product,
          qty: 1,
          discountPercent: suggested.suggestedPercent,
          notes: '',
        },
      ]);
    }
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...selectedItems];
    updated[index].qty = newQty;

    // Auto-update suggested discount based on quantity
    const suggested = getSuggestedDiscount(newQty, customer.category);
    if (updated[index].discountPercent < suggested.suggestedPercent) {
      updated[index].discountPercent = suggested.suggestedPercent;
    }

    setSelectedItems(updated);
  };

  const handleUpdateDiscount = (index: number, discount: number) => {
    const updated = [...selectedItems];
    updated[index].discountPercent = Math.min(100, Math.max(0, discount));
    setSelectedItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  // Calculations for review
  const itemsCalculation = selectedItems.map(item => {
    const subtotal = calculateLineSubtotal({
      qty: item.qty,
      sellingPrice: item.product.basePrice,
      discountPercent: item.discountPercent,
    });
    return {
      ...item,
      subtotal,
    };
  });

  const rawSubtotal = itemsCalculation.reduce((acc, curr) => acc + curr.subtotal, 0);
  const taxAmount = Math.round(rawSubtotal * 0.11);
  const grandTotal = rawSubtotal + taxAmount;

  const handleSubmit = () => {
    if (selectedItems.length === 0) {
      alert('Pilih minimal 1 produk untuk mengajukan penawaran.');
      return;
    }

    const quotationItems: QuotationItemData[] = selectedItems.map((item, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      category: item.product.category,
      image: item.product.image,
      qty: item.qty,
      unit: item.product.unit,
      cogs: item.product.cogs, // Attached internally for Sales Support review
      basePrice: item.product.basePrice,
      sellingPrice: item.product.basePrice,
      discountPercent: item.discountPercent,
      subtotal: calculateLineSubtotal({
        qty: item.qty,
        sellingPrice: item.product.basePrice,
        discountPercent: item.discountPercent,
      }),
      notes: item.notes,
    }));

    onSubmitQuotation({
      customer,
      items: quotationItems,
      salesNotes,
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Stepper Indicator */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
          {/* Step 1 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                currentStep >= 1
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              1
            </div>
            <span
              className={`mt-2 text-xs font-semibold ${
                currentStep === 1 ? 'text-red-600' : 'text-slate-600'
              }`}
            >
              Pilih Produk
            </span>
          </div>

          <div
            className={`flex-1 h-0.5 mx-4 transition-colors ${
              currentStep >= 2 ? 'bg-red-600' : 'bg-slate-200'
            }`}
          />

          {/* Step 2 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                currentStep >= 2
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              2
            </div>
            <span
              className={`mt-2 text-xs font-semibold ${
                currentStep === 2 ? 'text-red-600' : 'text-slate-600'
              }`}
            >
              Detail Penawaran
            </span>
          </div>

          <div
            className={`flex-1 h-0.5 mx-4 transition-colors ${
              currentStep >= 3 ? 'bg-red-600' : 'bg-slate-200'
            }`}
          />

          {/* Step 3 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                currentStep === 3
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              3
            </div>
            <span
              className={`mt-2 text-xs font-semibold ${
                currentStep === 3 ? 'text-red-600' : 'text-slate-600'
              }`}
            >
              Ajukan
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: PILIH PRODUK */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Search Box Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Cari Produk</h2>
              <p className="text-xs text-slate-500 mt-1">
                Temukan produk yang Anda butuhkan dengan kata kunci apa saja. Dilengkapi fitur Smart Search & sinonim.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari nama produk, kategori, spesifikasi, atau kata kunci acak..."
                  className="w-full pl-11 pr-10 py-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {}}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
              >
                Cari
              </button>
            </div>

            {/* Recommendation Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-slate-500 font-medium">Rekomendasi:</span>
              {recommendationChips.map(chip => (
                <button
                  key={chip}
                  onClick={() => setSearchQuery(chip)}
                  className={`px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                    searchQuery.toLowerCase() === chip
                      ? 'bg-red-50 border-red-200 text-red-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Results count label */}
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>
                Menampilkan <strong>{filteredProducts.length}</strong> produk relevan untuk "{searchQuery || 'semua'}"
              </span>
              <button
                onClick={onOpenCustomRequest}
                className="text-red-600 hover:text-red-700 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                Tidak menemukan produk? Request custom disini &rarr;
              </button>
            </div>
          </div>

          {/* Product Cards Grid matching the screenshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              const isSelected = selectedItems.some(i => i.product.id === product.id);
              const selectedCount = selectedItems.find(i => i.product.id === product.id)?.qty || 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
                >
                  {/* Card Header with Agusta Logo Badge */}
                  <div className="p-4 pb-0 flex items-center justify-between">
                    <AgustaLogo size="sm" />
                    {product.eKatalogLkpp && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        E-Katalog LKPP
                      </span>
                    )}
                  </div>

                  {/* Product Image */}
                  <div className="h-52 w-full p-4 flex items-center justify-center bg-white">
                    <ProductAssetThumb
                      category={product.category}
                      name={product.name}
                      src={product.image}
                      className="h-full w-full bg-white group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="p-5 pt-0 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                        {product.category}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1 leading-snug line-clamp-2">
                        {product.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {product.specs}
                      </p>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-slate-400">Harga Katalog Base</div>
                        <div className="text-base font-extrabold text-slate-900 tabular-nums">
                          {formatRupiah(product.basePrice)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectItem(product)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'bg-white hover:bg-red-50 text-red-600 border border-red-600 hover:border-red-700'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isSelected ? `Terpilih (${selectedCount})` : 'Pilih Produk'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Sticky Bottom Bar for Selected Products */}
          {selectedItems.length > 0 && (
            <div className="sticky bottom-6 bg-slate-900 text-white p-4 rounded-xl shadow-xl flex items-center justify-between z-30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
                  {selectedItems.length}
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total {selectedItems.length} Produk Dipilih</div>
                  <div className="text-lg font-black text-white tabular-nums">
                    {formatRupiah(rawSubtotal)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-red-600/30 transition-all cursor-pointer"
                >
                  <span>Lanjut ke Detail Penawaran</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: DETAIL PENAWARAN */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Customer Information Form (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-600" />
                <span>Informasi Customer</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Perusahaan / Instansi *
                  </label>
                  <input
                    type="text"
                    value={customer.companyName}
                    onChange={e => setCustomer({ ...customer, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Contoh: PT Maju Bersama"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIC / Contact Person *
                  </label>
                  <input
                    type="text"
                    value={customer.contactPerson}
                    onChange={e => setCustomer({ ...customer, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Contoh: Bapak Hendra Wijaya"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. WhatsApp / Telepon *
                  </label>
                  <input
                    type="text"
                    value={customer.phone}
                    onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Contoh: +62 811-2233-4455"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={e => setCustomer({ ...customer, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Contoh: procurement@perusahaan.co.id"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Klien</label>
                  <select
                    value={customer.category}
                    onChange={e =>
                      setCustomer({
                        ...customer,
                        category: e.target.value as CustomerInfo['category'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="CORPORATE">Corporate / Swasta</option>
                    <option value="BUMN_GOV">BUMN / Instansi Pemerintah</option>
                    <option value="EDUCATION">Pendidikan / Universitas</option>
                    <option value="RETAIL">Retail / Perorangan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Pengiriman</label>
                  <textarea
                    rows={3}
                    value={customer.address}
                    onChange={e => setCustomer({ ...customer, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Alamat lengkap tujuan kirim..."
                  />
                </div>
              </div>

              {/* RBAC notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
                <strong>Catatan RBAC Sales:</strong> Anda mengajukan harga jual base & usulan diskon.
                Harga modal (COGS/HPP) diatur dan direview secara aman oleh tim Sales Support.
              </div>
            </div>

            {/* Selected Items Table & Adjustments (8 cols) */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Rincian Produk & Kuantitas</h3>
                  <p className="text-xs text-slate-500">Sesuaikan kuantitas dan ajukan diskon.</p>
                </div>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Produk Lain</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Produk</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Harga Base</th>
                      <th className="py-2.5 px-2 text-center">Diskon (%)</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedItems.map((item, idx) => {
                      const subtotal = calculateLineSubtotal({
                        qty: item.qty,
                        sellingPrice: item.product.basePrice,
                        discountPercent: item.discountPercent,
                      });
                      const suggested = getSuggestedDiscount(item.qty, customer.category);

                      return (
                        <tr key={item.product.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <ProductAssetThumb
                                category={item.product.category}
                                name={item.product.name}
                                className="w-10 h-10 shrink-0 bg-white"
                              />
                              <div>
                                <div className="font-semibold text-slate-900">{item.product.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{item.product.sku}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center">
                            <div className="inline-flex items-center border border-slate-200 rounded-md">
                              <button
                                onClick={() => handleUpdateQty(idx, item.qty - 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-bold text-slate-900 tabular-nums">
                                {item.qty}
                              </span>
                              <button
                                onClick={() => handleUpdateQty(idx, item.qty + 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-medium text-slate-700 tabular-nums">
                            {formatRupiah(item.product.basePrice)}
                          </td>

                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={50}
                                value={item.discountPercent}
                                onChange={e => handleUpdateDiscount(idx, Number(e.target.value))}
                                className="w-12 px-1.5 py-1 text-center font-bold text-slate-900 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-red-500"
                              />
                              <span className="text-slate-400 font-bold">%</span>
                            </div>
                            {suggested.suggestedPercent > 0 && item.discountPercent !== suggested.suggestedPercent && (
                              <button
                                onClick={() => handleUpdateDiscount(idx, suggested.suggestedPercent)}
                                className="text-[9px] text-red-600 hover:underline mt-0.5 block mx-auto"
                              >
                                Rekom: {suggested.suggestedPercent}%
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                            {formatRupiah(subtotal)}
                          </td>

                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Totals */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-xs border border-slate-200/80">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({selectedItems.length} Produk)</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(rawSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>PPN 11% (Indonesia VAT)</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-900 text-sm font-extrabold pt-2 border-t border-slate-200">
                  <span>Total Estimasi Penawaran</span>
                  <span className="text-red-600 tabular-nums">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              {/* Navigation */}
              <div className="pt-4 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Pilih Produk</span>
                </button>

                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md shadow-red-600/30 transition-all cursor-pointer"
                >
                  <span>Lanjut ke Review & Ajukan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: AJUKAN */}
      {currentStep === 3 && (
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Konfirmasi Pengajuan Surat Penawaran
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Periksa kembali kelengkapan pengajuan sebelum dikirim ke Sales Support untuk proses review HPP, margin, dan approval.
            </p>
          </div>

          {/* Quick Review Box */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
                <span className="font-bold text-slate-900 text-sm">{customer.companyName}</span>
                <div className="text-slate-500">{customer.contactPerson} ({customer.phone})</div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Sales Pengaju</span>
                <span className="font-bold text-slate-900 text-sm">{currentUser.name}</span>
                <div className="text-slate-500">{currentUser.phone} · {currentUser.email}</div>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-2">
                Daftar Barang ({selectedItems.length} Item)
              </span>
              <ul className="divide-y divide-slate-200/60">
                {selectedItems.map(item => (
                  <li key={item.product.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">{item.product.name}</span>
                      <span className="text-slate-500 ml-2">x{item.qty} {item.product.unit}</span>
                      {item.discountPercent > 0 && (
                        <span className="ml-2 text-red-600 font-semibold">(Disc {item.discountPercent}%)</span>
                      )}
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatRupiah(
                        calculateLineSubtotal({
                          qty: item.qty,
                          sellingPrice: item.product.basePrice,
                          discountPercent: item.discountPercent,
                        })
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between font-bold text-sm text-slate-900">
              <span>Total Estimasi (Inc. PPN 11%)</span>
              <span className="text-red-600 text-base tabular-nums">{formatRupiah(grandTotal)}</span>
            </div>
          </div>

          {/* Sales Notes for Support */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Catatan untuk Tim Sales Support
            </label>
            <textarea
              rows={3}
              value={salesNotes}
              onChange={e => setSalesNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-red-500"
              placeholder="Berikan informasi mengenai urgensi, permohonan margin khusus, atau rincian teknis..."
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Kembali
            </button>

            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-md shadow-red-600/30 flex items-center gap-2 transition-all cursor-pointer transform active:scale-95"
            >
              <span>Ajukan ke Sales Support</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
