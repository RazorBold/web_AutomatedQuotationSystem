import React, { useState } from 'react';
import {
  Search,
  Grid,
  List,
  Filter,
  CheckCircle2,
  ExternalLink,
  Plus,
  ShieldAlert,
  Info,
  X,
  PhoneCall,
  Check,
} from 'lucide-react';
import { Product, UserRole } from '../types';
import { formatRupiah } from '../utils/quotationEngine';
import { AgustaLogo } from './AgustaLogo';
import { ProductAssetThumb } from './ProductAssetThumb';

interface CatalogBrowserProps {
  products: Product[];
  currentRole: UserRole;
  onSelectProductForQuotation?: (product: Product) => void;
  onUpdateProductCogs?: (productId: string, newCogs: number, newBasePrice: number) => void;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({
  products,
  currentRole,
  onSelectProductForQuotation,
  onUpdateProductCogs,
}) => {
  const isSalesSupport = currentRole === 'SALES_SUPPORT' || currentRole === 'MANAGEMENT';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua Kategori');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);

  // Categories list matching screenshot 2
  const categories = [
    'Semua Kategori',
    'Kursi Kantor',
    'AIO',
    'Kursi Tunggu',
    'Kursi Bar',
    'Kursi Direktur',
    'Meja Resepsionis',
    'Meja Sekolah',
    'Side Table',
    'Dressing Table',
    'Coffee Table',
    'Multi Purpose',
    'Locker',
    'Troley Buku',
    'Rak Buku',
    'Wardrobe',
    'Lemari Arsip',
    'Label Printer',
    'Meja Serbaguna',
    'Meja Rapat',
    'Cradenza',
  ];

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'Semua Kategori' ||
      product.category.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isSalesSupport ? 'Katalog & Manajemen Harga (HPP)' : 'Katalog Produk Agusta'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isSalesSupport
              ? 'Kelola daftar harga pokok penjualan (COGS), harga jual base, dan margin keuntungan.'
              : 'Jelajahi seluruh lini produk perabot kantor dan perangkat IT resmi PT Agusta.'}
          </p>
        </div>

        {/* RBAC Info Pill */}
        {isSalesSupport ? (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Mode Sales Support: Kolom COGS (Modal) Aktif</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Katalog Sales (Harga Modal Disembunyikan)</span>
          </div>
        )}
      </div>

      {/* Main Layout Split: Categories Sidebar + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Categories Sidebar matching screenshot 2 */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Filter className="w-4 h-4 text-red-600" />
            <h3 className="font-bold text-slate-900 text-sm">Kategori Produk</h3>
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {categories.map(cat => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Product Grid matching screenshot 2 & 3 */}
        <div className="lg:col-span-9 space-y-4">
          {/* Top Search & Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk atau tipe..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-red-500 bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Menampilkan <strong>{filteredProducts.length}</strong> produk
              </span>

              <div className="flex items-center border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Product Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => setActiveModalProduct(product)}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden cursor-pointer group"
              >
                <div>
                  {/* Card Brand Header */}
                  <div className="p-4 pb-0 flex items-center justify-between">
                    <AgustaLogo size="sm" />
                    {product.eKatalogLkpp && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        E-Katalog
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="h-48 w-full p-4 flex items-center justify-center bg-white">
                    <ProductAssetThumb
                      category={product.category}
                      name={product.name}
                      src={product.image}
                      className="h-full w-full bg-white group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-5 pt-0">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                      {product.category}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1 leading-snug line-clamp-2">
                      {product.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {product.specs}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {isSalesSupport && (
                        <div className="text-[10px] text-amber-700 font-semibold font-mono">
                          COGS: {formatRupiah(product.cogs)}
                        </div>
                      )}
                      <div className="text-sm font-black text-slate-900 tabular-nums">
                        {formatRupiah(product.basePrice)}
                      </div>
                    </div>

                    {onSelectProductForQuotation ? (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectProductForQuotation(product);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Pilih</span>
                      </button>
                    ) : (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setActiveModalProduct(product);
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-red-600 cursor-pointer"
                      >
                        Detail &rarr;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product Detail Modal matching screenshot 4 (image_6fcb2339.png) */}
      {activeModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <AgustaLogo size="sm" />
                <span className="text-xs text-slate-400 font-mono">SKU: {activeModalProduct.sku}</span>
              </div>
              <button
                onClick={() => setActiveModalProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Product Image Column */}
              <div className="md:col-span-5 bg-slate-50 rounded-xl p-6 border border-slate-200 flex items-center justify-center">
                <ProductAssetThumb
                  category={activeModalProduct.category}
                  name={activeModalProduct.name}
                  src={activeModalProduct.image}
                  className="max-h-72 w-full bg-slate-50 drop-shadow-md"
                />
              </div>

              {/* Product Info & Specs Column */}
              <div className="md:col-span-7 space-y-5">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {activeModalProduct.category}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1 leading-tight">
                    {activeModalProduct.name}
                  </h3>
                  {activeModalProduct.isBestSeller && (
                    <div className="text-xs font-semibold text-amber-600 mt-1">
                      ★★★★★ (Best Seller Product)
                    </div>
                  )}
                </div>

                {/* Price Display */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Harga Katalog Base:</div>
                    <div className="text-2xl font-black text-slate-900 tabular-nums">
                      {formatRupiah(activeModalProduct.basePrice)}
                    </div>
                  </div>

                  {isSalesSupport && (
                    <div className="text-right">
                      <div className="text-xs text-amber-700 font-semibold">Harga Modal (COGS/HPP):</div>
                      <div className="text-lg font-black text-amber-800 tabular-nums">
                        {formatRupiah(activeModalProduct.cogs)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Buttons matching screenshot 4 */}
                <div className="flex items-center gap-3">
                  <button className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer">
                    <ExternalLink className="w-4 h-4" />
                    <span>LKPP (E-Katalog)</span>
                  </button>

                  <button className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer">
                    <PhoneCall className="w-4 h-4" />
                    <span>Hubungi Sales</span>
                  </button>
                </div>

                {/* Technical Specifications Table matching screenshot 4 */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Spesifikasi Teknis</span>
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-3 p-3 border-b border-slate-100 bg-slate-50">
                      <span className="font-semibold text-slate-600">Tipe / Model</span>
                      <span className="col-span-2 text-slate-900 font-medium">{activeModalProduct.name}</span>
                    </div>

                    <div className="grid grid-cols-3 p-3 border-b border-slate-100">
                      <span className="font-semibold text-slate-600">Berat</span>
                      <span className="col-span-2 text-slate-900 font-medium">
                        {activeModalProduct.weightKg ? `${activeModalProduct.weightKg} kg` : '2.500,00 gr'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-3 border-b border-slate-100 bg-slate-50">
                      <span className="font-semibold text-slate-600">Dimensi Produk</span>
                      <span className="col-span-2 text-slate-900 font-medium">
                        {activeModalProduct.dimensions || 'P 150 cm x L 72 cm x T 9 cm'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-3">
                      <span className="font-semibold text-slate-600">Deskripsi Produk</span>
                      <span className="col-span-2 text-slate-900 leading-relaxed font-medium">
                        {activeModalProduct.specs} | {activeModalProduct.description}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
