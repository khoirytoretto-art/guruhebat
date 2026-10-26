import React, { useState, useEffect } from 'react';
import { StorageService } from '../../utils/storage';
import { AdminChatConfig } from '../../types';
import { MessageSquare, Phone, X, HeartHandshake, Smile, ExternalLink } from 'lucide-react';

interface ChatAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatAdminModal: React.FC<ChatAdminModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AdminChatConfig>(StorageService.getAdminChatConfig());
  const [customMsg, setCustomMsg] = useState(config.waTemplateMessage || 'Halo Admin Yayasan, saya memerlukan bantuan teknis aplikasi AsistenGuru.');

  useEffect(() => {
    if (isOpen) {
      const current = StorageService.getAdminChatConfig();
      setConfig(current);
      setCustomMsg(current.waTemplateMessage || 'Halo Admin Yayasan, saya memerlukan bantuan teknis aplikasi AsistenGuru.');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatWaNumber = (phoneStr: string) => {
    let cleaned = (phoneStr || '').replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white p-5 sm:p-6 pb-7">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
              <MessageSquare className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Layanan Pusat Yayasan</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-1 leading-tight">
                Ruang Curhat & Chat Admin
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 relative">
            <div className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800 flex items-center gap-1.5 mb-1.5">
              <Smile className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pesan Dari Admin Yayasan</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-medium">
              &ldquo;{config.chatPromptText}&rdquo;
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block leading-tight">
                  Nomor WhatsApp Admin
                </span>
                <span className="text-xs font-black text-slate-800 font-mono">
                  {config.whatsappNumber || '0811-7000-111'}
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Aktif
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pesan yang Akan Dikirim:
            </label>
            <input
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="Tulis pesanmu..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-2">
            <a
              href={`https://wa.me/${formatWaNumber(config.whatsappNumber)}?text=${encodeURIComponent(
                customMsg || config.waTemplateMessage || 'Halo Admin Yayasan, saya memerlukan bantuan teknis aplikasi AsistenGuru.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-700/20 transition flex items-center justify-center gap-2 cursor-pointer text-sm text-center"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka WhatsApp Sekarang</span>
            </a>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 font-medium">
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pelayanan silaturahmi & bantuan teknis Yayasan</span>
          </p>
        </div>
      </div>
    </div>
  );
};
