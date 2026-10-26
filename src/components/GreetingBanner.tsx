import React from 'react';
import { User, School } from '../types';
import { Sun, Sunset, Moon, Coffee } from 'lucide-react';

interface GreetingBannerProps {
  currentUser: User;
  currentSchool?: School | null;
}

export const GreetingBanner: React.FC<GreetingBannerProps> = ({
  currentUser,
  currentSchool,
}) => {
  const getGreetingData = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) {
      return {
        greeting: 'Selamat Pagi',
        icon: Sun,
        iconColor: 'text-amber-500',
        bgGradient: 'from-amber-500/10 via-emerald-500/10 to-teal-500/5',
        message: 'Awali pagi dengan senyuman dan niat tulus mendidik generasi berakhlak mulia.',
      };
    } else if (hour >= 11 && hour < 15) {
      return {
        greeting: 'Selamat Siang',
        icon: Coffee,
        iconColor: 'text-amber-600',
        bgGradient: 'from-blue-500/10 via-teal-500/10 to-emerald-500/5',
        message: 'Tetap semangat dalam membimbing peserta didik dan mengelola administrasi sekolah.',
      };
    } else if (hour >= 15 && hour < 18) {
      return {
        greeting: 'Selamat Sore',
        icon: Sunset,
        iconColor: 'text-orange-500',
        bgGradient: 'from-orange-500/10 via-amber-500/10 to-teal-500/5',
        message: 'Semoga seluruh ikhtiar dan pengabdian hari ini menjadi ladang amal jariyah yang berlimpah.',
      };
    } else {
      return {
        greeting: 'Selamat Malam',
        icon: Moon,
        iconColor: 'text-indigo-400',
        bgGradient: 'from-indigo-500/10 via-slate-800/20 to-teal-500/5',
        message: 'Selamat beristirahat dan mengevaluasi capaian hari ini dengan penuh rasa syukur.',
      };
    }
  };

  const { greeting, icon: TimeIcon, iconColor, bgGradient, message } = getGreetingData();

  const formattedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getRoleTitle = () => {
    switch (currentUser.role) {
      case 'ADMIN_YAYASAN':
        return 'Admin Pusat';
      case 'ADMIN_SEKOLAH':
        return currentSchool ? `Admin ${currentSchool.name}` : 'Admin Sekolah';
      case 'KEPALA_SEKOLAH':
        return currentSchool ? `Kepala Sekolah ${currentSchool.name}` : 'Kepala Sekolah';
      case 'GURU':
        return 'Bapak / Ibu Guru Pengampu';
      default:
        return 'Pendidik';
    }
  };

  return (
    <div className={`rounded-3xl border border-slate-200/80 bg-gradient-to-r ${bgGradient} p-4 sm:p-5 mb-4 shadow-xs backdrop-blur-xs no-print`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center shrink-0">
            <TimeIcon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                {greeting}, <span className="text-emerald-800">{currentUser.name.split('(')[0]}</span>!
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium leading-relaxed">
              Yayasan Walisongo Rumbai Jaya &bull; {message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-right shrink-0">
          <div className="hidden sm:block">
            <span className="text-[11px] font-bold text-slate-700 block">
              {formattedDate}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
              {getRoleTitle()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
