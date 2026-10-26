import React, { useState, useEffect } from 'react';
import { User, School } from '../types';
import { StorageService } from '../utils/storage';
import {
  GraduationCap,
  School as SchoolIcon,
  Users,
  Printer,
  UserCheck,
  ArrowUpDown,
  BookOpen,
  Clock,
  FileCheck2,
  Smile,
  LogOut,
  Menu,
  X,
  FileSignature,
  Building2,
  Sparkles,
  KeyRound,
  Bell,
  Home,
  Award,
  Activity,
  MessageSquare,
  Database,
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  currentSchool?: School | null;
  activeTab: string;
  onTabSelect: (tab: string) => void;
  onLogout: () => void;
  onOpenAccountSettings?: () => void;
  onOpenChatAdmin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentSchool,
  activeTab,
  onTabSelect,
  onLogout,
  onOpenAccountSettings,
  onOpenChatAdmin,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [foundation, setFoundation] = useState(StorageService.getFoundation());
  const [pendingResetCount, setPendingResetCount] = useState(
    StorageService.getResetRequests().filter((r) => r.status === 'PENDING').length
  );

  useEffect(() => {
    const update = () => {
      setFoundation(StorageService.getFoundation());
      setPendingResetCount(
        StorageService.getResetRequests().filter((r) => r.status === 'PENDING').length
      );
    };
    const unsub = StorageService.subscribe(update);
    return () => unsub();
  }, []);

  const getMenuItems = () => {
    if (currentUser.role === 'ADMIN_YAYASAN') {
      return [
        { id: 'BERANDA', label: 'Beranda', icon: Home },
        { id: 'SEKOLAH', label: 'Sekolah Naungan', icon: SchoolIcon },
        { id: 'ADMIN_SEKOLAH', label: 'Akun Admin Sekolah', icon: Users },
        { id: 'GURU', label: 'Data Guru & Akun', icon: GraduationCap },
        { id: 'STATUS_ONLINE', label: 'Pantau Pengguna Online', icon: Activity },
        { id: 'PESAN_PUSAT', label: 'Pesan Admin & Chat WA', icon: MessageSquare },
        { id: 'BACKUP_DATA', label: 'Cadangkan & Pulihkan Data', icon: Database },
        {
          id: 'PERMINTAAN_RESET',
          label: 'Permintaan Reset Sandi',
          icon: KeyRound,
          badge: pendingResetCount > 0 ? pendingResetCount : undefined,
        },
        { id: 'KUTIPAN_BRANDING', label: 'Logo & Kutipan Yayasan', icon: Smile },
        { id: 'RINGKASAN', label: 'Profil Yayasan', icon: Building2 },
      ];
    }
    if (currentUser.role === 'ADMIN_SEKOLAH') {
      return [
        { id: 'BERANDA', label: 'Beranda', icon: Home },
        { id: 'CETAK_REKAP', label: 'Cetak Rekap Landscape F4', icon: Printer },
        { id: 'PERAN_GURU', label: 'Peran Guru (SD, P5, Ekskul)', icon: UserCheck },
        { id: 'URUTAN_JABATAN', label: 'Urutan Jabatan Cetak', icon: ArrowUpDown },
        { id: 'TANDA_TANGAN', label: 'Pengaturan Tanda Tangan', icon: FileSignature },
        { id: 'MAPEL_KELAS', label: 'Mapel & Kelas', icon: BookOpen },
        { id: 'PROFIL', label: 'Profil Sekolah & Logo', icon: SchoolIcon },
      ];
    }
    if (currentUser.role === 'KEPALA_SEKOLAH') {
      return [
        { id: 'BERANDA', label: 'Beranda', icon: Home },
        { id: 'ABSEN_KEPSEK', label: 'Presensi Jam Kepala Sekolah', icon: Clock },
        { id: 'INPUT_TUGAS', label: 'Presensi & Jurnal Mengajar', icon: BookOpen },
        { id: 'CETAK_REKAP', label: 'Cetak Rekap & Verifikasi', icon: Printer },
        { id: 'MONITORING', label: 'Pantau Jurnal & Guru', icon: Activity },
      ];
    }
    // GURU: Menu disesuaikan hanya dengan tugas masing-masing sesuai inputan admin
    const teacherAssignments = StorageService.getAssignments().filter(
      (a) => a.teacherId === currentUser.id
    );
    const assignedRoles = new Set<string>();
    teacherAssignments.forEach((asg) => {
      (asg.roles || []).forEach((r) => assignedRoles.add(r));
    });
    // Jika belum ada penugasan khusus, defaultkan ke Guru Bidang Studi
    if (assignedRoles.size === 0) {
      assignedRoles.add('GURU_BIDANG_STUDI');
    }

    return [
      { id: 'BERANDA', label: 'Beranda', icon: Home },
      { id: 'INPUT_TUGAS', label: 'Presensi & Tugas Guru', icon: Clock },
      { id: 'RIWAYAT_CETAK', label: 'Cetak Dokumen Rekap', icon: Printer },
    ];
  };

  const menuItems = getMenuItems();

  const handleItemClick = (id: string) => {
    onTabSelect(id);
    setIsMobileOpen(false);
  };

  const getRoleBadge = () => {
    switch (currentUser.role) {
      case 'ADMIN_YAYASAN':
        return 'Admin Yayasan';
      case 'ADMIN_SEKOLAH':
        return 'Admin Sekolah';
      case 'KEPALA_SEKOLAH':
        return 'Kepala Sekolah';
      case 'GURU':
        return 'Guru Pengampu';
      default:
        return 'Pengguna';
    }
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white overflow-hidden p-0.5 shadow-xs">
            {foundation.logoAppUrl ? (
              <img
                src={foundation.logoAppUrl}
                alt="Logo Aplikasi"
                className="w-full h-full object-contain rounded-md"
              />
            ) : (
              <GraduationCap className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight leading-none">
              Asisten<span className="text-emerald-400">Guru</span>
            </h1>
            <p className="text-[10px] text-slate-300 font-semibold truncate max-w-[200px] mt-0.5">
              Yayasan Walisongo Rumbai Jaya
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {currentUser.role === 'ADMIN_YAYASAN' && pendingResetCount > 0 && (
            <button
              type="button"
              onClick={() => onTabSelect('PERMINTAAN_RESET')}
              className="p-2 rounded-xl bg-rose-950/80 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer animate-pulse"
              title="Permintaan reset kata sandi"
            >
              <Bell className="w-4 h-4 text-rose-400" />
              <span>{pendingResetCount}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Buka Menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop for Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden no-print"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 no-print ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {foundation.logoAppUrl ? (
              <img
                src={foundation.logoAppUrl}
                alt="Logo App"
                className="w-10 h-10 object-contain rounded-xl bg-white/10 p-1 border border-white/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <GraduationCap className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black tracking-tight text-white leading-none">
                  Asisten<span className="text-emerald-400">Guru</span>
                </h2>
                <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold mt-1 truncate">
                Yayasan Walisongo Rumbai Jaya
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
            Menu Utama
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-600 text-white shadow-xs animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Card & Logout at Bottom */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 mb-3">
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-sm border border-emerald-700">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {currentUser.name.split('(')[0]}
              </div>
              <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">Yayasan Walisongo Rumbai Jaya</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">
                @{currentUser.username}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAccountSettings}
            className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 hover:text-white rounded-xl text-xs font-bold transition border border-emerald-800/80 hover:border-emerald-600 cursor-pointer shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>{currentUser.role === 'ADMIN_YAYASAN' ? 'Edit Nama & Akun' : 'Pengaturan Akun & Sandi'}</span>
          </button>

          {onOpenChatAdmin && (
            <button
              type="button"
              onClick={onOpenChatAdmin}
              className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-950/90 hover:bg-teal-900 text-teal-300 hover:text-white rounded-xl text-xs font-bold transition border border-teal-800/80 hover:border-teal-600 cursor-pointer shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Chat Admin Yayasan</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/90 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-700 hover:border-rose-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>
    </>
  );
};
