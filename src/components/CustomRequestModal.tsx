import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CustomProductRequest, UserProfile } from '../types';

interface CustomRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSubmitRequest: (req: Omit<CustomProductRequest, 'id' | 'submittedAt' | 'status'>) => void;
}

export const CustomRequestModal: React.FC<CustomRequestModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubmitRequest,
}) => {
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Meja Kerja Partisi');
  const [estimatedQty, setEstimatedQty] = useState(10);
  const [targetPrice, setTargetPrice] = useState(5000000);
  const [specs, setSpecs] = useState('');
  const [referenceNotes, setReferenceNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !specs.trim()) {
      alert('Mohon isi nama barang custom dan spesifikasi teknis.');
      return;
    }

    onSubmitRequest({
      salesId: currentUser.id,
      salesName: currentUser.name,
      productName,
      category,
      estimatedQty,
      targetPricePerUnit: targetPrice,
      specs,
      referenceUrlOrNotes: referenceNotes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Request Barang Custom</h3>
              <p className="text-xs text-slate-500">Ajukan spesifikasi barang non-katalog ke Tim Sales Support</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Barang / Deskripsi Singkat *</label>
            <input
              type="text"
              required
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="Contoh: Meja Rapat Kayu Jati Custom 400x120cm + Cable Box"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kategori Produk</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-red-500"
              >
                <option value="Kursi Kantor">Kursi Kantor</option>
                <option value="Meja Kerja Partisi">Meja Kerja Partisi</option>
                <option value="Meja Rapat">Meja Rapat</option>
                <option value="Lemari Arsip">Lemari Arsip</option>
                <option value="Perangkat IT / AIO">Perangkat IT / AIO</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimasi Kuantitas (Unit) *</label>
              <input
                type="number"
                min={1}
                required
                value={estimatedQty}
                onChange={e => setEstimatedQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Harga Jual / Unit (Rp)</label>
            <input
              type="number"
              step={100000}
              value={targetPrice}
              onChange={e => setTargetPrice(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Spesifikasi Teknis & Dimensi *</label>
            <textarea
              rows={3}
              required
              value={specs}
              onChange={e => setSpecs(e.target.value)}
              placeholder="Jelaskan material, ukuran (PxLxT), warna finishing, aksesoris kabel, dll."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Catatan / Link Referensi Klien</label>
            <input
              type="text"
              value={referenceNotes}
              onChange={e => setReferenceNotes(e.target.value)}
              placeholder="Contoh: Rujukan drawing arsitek PT Graha Nusantara"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex items-start gap-2 text-[11px]">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>
              Pengajuan barang custom akan langsung diteruskan ke tim Sales Support & Procurement untuk dihitung HPP/COGS dan diterbitkan harga resminya.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Request ke Support</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
