import React from 'react';
import { User } from '../../types';
import {
  Home,
  Clock,
  BookOpen,
  Printer,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';

interface MobileBottomBarProps {
  currentUser: User;
  activeTab: string;
  onTabSelect: (tab: string) => void;
  onOpenAccountSettings: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  currentUser,
  activeTab,
  onTabSelect,
  onOpenAccountSettings,
}) => {
  const getTabs = () => {
    if (currentUser.role === 'GURU') {
      return [
        { id: 'BERANDA', label: 'Beranda', icon: Home },
        { id: 'INPUT_TUGAS', label: 'Isi Absen/Jurnal', icon: Clock },
        { id: 'RIWAYAT_CETAK', label: 'Cetak Rekap', icon: Printer },
      ];
    }
    if (currentUser.role === 'ADMIN_SEKOLAH') {
      return [
        { id: 'BERANDA', label: 'Beranda', icon: Home },
        { id: 'CETAK_REKAP', label: 'Cetak F4', icon: Printer },
        { id: 'PERAN_GURU', label: 'Peran Guru', icon: Sparkles },
        { id: 'MAPEL_KELAS', label: 'Mapel/Kelas', icon: BookOpen },
      ];
    }
    if (currentUser.role === 'KEPALA_SEKOLAH') {
      return [
        { id: 'BERANDA', label: 'Beranda', icon: Home },
        { id: 'ABSEN_KEPSEK', label: 'Absen Kepsek', icon: Clock },
        { id: 'INPUT_TUGAS', label: 'Mengajar', icon: BookOpen },
        { id: 'CETAK_REKAP', label: 'Cetak', icon: Printer },
        { id: 'MONITORING', label: 'Pantau', icon: UserIcon },
      ];
    }
    // ADMIN YAYASAN
    return [
      { id: 'BERANDA', label: 'Beranda', icon: Home },
      { id: 'SEKOLAH', label: 'Lembaga', icon: Home },
      { id: 'GURU', label: 'Guru', icon: UserIcon },
      { id: 'RINGKASAN', label: 'Yayasan', icon: Sparkles },
    ];
  };

  const tabs = getTabs();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1.5 flex items-center justify-around no-print">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabSelect(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 ${
              isActive
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                isActive ? 'bg-emerald-100/90 text-emerald-800' : ''
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 leading-none">{tab.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenAccountSettings}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer active:scale-95"
      >
        <div className="p-1 rounded-xl">
          <UserIcon className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5 leading-none">Akun</span>
      </button>
    </div>
  );
};
