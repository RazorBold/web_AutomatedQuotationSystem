import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCheck,
  Send,
  ExternalLink,
  X,
  Copy,
  Check,
  Code2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Quotation } from '../types';
import { formatWhatsAppQuotationMessage } from '../utils/quotationEngine';

interface WhatsAppModalProps {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSend: (quotationId: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  quotation,
  isOpen,
  onClose,
  onConfirmSend,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<'IDLE' | 'SENT' | 'DELIVERED'>('IDLE');
  const [showJsonPayload, setShowJsonPayload] = useState(false);

  if (!isOpen || !quotation) return null;

  const messageText = formatWhatsAppQuotationMessage({
    salesName: quotation.salesName,
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customer.companyName,
    totalAmount: quotation.grandTotal,
    approvedBy: 'Rizki Saputra (Sales Support)',
    approvalDate: quotation.reviewedAt || new Date().toLocaleString('id-ID'),
    downloadUrl: `https://agusta.internal/quotation/${quotation.quotationNumber}.pdf`,
  });

  const cleanPhone = quotation.salesPhone.replace(/[^0-9]/g, '');
  const waWebUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateApiDispatch = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setDeliveryStatus('DELIVERED');
      onConfirmSend(quotation.id);
    }, 1200);
  };

  const jsonPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: 'agusta_quotation_approval_notification',
      language: { code: 'id' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: quotation.salesName },
            { type: 'text', text: quotation.quotationNumber },
            { type: 'text', text: quotation.customer.companyName },
            { type: 'currency', currency: { fallback_value: `${quotation.grandTotal}` } },
            { type: 'text', text: 'Rizki Saputra' },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: `${quotation.quotationNumber}.pdf` },
          ],
        },
      ],
    },
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-[#128C7E] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">WhatsApp Business API</h3>
              <p className="text-xs text-white/80">
                Notifikasi Otomatis Penerbitan PDF Penawaran
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Recipient Meta */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Penerima Notifikasi (Sales)
              </span>
              <strong className="text-slate-900 text-sm">{quotation.salesName}</strong>
              <div className="text-slate-500 font-mono">{quotation.salesPhone}</div>
            </div>

            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Status Pengiriman
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <CheckCheck className="w-3.5 h-3.5" />
                {deliveryStatus === 'DELIVERED' || quotation.whatsAppStatus === 'DELIVERED'
                  ? 'Terkirim & Terverifikasi'
                  : 'Siap Kirim'}
              </span>
            </div>
          </div>

          {/* Simulated WhatsApp Chat Bubble */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Preview Tampilan Pesan WhatsApp</span>
              <button
                onClick={handleCopy}
                className="text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
              </button>
            </div>

            <div className="bg-[#EFEAE2] p-4 rounded-xl border border-slate-300 relative shadow-inner">
              <div className="bg-white rounded-lg p-3.5 shadow-xs max-w-[90%] text-xs text-slate-800 space-y-2 whitespace-pre-wrap leading-relaxed font-sans border-t-2 border-[#128C7E]">
                {messageText}
                <div className="text-[10px] text-slate-400 text-right flex items-center justify-end gap-1 pt-1">
                  <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Toggle JSON API Payload */}
          <div>
            <button
              onClick={() => setShowJsonPayload(!showJsonPayload)}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{showJsonPayload ? 'Sembunyikan Webhook JSON' : 'Lihat Raw API Payload (Meta Cloud API)'}</span>
            </button>

            {showJsonPayload && (
              <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto max-h-40 leading-tight">
                {JSON.stringify(jsonPayload, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <a
            href={waWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#128C7E]" />
            <span>Kirim via WhatsApp Web</span>
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Tutup
            </button>

            <button
              onClick={handleSimulateApiDispatch}
              disabled={isSending}
              className="px-5 py-2.5 rounded-lg bg-[#128C7E] hover:bg-[#075E54] text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Mengirim via API...' : 'Simulasi Kirim Bot API'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
