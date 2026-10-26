import React, { useState } from 'react';
import { User, FoundationInfo, BroadcastMessage, AdminChatConfig } from '../../types';
import { StorageService } from '../../utils/storage';
import { ChatAdminModal } from './ChatAdminModal';
import {
  ShieldAlert,
  MessageSquare,
  LogOut,
  Building2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface SuspendedUserViewProps {
  currentUser: User;
  onLogout: () => void;
}

export const SuspendedUserView: React.FC<SuspendedUserViewProps> = ({
  currentUser,
  onLogout,
}) => {
  const [foundation] = useState<FoundationInfo>(StorageService.getFoundation());
  const [broadcastMsg] = useState<BroadcastMessage>(StorageService.getBroadcastMessage());
  const [chatConfig] = useState<AdminChatConfig>(StorageService.getAdminChatConfig());
  const [showChatModal, setShowChatModal] = useState(false);

  const activeMessage =
    currentUser.pesanKhusus?.trim() ||
    broadcastMsg.pesanPusat ||
    'Mohon maaf, akun Anda sedang dinonaktifkan sementara oleh Admin Pusat Yayasan.';

  const formatWaNumber = (phoneStr: string) => {
    let cleaned = (phoneStr || '').replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  };

  const handleOpenDirectWa = () => {
    const phone = formatWaNumber(chatConfig.whatsappNumber);
    const text = encodeURIComponent(
      chatConfig.waTemplateMessage || 'Halo Admin Yayasan, saya memerlukan konfirmasi status akun saya.'
    );
    const waUrl = `https://wa.me/${phone}?text=${text}`;
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans antialiased">
      {/* Top Header */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {foundation.logoYayasanUrl ? (
            <img
              src={foundation.logoYayasanUrl}
              alt="Logo Yayasan"
              className="w-10 h-10 object-contain rounded-xl bg-white/10 p-1 border border-white/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black text-white leading-tight">
              {foundation.name}
            </h1>
            <p className="text-[11px] text-emerald-400 font-semibold">
              Portal Layanan Resmi Pengurus Pusat
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>

      {/* Main Notice Box */}
      <div className="w-full max-w-xl mx-auto my-auto py-8">
        <div className="bg-slate-800/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/80 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-lg">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {currentUser.name}
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  @{currentUser.username} &bull; {currentUser.role}
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-950/90 text-rose-300 border border-rose-800 text-xs font-black uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              <span>Nonaktif</span>
            </span>
          </div>

          <div className="flex items-start gap-3.5 mb-4">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 shrink-0 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {broadcastMsg.judulPesan || 'Pemberitahuan Resmi Dari Admin Pusat Yayasan'}
              </h2>
              <p className="text-xs text-amber-200/80 mt-0.5 font-medium">
                Akses menu aplikasi dibatasi sementara untuk akun ini.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-5 mb-6 shadow-inner">
            <div className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pesan Khusus Dari Admin Pusat:</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
              {activeMessage}
            </p>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleOpenDirectWa}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-700/20 transition flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Chat WhatsApp Admin</span>
              </button>
              <button
                type="button"
                onClick={() => setShowChatModal(true)}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-2xl border border-slate-600 transition flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Buka Menu Chat Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full max-w-xl mx-auto py-3 text-center border-t border-slate-800 text-slate-500 text-xs">
        <p>&copy; 2026 AsistenGuru &bull; Yayasan Walisongo Rumbai Jaya</p>
      </footer>

      <ChatAdminModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
      />
    </div>
  );
};
