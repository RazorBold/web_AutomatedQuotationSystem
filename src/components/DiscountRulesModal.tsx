import React, { useState } from 'react';
import { PercentCircle, X, Plus, ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import { DiscountRule, DEFAULT_DISCOUNT_RULES } from '../utils/quotationEngine';

interface DiscountRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscountRulesModal: React.FC<DiscountRulesModalProps> = ({ isOpen, onClose }) => {
  const [rules, setRules] = useState<DiscountRule[]>(DEFAULT_DISCOUNT_RULES);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = (index: number, field: keyof DiscountRule, value: any) => {
    const updated = [...rules];
    (updated[index] as any)[field] = value;
    setRules(updated);
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <PercentCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Aturan Diskon Otomatis (Business Logic)</h3>
              <p className="text-xs text-slate-500">Konfigurasi batas diskon otomatis bertingkat & batas aman margin HPP</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Aturan ini memandu sistem dalam memberikan rekomendasi diskon otomatis saat tim Sales memilih kuantitas barang, sekaligus menjaga agar margin kotor tidak jatuh di bawah floor minimum modal (COGS).
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Kategori Klien</th>
                  <th className="py-2.5 px-3 text-center">Min Qty</th>
                  <th className="py-2.5 px-3 text-center">Max Qty</th>
                  <th className="py-2.5 px-3 text-center bg-red-50 text-red-900">Saran Diskon (%)</th>
                  <th className="py-2.5 px-3 text-center">Batas Maks (%)</th>
                  <th className="py-2.5 px-3 text-center">Min Margin Safety (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {rule.customerCategory}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {rule.minQty}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500">
                      {rule.maxQty || '∞'}
                    </td>
                    <td className="py-3 px-3 text-center bg-red-50/50">
                      <input
                        type="number"
                        value={rule.suggestedDiscount}
                        onChange={e => handleUpdate(idx, 'suggestedDiscount', Number(e.target.value))}
                        className="w-14 text-center font-bold text-red-600 bg-white border border-red-200 rounded py-0.5"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        value={rule.maxAllowedDiscount}
                        onChange={e => handleUpdate(idx, 'maxAllowedDiscount', Number(e.target.value))}
                        className="w-14 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded py-0.5"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-emerald-600 font-mono">
                        {rule.minMarginPercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Perubahan langsung berpengaruh pada kalkulasi wizard pembuatan penawaran.
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{savedSuccess ? 'Tersimpan!' : 'Simpan Aturan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
