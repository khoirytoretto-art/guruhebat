import React from 'react';
import { User, School, TeacherRoleType } from '../../types';
import { StorageService } from '../../utils/storage';
import {
  Clock,
  BookOpen,
  Printer,
  Sparkles,
  Award,
  KeyRound,
  CheckCircle2,
  Users,
  FileSignature,
  School as SchoolIcon,
  MessageSquare,
  Database,
  ArrowUpDown,
  GraduationCap,
  UserCheck,
} from 'lucide-react';

interface MobileEWalletViewProps {
  currentUser: User;
  currentSchool?: School | null;
  onNavigateTab: (tab: string, extraRole?: TeacherRoleType) => void;
  onOpenAccountSettings: () => void;
  onOpenChatAdmin?: () => void;
}

export const MobileEWalletView: React.FC<MobileEWalletViewProps> = ({
  currentUser,
  currentSchool,
  onNavigateTab,
  onOpenAccountSettings,
  onOpenChatAdmin,
}) => {
  const foundation = StorageService.getFoundation();
  const attendances = StorageService.getAttendances({
    schoolId: currentSchool?.id,
    teacherId: currentUser.role === 'GURU' ? currentUser.id : undefined,
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const hasAttendedToday = attendances.some((a) => a.date === todayStr);
  const assignments = currentSchool ? StorageService.getAssignmentsBySchool(currentSchool.id) : [];
  const myAssignment = assignments.find((a) => a.teacherId === currentUser.id);
  const isAssigned =
    !!currentSchool &&
    (currentUser.assignedSchoolIds?.includes(currentSchool.id) ||
      currentUser.schoolId === currentSchool.id ||
      !!myAssignment);

  const myRoles: TeacherRoleType[] = isAssigned
    ? (myAssignment?.roles && myAssignment.roles.length > 0
        ? (myAssignment.roles as TeacherRoleType[])
        : ['GURU_BIDANG_STUDI'])
    : [];
  const pendingResets = StorageService.getResetRequests().filter((r) => r.status === 'PENDING').length;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const thisMonthAttendances = attendances.filter((a) => {
    const parts = a.date.split('-');
    return Number(parts[0]) === currentYear && Number(parts[1]) === currentMonth;
  });

  const recentActivities = attendances.slice(0, 4);

  return (
    <div className="space-y-4 pb-20 font-sans">
      {/* 1. E-WALLET HEADER CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-950 text-white p-5 shadow-xl border border-emerald-500/30">
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-teal-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-2xl object-cover border-2 border-emerald-400/50 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-emerald-700/80 text-white font-bold flex items-center justify-center border border-emerald-400/40 shadow-md">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-white truncate leading-tight">
                {currentUser.name}
              </h3>
              <p className="text-[11px] text-emerald-200/90 truncate flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                <span>Yayasan Walisongo Rumbai Jaya</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 shrink-0">
            {currentUser.role === 'ADMIN_YAYASAN'
              ? 'Admin Yayasan'
              : currentUser.role === 'ADMIN_SEKOLAH'
              ? 'Admin Sekolah'
              : currentUser.role === 'KEPALA_SEKOLAH'
              ? 'Kepala Sekolah'
              : 'Guru Pengampu'}
          </span>
        </div>

        <div className="relative z-10 py-3.5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-200/70">
            Status Presensi Hari Ini
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5">
                {hasAttendedToday ? (
                  <>
                    <span className="text-emerald-400">Presensi Hadir</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </>
                ) : (
                  <>
                    <span className="text-amber-300">Belum Absen</span>
                    <span className="text-xs font-normal text-amber-200/80">({todayStr})</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-emerald-300">
                {thisMonthAttendances.length}x Hadir
              </div>
              <div className="text-[10px] text-white/60">Bulan Ini</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ICON GRID MENU UTAMA GAYA E-WALLET */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
            <span>Menu Layanan Utama</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-medium">Cepat & Responsif</span>
        </div>

        {currentUser.role === 'GURU' && (
          <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
            {/* 1. Alur Lengkap: Pilih Sekolah -> Pilih Tugas -> Form Absen/Jurnal */}
            <button
              type="button"
              onClick={() => onNavigateTab('INPUT_TUGAS')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-slate-800 leading-tight">Presensi &amp; Tugas</span>
            </button>

            {/* 2. Cetak Dokumen Rekap */}
            <button
              type="button"
              onClick={() => onNavigateTab('RIWAYAT_CETAK')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 group-hover:scale-105 transition">
                <Printer className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-slate-800 leading-tight">Cetak Rekap</span>
            </button>

            {/* 3. Ganti Sandi */}
            <button
              type="button"
              onClick={onOpenAccountSettings}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-700/25 group-hover:scale-105 transition">
                <KeyRound className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-slate-800 leading-tight">Ganti Sandi</span>
            </button>

            {/* 4. Chat Admin Yayasan */}
            <button
              type="button"
              onClick={onOpenChatAdmin}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-teal-500/25 group-hover:scale-105 transition">
                <MessageSquare className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-slate-800 leading-tight">Chat Admin</span>
            </button>
          </div>
        )}

        {currentUser.role === 'KEPALA_SEKOLAH' && (
          <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
            {/* 1. Presensi Jam Kepala Sekolah (Khusus Lembaga Kepemimpinan) */}
            <button
              type="button"
              onClick={() => onNavigateTab('ABSEN_KEPSEK')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/25 group-hover:scale-105 transition">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Presensi Kepsek</span>
            </button>

            {/* 2. Tugas Mengajar & Jurnal (Semua Sekolah) */}
            <button
              type="button"
              onClick={() => onNavigateTab('INPUT_TUGAS')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Tugas Mengajar</span>
            </button>

            {/* 3. Cetak Rekap & Verifikasi */}
            <button
              type="button"
              onClick={() => onNavigateTab('CETAK_REKAP')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition">
                <Printer className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Cetak Rekap</span>
            </button>

            {/* 4. Pantau Jurnal & Guru */}
            <button
              type="button"
              onClick={() => onNavigateTab('MONITORING')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-purple-500/25 group-hover:scale-105 transition">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Pantau Guru</span>
            </button>

            {/* 5. Ganti Sandi */}
            <button
              type="button"
              onClick={onOpenAccountSettings}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-700/25 group-hover:scale-105 transition">
                <KeyRound className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Ganti Sandi</span>
            </button>

            {/* 6. Chat Admin */}
            <button
              type="button"
              onClick={onOpenChatAdmin}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-teal-500/25 group-hover:scale-105 transition">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Chat Admin</span>
            </button>
          </div>
        )}

        {currentUser.role === 'ADMIN_SEKOLAH' && (
          <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
            <button
              type="button"
              onClick={() => onNavigateTab('CETAK_REKAP')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition">
                <Printer className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Cetak F4</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('PERAN_GURU')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-purple-500/25 group-hover:scale-105 transition">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Peran Guru</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('URUTAN_JABATAN')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md shadow-amber-500/25 group-hover:scale-105 transition">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Urutan Cetak</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('TANDA_TANGAN')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 group-hover:scale-105 transition">
                <FileSignature className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Tanda Tangan</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('MAPEL_KELAS')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-teal-500/25 group-hover:scale-105 transition">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Mapel & Kelas</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('PROFIL')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/25 group-hover:scale-105 transition">
                <SchoolIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Profil Lembaga</span>
            </button>

            <button
              type="button"
              onClick={onOpenChatAdmin}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Chat Admin</span>
            </button>
          </div>
        )}

        {currentUser.role === 'ADMIN_YAYASAN' && (
          <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
            <button
              type="button"
              onClick={() => onNavigateTab('SEKOLAH')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition">
                <SchoolIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Lembaga</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('ADMIN_SEKOLAH')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Admin Akun</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('GURU')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-teal-500/25 group-hover:scale-105 transition">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Data Guru</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('PERMINTAAN_RESET')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 group-hover:scale-105 transition">
                <KeyRound className="w-5 h-5" />
                {pendingResets > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full border-2 border-white flex items-center justify-center animate-pulse">
                    {pendingResets}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Reset Sandi</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('STATUS_ONLINE')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Pantau Online</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('BACKUP_DATA')}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 group-hover:scale-105 transition">
                <Database className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Backup Data</span>
            </button>

            <button
              type="button"
              onClick={onOpenChatAdmin}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-700/25 group-hover:scale-105 transition">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Chat Admin</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. RIWAYAT AKTIVITAS TERKINI */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Aktivitas Presensi Terkini
          </h4>
          <span className="text-[10px] text-slate-400">Terbaru</span>
        </div>
        {recentActivities.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Belum ada catatan presensi terbaru.
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentActivities.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">
                      {item.namaKegiatan || item.roleUsed.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span>{item.date}</span>
                      <span>&bull;</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {item.timeRangeFormatted || `${item.jamMasuk}-${item.jamKeluar}`}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
