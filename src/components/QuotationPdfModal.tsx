import React, { useRef } from 'react';
import {
  Download,
  Printer,
  X,
  Send,
  CheckCircle2,
  Share2,
  FileText,
  Building,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Quotation } from '../types';
import { formatRupiah } from '../utils/quotationEngine';
import { AgustaLogo } from './AgustaLogo';

interface QuotationPdfModalProps {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenWhatsAppModal: (quotation: Quotation) => void;
}

export const QuotationPdfModal: React.FC<QuotationPdfModalProps> = ({
  quotation,
  isOpen,
  onClose,
  onOpenWhatsAppModal,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !quotation) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Header Brand
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38); // Agusta Red
      doc.setFontSize(20);
      doc.text('AGUSTA', 20, 22);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text('BUSINESS & OFFICE EQUIPMENT', 20, 27);
      doc.text('Jl. Industri Raya No. 88, Kawasan Niaga Terpadu, Jakarta', 20, 31);
      doc.text('Telp: (021) 5890-1234 | Email: sales@agusta.co.id', 20, 35);

      // Meta (Right side)
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(`No.        : ${quotation.quotationNumber}`, 130, 22);
      doc.text(`Tanggal : ${quotation.date}`, 130, 27);
      doc.text(`Hal         : Penawaran Produk`, 130, 32);

      // Horizontal separator line
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.8);
      doc.line(20, 40, 190, 40);

      // Addressee
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Kepada Yth.', 20, 48);
      doc.setFontSize(11);
      doc.text(quotation.customer.companyName, 20, 54);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Up: ${quotation.customer.contactPerson}`, 20, 59);
      doc.text(quotation.customer.address || 'Di Tempat', 20, 64);

      // Opening letter text
      doc.setFontSize(10);
      doc.text(
        'Dengan hormat,',
        20,
        74
      );
      doc.text(
        'Bersama ini kami sampaikan penawaran harga untuk produk yang Bapak/Ibu butuhkan:',
        20,
        79
      );

      // Table Header (Red background)
      doc.setFillColor(220, 38, 38);
      doc.rect(20, 85, 170, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('No', 22, 90);
      doc.text('Deskripsi Produk', 32, 90);
      doc.text('Qty', 115, 90);
      doc.text('Harga Satuan', 130, 90);
      doc.text('Diskon', 155, 90);
      doc.text('Subtotal', 172, 90);

      // Table Rows
      let y = 98;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(8);

      quotation.items.forEach((item, index) => {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }

        doc.text(`${index + 1}`, 23, y);
        const splitTitle = doc.splitTextToSize(item.productName, 80);
        doc.text(splitTitle, 32, y);

        doc.text(`${item.qty} ${item.unit}`, 115, y);
        doc.text(formatRupiah(item.sellingPrice), 126, y);
        doc.text(`${item.discountPercent}%`, 157, y);
        doc.text(formatRupiah(item.subtotal), 170, y);

        y += Math.max(8, splitTitle.length * 4 + 2);
        doc.setDrawColor(230, 230, 230);
        doc.line(20, y - 2, 190, y - 2);
      });

      // Totals Box
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal', 130, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatRupiah(quotation.subtotal), 168, y);

      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(`PPN ${quotation.taxRatePercent || 11}%`, 130, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatRupiah(quotation.taxAmount), 168, y);

      // Total Penawaran Highlight Bar
      y += 4;
      doc.setFillColor(220, 38, 38);
      doc.rect(125, y, 65, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Penawaran', 128, y + 5.5);
      doc.text(formatRupiah(quotation.grandTotal), 162, y + 5.5);

      // Closing notes
      y += 18;
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Demikian penawaran ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.', 20, y);

      // Signatures
      y += 12;
      doc.text('Hormat kami,', 30, y);
      doc.text('Mengetahui,', 140, y);

      y += 20;
      doc.setFont('helvetica', 'bold');
      doc.text(quotation.salesName, 30, y);
      doc.text('Ir. Hendra Gunawan', 140, y);

      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Sales Executive', 30, y);
      doc.text('Direktur Komersial', 140, y);

      doc.save(`Surat_Penawaran_${quotation.quotationNumber}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Dialog Action Bar (no-print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-bold text-slate-800 text-sm">
              Dokumen Resmi: {quotation.quotationNumber}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              (Disetujui & Siap Diterbitkan)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>

            <button
              onClick={() => onOpenWhatsAppModal(quotation)}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim ke WhatsApp Sales</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Tutup pratinjau dokumen"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document View matching screenshot 5 */}
        <div className="p-8 sm:p-12 overflow-y-auto bg-slate-100 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-[800px] bg-white rounded-lg shadow-md p-8 sm:p-12 text-slate-900 border border-slate-200 space-y-6 text-sm"
          >
            {/* Header matching the reference screenshot */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-red-600 pb-5 gap-4">
              <AgustaLogo size="md" />

              <div className="text-right text-xs space-y-1 font-sans">
                <div className="font-mono">
                  <span className="text-slate-500">No. :</span>{' '}
                  <strong className="text-slate-900">{quotation.quotationNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Tanggal :</span>{' '}
                  <strong className="text-slate-900">{quotation.date}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Hal :</span>{' '}
                  <strong className="text-slate-900">Penawaran Produk</strong>
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Surat Penawaran (Quotation)
              </h2>
            </div>

            {/* Recipient */}
            <div className="text-xs space-y-1">
              <div>Kepada Yth.</div>
              <div className="font-bold text-sm text-slate-900">{quotation.customer.companyName}</div>
              <div className="text-slate-600">Up: {quotation.customer.contactPerson}</div>
              <div className="text-slate-600">{quotation.customer.address || 'Di Tempat'}</div>
            </div>

            {/* Intro paragraph */}
            <p className="text-xs text-slate-700 leading-relaxed">
              Dengan hormat,<br />
              Bersama ini kami sampaikan penawaran harga untuk produk yang Bapak/Ibu butuhkan, dengan rincian sebagai berikut:
            </p>

            {/* Official Table with Red Header matching screenshot 5 */}
            <div className="overflow-x-auto border border-red-600 rounded-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#DC2626] text-white font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-3">Deskripsi Produk</th>
                    <th className="py-2.5 px-2 text-center w-14">Qty</th>
                    <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                    <th className="py-2.5 px-2 text-center w-16">Diskon</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.items.map((item, idx) => (
                    <tr key={item.id} className="text-slate-800">
                      <td className="py-3 px-3 text-center font-medium text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-500">{item.sku}</div>
                      </td>
                      <td className="py-3 px-2 text-center font-medium tabular-nums">
                        {item.qty} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {formatRupiah(item.sellingPrice)}
                      </td>
                      <td className="py-3 px-2 text-center tabular-nums font-semibold">
                        {item.discountPercent}%
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotals & PPN */}
            <div className="flex justify-end pt-2">
              <div className="w-full max-w-xs space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatRupiah(quotation.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>PPN 11%</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatRupiah(quotation.taxAmount)}
                  </span>
                </div>

                {/* Red Highlight Total Bar matching screenshot 5 */}
                <div className="flex justify-between items-center bg-[#DC2626] text-white px-3 py-2 rounded-xs font-black text-sm">
                  <span>Total Penawaran</span>
                  <span className="tabular-nums">{formatRupiah(quotation.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Closing text */}
            <p className="text-xs text-slate-700 leading-relaxed pt-2">
              Demikian penawaran ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.
            </p>

            {/* E-Signatures matching screenshot 5 */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
              <div className="space-y-12">
                <div>Hormat kami,</div>
                <div className="pt-8">
                  <div className="font-bold text-slate-900 underline text-sm">
                    {quotation.salesName}
                  </div>
                  <div className="text-slate-500">Sales Executive</div>
                </div>
              </div>

              <div className="space-y-4 text-right sm:text-left">
                <div>Mengetahui,</div>
                {/* Vector signature graphic */}
                <div className="h-14 flex items-center justify-start">
                  <svg viewBox="0 0 160 50" className="h-12 text-slate-800 stroke-current fill-none">
                    <path
                      d="M10 35 C 30 10, 45 40, 60 15 C 75 -5, 80 45, 95 20 C 110 5, 120 30, 145 25"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M30 40 L130 38"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-slate-900 underline text-sm">
                    Direktur
                  </div>
                  <div className="text-slate-500">PT Agusta Sukses Makmur</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
