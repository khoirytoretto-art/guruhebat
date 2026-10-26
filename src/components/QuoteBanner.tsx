import React, { useState, useEffect } from 'react';
import { StorageService } from '../utils/storage';
import { Smile, Sparkles } from 'lucide-react';

interface QuoteBannerProps {
  onEditRequested?: () => void;
  canEdit?: boolean;
}

export const QuoteBanner: React.FC<QuoteBannerProps> = ({ onEditRequested, canEdit }) => {
  const [foundation, setFoundation] = useState(StorageService.getFoundation());

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setFoundation(StorageService.getFoundation());
    });
    return () => unsub();
  }, []);

  const quote =
    foundation.kutipanLucu ||
    'Mendidik itu seni menahan tawa saat murid salah jawab dengan ekspresi paling serius, dan seni tersenyum saat akhir bulan saldo tetap syahdu!';
  const author = foundation.kutipanAuthor || 'Admin Yayasan';

  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-teal-500/15 border border-amber-300/40 rounded-2xl p-4 sm:p-4.5 mb-6 text-slate-800 shadow-xs relative overflow-hidden backdrop-blur-xs no-print">
      <div className="flex items-start gap-3 relative z-10">
        <div className="w-10 h-10 rounded-2xl bg-amber-400/25 text-amber-800 border border-amber-300/60 flex items-center justify-center shrink-0 shadow-xs">
          <Smile className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/70 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-300/60">
              Kutipan & Motivasi Humoris
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">&bull; Pesan Yayasan untuk Seluruh Guru</span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-1.5 italic leading-relaxed">
            "{quote}"
          </p>
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-amber-200/50 text-[11px] text-slate-600">
            <span className="font-medium">&mdash; {author}</span>
            {canEdit && onEditRequested && (
              <button
                type="button"
                onClick={onEditRequested}
                className="text-[11px] text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                Ubah Kutipan Yayasan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
