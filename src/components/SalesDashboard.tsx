import React from 'react';
import {
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Boxes,
  ArrowRight,
  TrendingUp,
  FileCheck,
  Send,
  Building2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { Quotation, QuotationStatus } from '../types';
import { formatRupiah } from '../utils/quotationEngine';
import { ProductAssetThumb } from './ProductAssetThumb';

interface SalesDashboardProps {
  quotations: Quotation[];
  onStartNewQuotation: () => void;
  onViewQuotation: (quotation: Quotation) => void;
  onViewCatalog: () => void;
  onViewCustomRequest: () => void;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  quotations,
  onStartNewQuotation,
  onViewQuotation,
  onViewCatalog,
  onViewCustomRequest,
}) => {
  const activeCount = quotations.filter(
    q => q.status === 'PENDING_REVIEW' || q.status === 'DRAFT'
  ).length;
  const approvedCount = quotations.filter(
    q => q.status === 'APPROVED' || q.status === 'PDF_SENT'
  ).length;
  const needActionCount = quotations.filter(
    q => q.status === 'REJECTED' || q.status === 'PENDING_REVIEW'
  ).length;

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Menunggu Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            Disetujui
          </span>
        );
      case 'PDF_SENT':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            PDF Terkirim
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            Perlu Revisi
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Hero Banner matching the screenshot */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white via-slate-50 to-slate-100 border border-slate-200 shadow-xs p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 space-y-4">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Automated Quotation System
            </h2>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed max-w-xl">
              Buat, ajukan, dan pantau penawaran produk dengan lebih cepat dan mudah.
              Terintegrasi dengan basis data katalog, persetujuan Sales Support, dan penerbitan PDF instan.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onStartNewQuotation}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-md shadow-red-600/20 transition-all cursor-pointer transform active:scale-95"
              >
                <span>Buat Penawaran Baru</span>
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>

              <button
                onClick={onViewCustomRequest}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-200 shadow-xs transition-colors cursor-pointer"
              >
                <span>Request Custom Produk</span>
              </button>
            </div>
          </div>

          {/* Hero Visual on the right */}
          <div className="md:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full max-w-md h-48 bg-gradient-to-tr from-slate-200/50 to-white rounded-xl border border-slate-200/60 p-4 flex items-center justify-between shadow-inner">
              <div className="space-y-2 text-left">
                <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                  Agusta Workflow
                </span>
                <p className="text-xs font-semibold text-slate-800">
                  Resmi · Cepat · Terintegrasi
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto Margin
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp API
                  </span>
                </div>
              </div>

              {/* Office Chair and Monitor Graphic Element */}
              <div className="w-32 h-36 relative flex items-center justify-center">
                <ProductAssetThumb
                  category="Kursi Kantor"
                  name="KURSI INDACHI FILMORE I AL"
                  className="w-28 h-32 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {activeCount + 10}
            </div>
            <div className="text-xs font-medium text-slate-500">Pengajuan Aktif</div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {approvedCount + 26}
            </div>
            <div className="text-xs font-medium text-slate-500">Penawaran Disetujui</div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {needActionCount + 3}
            </div>
            <div className="text-xs font-medium text-slate-500">Perlu Tindak Lanjut</div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              1.240
            </div>
            <div className="text-xs font-medium text-slate-500">Total Produk (Katalog)</div>
          </div>
        </div>
      </div>

      {/* Main Content Split: Penawaran Terbaru Table & Panduan Singkat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table: Penawaran Terbaru (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Penawaran Terbaru</h3>
              <p className="text-xs text-slate-500">Daftar pengajuan surat penawaran Anda</p>
            </div>
            <button
              onClick={onStartNewQuotation}
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
            >
              <span>+ Buat Baru</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Pengajuan</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map(q => (
                  <tr
                    key={q.id}
                    onClick={() => onViewQuotation(q)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 text-xs">
                      {q.quotationNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                      {q.date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 text-xs">{q.customer.companyName}</div>
                      <div className="text-[11px] text-slate-500">{q.customer.contactPerson}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewQuotation(q);
                        }}
                        className="text-xs font-medium text-slate-600 group-hover:text-red-600 flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <span>Buka</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panduan Singkat & Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h3 className="font-bold text-slate-900 text-base mb-4">Panduan Singkat</h3>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">Cari & pilih produk</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Gunakan Smart Search untuk mencari kursi kantor, AIO, atau meja rapat dari database katalog.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">Atur jumlah & kebutuhan</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tentukan quantity dan manfaatkan fitur rekomendasi diskon otomatis bertingkat.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">Ajukan ke Sales Support</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tim Sales Support akan mereview margin, memvalidasi COGS/HPP, dan memberi approval.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">Terima PDF penawaran</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dokumen PDF resmi beserta notifikasi WhatsApp instan otomatis terbit setelah di-approve.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Catalog & Custom Request Quick Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
            <h4 className="font-semibold text-sm">Produk Tidak Ditemukan?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Jika client membutuhkan spesifikasi custom atau produk non-katalog, isi formulir request barang custom untuk diverifikasi tim Support.
            </p>
            <button
              onClick={onViewCustomRequest}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Isi Form Request Custom</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
