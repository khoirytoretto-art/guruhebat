import React, { useState, useEffect } from 'react';
import {
  User,
  School,
  TeacherAttendanceEntry,
  ClassJournalEntry,
  DokumenCetakType,
  RekapFilterType,
  PaperSize,
  JenisKegiatan,
  KeteranganJurnal,
} from '../../types';
import { StorageService, normalizeDateString, isClassMatch as checkClassMatch } from '../../utils/storage';
import { getCurrentLocation, calculateDistance } from '../../utils/location';
import { exportToPdfClient, printDocumentUniversal } from '../../utils/pdfGenerator';
import { PrintableAttendanceSheet } from '../print/PrintableAttendanceSheet';
import { PrintableJournalSheet } from '../print/PrintableJournalSheet';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Clock,
  Printer,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Save,
  Download,
  Users,
  Building2,
  Trash2,
  GraduationCap,
} from 'lucide-react';

interface KepalaSekolahDashboardProps {
  currentUser: User;
  currentSchool: School;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onDataChanged: () => void;
  onSchoolChange?: (school: School) => void;
}

export const KepalaSekolahDashboard: React.FC<KepalaSekolahDashboardProps> = ({
  currentUser,
  currentSchool,
  activeTab,
  onDataChanged,
  onSchoolChange,
}) => {
  const [notification, setNotification] = useState<string | null>(null);
  const [, setRefreshKey] = useState(0);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleDeleteJournal = (jrnId: string, desc: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Catatan Jurnal KBM?',
      message: `Catatan jurnal materi "${desc}" akan dihapus secara permanen.`,
      confirmText: 'Ya, Hapus Jurnal',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteJournal(jrnId);
        showToast('Catatan jurnal pembelajaran berhasil dihapus.');
        onDataChanged();
      },
    });
  };

  const handleDeleteAttendance = (attId: string, desc: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Rekaman Presensi?',
      message: `Presensi "${desc}" akan dihapus secara permanen dari basis data.`,
      confirmText: 'Ya, Hapus Presensi',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteAttendance(attId);
        showToast('Rekaman presensi berhasil dihapus.');
        onDataChanged();
      },
    });
  };

  // Real-time synchronization listener
  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setRefreshKey((k) => k + 1);
    });
    return () => unsub();
  }, []);

  // Absen Kepala Sekolah State & Multi-Sekolah
  const allSchools = StorageService.getSchools();
  const assignedSchools = allSchools.filter((s) => {
    if (currentUser.assignedSchoolIds && currentUser.assignedSchoolIds.includes(s.id)) return true;
    if (currentUser.schoolId === s.id) return true;
    if (s.kepalaSekolah && s.kepalaSekolah.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return true;
    return false;
  });
  const availableSchools = assignedSchools.length > 0 ? assignedSchools : allSchools;

  // Sekolah resmi tempat beliau bertugas sebagai Kepala Sekolah
  const principalSchool =
    allSchools.find((s) => s.id === currentUser.schoolId) ||
    allSchools.find(
      (s) =>
        s.kepalaSekolah &&
        s.kepalaSekolah.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    ) ||
    currentSchool;

  const [absenDate, setAbsenDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [absenJamMasuk, setAbsenJamMasuk] = useState<string>('07:00');
  const [absenJamKeluar, setAbsenJamKeluar] = useState<string>('14:30');
  const [absenKeterangan, setAbsenKeterangan] = useState<string>('Supervisi Manajerial & KBM Sekolah');

  useEffect(() => {
    if (principalSchool?.lockAttendanceTodayOnly) {
      setAbsenDate(new Date().toISOString().split('T')[0]);
    }
  }, [principalSchool?.id, principalSchool?.lockAttendanceTodayOnly]);

  const isDuplicateAbsenKepsek = Boolean(
    absenDate &&
    StorageService.getAttendances().some((a) => {
      if (a.teacherId !== currentUser.id) return false;
      if (a.schoolId && a.schoolId !== principalSchool.id) return false;
      const aDateNorm = a.date ? a.date.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      const targetDateNorm = absenDate ? absenDate.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      return aDateNorm === targetDateNorm && (a.id.startsWith('att-kepsek-') || a.classId === 'persekolah');
    })
  );

  // Jurnal Kelas (Kepala Sekolah Mengajar Bidang Studi) State (DIBUAT PER-KELAS)
  const classes = StorageService.getClasses(currentSchool.id);
  const subjects = StorageService.getSubjects(currentSchool.id);
  const [jurnalDate, setJurnalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [jurnalJamKe, setJurnalJamKe] = useState<number>(1);
  const [jurnalClassId, setJurnalClassId] = useState<string>(classes.length > 0 ? classes[0].id : '');
  const [jurnalSubjectId, setJurnalSubjectId] = useState<string>(subjects.length > 0 ? subjects[0].id : '');
  const [jurnalMateri, setJurnalMateri] = useState<string>('');
  const [jurnalJenisKegiatan, setJurnalJenisKegiatan] = useState<JenisKegiatan>('KBM');
  const [jurnalKeterangan, setJurnalKeterangan] = useState<KeteranganJurnal>('Tuntas');
  const [jurnalCatatan, setJurnalCatatan] = useState<string>('');

  // Rekap Print Filter States
  const [docType, setDocType] = useState<DokumenCetakType>('DAFTAR_HADIR_GURU');
  const [filterType, setFilterType] = useState<RekapFilterType>('BULANAN');
  const [paperSize, setPaperSize] = useState<PaperSize>('F4');
  const [selectedClassId, setSelectedClassId] = useState<string>(classes.length > 0 ? classes[0].id : '');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [pdfLoadingStatus, setPdfLoadingStatus] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const isDocPerSekolah =
    docType === 'DAFTAR_HADIR_KOKURIKULER' ||
    docType === 'DAFTAR_HADIR_EKSTRAKURIKULER';

  const handleSubmitJurnalKepsek = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jurnalClassId) {
      showToast('Harap pilih kelas pembelajaran.');
      return;
    }
    if (!jurnalMateri.trim()) {
      showToast('Harap masukkan materi pembelajaran jurnal.');
      return;
    }
    const subjObj = subjects.find((s) => s.id === jurnalSubjectId);
    const subjName = subjObj ? subjObj.name : 'Mata Pelajaran';
    const classObj = classes.find((c) => c.id === jurnalClassId);

    const newJournal: ClassJournalEntry = {
      id: `jrn-kepsek-${Date.now()}`,
      schoolId: currentSchool.id,
      classId: jurnalClassId,
      teacherId: currentUser.id,
      teacherName: `${currentUser.name} (Kepala Sekolah)`,
      date: jurnalDate,
      jamKe: Number(jurnalJamKe),
      subjectId: jurnalSubjectId,
      subjectName: subjName,
      materi: jurnalMateri.trim(),
      jenisKegiatan: jurnalJenisKegiatan,
      keterangan: jurnalKeterangan,
      catatan: jurnalCatatan.trim(),
      createdAt: new Date().toISOString(),
    };
    StorageService.addJournal(newJournal);
    setJurnalMateri('');
    setJurnalCatatan('');
    showToast(`Jurnal pembelajaran ${classObj?.name || ''} berhasil disimpan!`);
    onDataChanged();
  };

  const handleSubmitAbsenKepsek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicateAbsenKepsek) {
      showToast('Sudah absen boss!!, silahkan pilih kelas atau tanggal lain');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (principalSchool?.lockAttendanceTodayOnly && absenDate !== todayStr) {
      showToast(`GAGAL BOSS! Tanggal absen dikunci untuk hari ini (${todayStr}).`);
      return;
    }

    if (principalSchool?.enableGeofencing && principalSchool.latitude && principalSchool.longitude) {
      try {
        const pos = await getCurrentLocation();
        const dist = calculateDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          principalSchool.latitude,
          principalSchool.longitude
        );
        const radius = principalSchool.geofencingRadius || 50;
        if (dist > radius) {
          showToast(`GAGAL BOSS! Anda tidak dianggap Sekolah, Karena tidak berada dalam lokasi Sekolah!`);
          return;
        }
      } catch (err: any) {
        showToast(`Gagal verifikasi lokasi: ${err.message}`);
        return;
      }
    }

    const timeRange = `${absenJamMasuk}-${absenJamKeluar}`;
    const newAttendance: TeacherAttendanceEntry = {
      id: `att-kepsek-${Date.now()}`,
      schoolId: principalSchool.id, // Tercatat resmi pada sekolah kepemimpinan Kepala Sekolah
      classId: 'persekolah', // Kepsek attendance operates school-wide
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      roleUsed: 'GURU_BIDANG_STUDI',
      date: absenDate,
      jamMasuk: absenJamMasuk,
      jamKeluar: absenJamKeluar,
      timeRangeFormatted: timeRange,
      status: 'HADIR',
      keterangan: absenKeterangan || 'Presensi Kepala Sekolah',
      createdAt: new Date().toISOString(),
    };
    StorageService.addAttendance(newAttendance);
    showToast('Absen Berhasil');
    onDataChanged();
  };

  const allJournals = StorageService.getJournals({ schoolId: currentSchool.id });
  const allAttendances = StorageService.getAttendances({ schoolId: currentSchool.id });
  const assignments = StorageService.getAssignmentsBySchool(currentSchool.id);
  const users = StorageService.getUsers();
  const assignmentTeacherIds = new Set(assignments.map((a) => a.teacherId));
  const attendanceTeacherIds = new Set(allAttendances.map((a) => a.teacherId).filter(Boolean));
  const journalTeacherIds = new Set(allJournals.map((j) => j.teacherId).filter(Boolean));

  const schoolTeachers = users.filter(
    (u) =>
      (u.role === 'GURU' || u.role === 'KEPALA_SEKOLAH') &&
      (u.assignedSchoolIds?.includes(currentSchool.id) ||
        u.schoolId === currentSchool.id ||
        assignmentTeacherIds.has(u.id) ||
        attendanceTeacherIds.has(u.id) ||
        journalTeacherIds.has(u.id))
  );

  // Gunakan HANYA kelas resmi yang telah diinputkan oleh admin untuk sekolah ini (tanpa kelas bayangan/sintetis)
  const allAvailableClasses = classes;

  const isClassMatch = (entryClassId?: string, targetIdOrName?: string) => {
    return checkClassMatch(entryClassId, targetIdOrName, allAvailableClasses, currentSchool.id);
  };

  const isAllClassesSelected = selectedClassId === 'SEMUA_KELAS' || selectedClassId === 'ALL';
  const effectiveClassId = isAllClassesSelected
    ? 'SEMUA_KELAS'
    : (selectedClassId || (allAvailableClasses.length > 0 ? allAvailableClasses[0].id : ''));
  const selectedClassName = isAllClassesSelected
    ? 'Semua Kelas'
    : (allAvailableClasses.find(
        (c) => c.id === effectiveClassId || c.name.toLowerCase() === effectiveClassId.toLowerCase()
      )?.name || (classes.length > 0 ? classes[0].name : 'Kelas'));

  const handleDownloadPdf = async () => {
    const elementId =
      docType === 'JURNAL_KELAS'
        ? 'kepsek-journal-print'
        : 'kepsek-attendance-print';
    setPdfLoadingStatus(`Memproses PDF ${paperSize}...`);
    const tag = isDocPerSekolah ? 'Persekolah' : (selectedClassName || 'Kelas').replace(/\s+/g, '_');
    const filename = `Kepsek_${docType}_${currentSchool.name}_${tag}_${paperSize}.pdf`;

    const success = await exportToPdfClient({
      elementId,
      filename,
      orientation: 'landscape',
      paperSize,
      onProgress: (status) => setPdfLoadingStatus(status),
    });

    if (success) {
      showToast(`PDF ${paperSize} berhasil diunduh!`);
    }
    setPdfLoadingStatus(null);
  };

  const handleBrowserPrint = () => {
    const elementId =
      docType === 'JURNAL_KELAS'
        ? 'kepsek-journal-print'
        : 'kepsek-attendance-print';
    printDocumentUniversal({ elementId, paperSize });
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-top-4 ${
            notification.includes('Sudah absen')
              ? 'bg-rose-900 border-rose-700'
              : 'bg-emerald-900 border-emerald-700'
          }`}
        >
          {notification.includes('Sudah absen') ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* TAB 1: ABSEN KEPALA SEKOLAH */}
      {activeTab === 'ABSEN_KEPSEK' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-700" />
                Form Presensi Jam Hadir Kepala Sekolah
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan waktu jam hadir Kepala Sekolah resmi di <strong>{principalSchool.name}</strong> ({principalSchool.jenjang}).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {availableSchools.length > 1 && onSchoolChange && (
                <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                  <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <span className="text-[11px] font-bold text-indigo-950">Ganti Sekolah:</span>
                  <select
                    value={currentSchool.id}
                    onChange={(e) => {
                      const found = availableSchools.find((s) => s.id === e.target.value);
                      if (found) onSchoolChange(found);
                    }}
                    className="bg-white text-xs font-bold text-indigo-900 border border-indigo-300 rounded-lg px-2 py-0.5 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                  >
                    {availableSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.jenjang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 font-bold border border-indigo-200">
                Kepala Sekolah {principalSchool.name}
              </span>
            </div>
          </div>

          {currentSchool.id !== principalSchool.id && (
            <div className="p-4 bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-extrabold text-indigo-950 flex items-center gap-1.5 text-sm">
                  <span>📌</span>
                  <span>Fitur Khusus Presensi Kepala Sekolah</span>
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Anda ditugaskan resmi sebagai Kepala Sekolah di <strong>{principalSchool.name}</strong>. Presensi jam hadir Kepala Sekolah tercatat resmi pada lembaga <strong>{principalSchool.name}</strong>. Jika Anda mendapatkan tugas mengajar di <strong>{currentSchool.name}</strong>, Anda juga dapat mengisi presensi dan jurnal mengajar melalui menu <strong>Presensi &amp; Jurnal Mengajar</strong>.
                </p>
              </div>
              {onSchoolChange && (
                <button
                  type="button"
                  onClick={() => onSchoolChange(principalSchool)}
                  className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  Beralih ke {principalSchool.name}
                </button>
              )}
            </div>
          )}

          {isDuplicateAbsenKepsek && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-500 rounded-2xl text-rose-700 font-bold text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
              <span className="text-xl shrink-0">⚠️</span>
              <span>Sudah absen boss!!, silahkan pilih kelas atau tanggal lain</span>
            </div>
          )}

          <form onSubmit={handleSubmitAbsenKepsek} className="space-y-4 text-xs max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={absenDate}
                  onChange={(e) => setAbsenDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  readOnly
                  value={currentUser.name}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-800 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jam Masuk</label>
                <input
                  type="time"
                  required
                  value={absenJamMasuk}
                  onChange={(e) => setAbsenJamMasuk(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-base font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jam Keluar</label>
                <input
                  type="time"
                  required
                  value={absenJamKeluar}
                  onChange={(e) => setAbsenJamKeluar(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-base font-bold text-blue-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Keterangan / Agenda Kegiatan
              </label>
              <input
                type="text"
                value={absenKeterangan}
                onChange={(e) => setAbsenKeterangan(e.target.value)}
                placeholder="Supervisi KBM, rapat dinas, atau pembinaan guru"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isDuplicateAbsenKepsek}
                className={`px-6 py-2.5 font-bold rounded-2xl shadow transition flex items-center gap-2 text-xs ${
                  isDuplicateAbsenKepsek
                    ? 'bg-rose-600 text-white cursor-not-allowed shadow-rose-600/25'
                    : 'bg-indigo-700 hover:bg-indigo-800 text-white shadow-indigo-700/25 cursor-pointer'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {isDuplicateAbsenKepsek
                    ? 'Sudah absen boss!!, silahkan pilih kelas atau tanggal lain'
                    : `Simpan Presensi Kepala Sekolah (${principalSchool.name})`}
                </span>
              </button>
            </div>
          </form>

          {/* Riwayat Presensi Jam Hadir Kepala Sekolah */}
          <div className="pt-5 border-t border-slate-100 space-y-3">
            <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-700" />
              <span>Riwayat Jam Hadir Kepala Sekolah Saya</span>
            </h4>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {allAttendances
                .filter((a) => a.teacherId === currentUser.id && (a.id.startsWith('att-kepsek-') || a.classId === 'persekolah'))
                .map((a) => (
                  <div key={a.id} className="py-2.5 text-xs flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{a.date}</span>
                        <span className="font-mono text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                          {a.timeRangeFormatted || `${a.jamMasuk}-${a.jamKeluar}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{a.keterangan || 'Presensi Kepala Sekolah'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttendance(a.id, `Kepala Sekolah (${a.date})`)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition shrink-0"
                      title="Hapus rekaman presensi ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {allAttendances.filter((a) => a.teacherId === currentUser.id && (a.id.startsWith('att-kepsek-') || a.classId === 'persekolah')).length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center italic">
                  Belum ada rekaman jam hadir Kepala Sekolah.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1B: JURNAL KELAS KEPSEK (PER-KELAS) */}
      {activeTab === 'JURNAL_KEPSEK' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-700" />
                  Isi Jurnal Kelas (Kepala Sekolah Guru Bidang Studi - Dibuat Per-Kelas)
                </h3>
                <p className="text-xs text-slate-500">
                  Form khusus Kepala Sekolah yang mengajar jam pelajaran di kelas <strong>{currentSchool.name}</strong>.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold border border-purple-200">
                Per-Kelas
              </span>
            </div>

            <form onSubmit={handleSubmitJurnalKepsek} className="space-y-4 text-xs">
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl">
                <label className="block font-bold text-purple-950 mb-1.5 flex items-center gap-1.5 text-xs">
                  <Users className="w-4 h-4 text-purple-700" />
                  <span>Pilih Kelas Pembelajaran (Wajib Per-Kelas) *</span>
                </label>
                <select
                  required
                  value={jurnalClassId}
                  onChange={(e) => setJurnalClassId(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2.5 border border-purple-300 rounded-xl bg-white font-bold text-purple-950 text-xs focus:ring-2 focus:ring-purple-500"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal KBM</label>
                  <input
                    type="date"
                    required
                    value={jurnalDate}
                    onChange={(e) => setJurnalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Pelajaran Ke-</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={jurnalJamKe}
                    onChange={(e) => setJurnalJamKe(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                  <select
                    value={jurnalSubjectId}
                    onChange={(e) => setJurnalSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kegiatan</label>
                  <select
                    value={jurnalJenisKegiatan}
                    onChange={(e) => setJurnalJenisKegiatan(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="KBM">KBM (Kegiatan Belajar Mengajar)</option>
                    <option value="Asesmen">Asesmen / Ujian / Ulangan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Keterangan Capaian</label>
                  <select
                    value={jurnalKeterangan}
                    onChange={(e) => setJurnalKeterangan(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-emerald-800"
                  >
                    <option value="Tuntas">Tuntas</option>
                    <option value="Belum Tuntas">Belum Tuntas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Materi Pembelajaran / Pokok Bahasan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={jurnalMateri}
                  onChange={(e) => setJurnalMateri(e.target.value)}
                  placeholder="Tuliskan materi pelajaran yang disampaikan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={jurnalCatatan}
                  onChange={(e) => setJurnalCatatan(e.target.value)}
                  placeholder="Catatan kelas atau penugasan siswa"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-2xl shadow transition flex items-center gap-2 cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" /> Simpan Jurnal Kelas Kepala Sekolah
                </button>
              </div>
            </form>
          </div>

          {/* Riwayat Jurnal Yang Diisi Kepala Sekolah */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              Riwayat Jurnal yang Telah Diisi oleh Kepala Sekolah
            </h4>
            <div className="divide-y divide-slate-100">
              {allJournals
                .filter((j) => j.teacherId === currentUser.id)
                .map((j) => {
                  const cObj = classes.find((c) => c.id === j.classId);
                  return (
                    <div key={j.id} className="py-3 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{j.subjectName} &bull; Jam Ke-{j.jamKe}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-800 rounded-full font-bold border border-purple-200">
                            {cObj ? cObj.name : 'Kelas'}
                          </span>
                        </div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{j.materi}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tgl: {j.date} &bull; Status: {j.keterangan} {j.catatan && ` &bull; ${j.catatan}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 shrink-0">
                          {j.jenisKegiatan}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteJournal(j.id, j.materi)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition shrink-0"
                          title="Hapus Jurnal Pembelajaran"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {allJournals.filter((j) => j.teacherId === currentUser.id).length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center italic">
                  Belum ada jurnal yang diisi oleh Kepala Sekolah.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CETAK REKAP & VERIFIKASI (PER-KELAS / PERSEKOLAH) */}
      {activeTab === 'CETAK_REKAP' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Verifikasi & Cetak Rekap Dokumen (Landscape {paperSize})
              </h3>
              <p className="text-xs text-slate-500">
                Pencetakan dokumen per-kelas untuk KBM/Daftar Hadir Guru, dan persekolah untuk Kokurikuler/Ekskul.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-slate-300 overflow-hidden text-xs mr-2">
                <button
                  type="button"
                  onClick={() => setPaperSize('A4')}
                  className={`px-3 py-1.5 font-bold cursor-pointer ${
                    paperSize === 'A4' ? 'bg-indigo-700 text-white' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('F4')}
                  className={`px-3 py-1.5 font-bold cursor-pointer ${
                    paperSize === 'F4' ? 'bg-indigo-700 text-white' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  F4
                </button>
              </div>

              <button
                type="button"
                onClick={handleBrowserPrint}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Browser</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!!pdfLoadingStatus}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{pdfLoadingStatus || `Unduh PDF (${paperSize})`}</span>
              </button>
            </div>
          </div>

          {/* Filter Bar Dokumen */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs no-print">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pilih Dokumen:</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DokumenCetakType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-indigo-950"
              >
                <option value="DAFTAR_HADIR_GURU">DAFTAR HADIR GURU (Per-Kelas)</option>
                <option value="JURNAL_KELAS">REKAP JURNAL PEMBELAJARAN KELAS (Per-Kelas)</option>
                {currentSchool.jenjang === 'SD' && (
                  <>
                    <option value="DAFTAR_HADIR_GURU_BANTU">DAFTAR HADIR GURU BANTU (Per-Kelas)</option>
                    <option value="DAFTAR_HADIR_GURU_DINIYAH">DAFTAR HADIR GURU DINIYAH (Per-Kelas)</option>
                  </>
                )}
                <option value="DAFTAR_HADIR_KOKURIKULER">DAFTAR HADIR KOORDINATOR KOKURIKULER (P5)</option>
                <option value="DAFTAR_HADIR_EKSTRAKURIKULER">DAFTAR HADIR PEMBINA EKSTRAKURIKULER</option>
              </select>
            </div>

              {/* DROPDOWN PEMILIHAN KELAS DOKUMEN CETAK */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Pilih Kelas Rekap:</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-extrabold uppercase">
                    {isDocPerSekolah ? 'Lembaga' : 'Per-Kelas'}
                  </span>
                </label>
                {isDocPerSekolah ? (
                  <div className="px-3 py-2 border border-purple-300 rounded-xl bg-purple-50 text-purple-900 font-bold text-center">
                    Tingkat Persekolah (Seluruh Lembaga)
                  </div>
                ) : (
                  <select
                    value={effectiveClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-indigo-400 focus:border-indigo-600 rounded-xl font-bold bg-white text-indigo-950 shadow-xs cursor-pointer text-xs"
                  >
                    {allAvailableClasses.length === 0 ? (
                      <option value="">-- Belum ada data kelas --</option>
                    ) : (
                      <>
                        <option value="SEMUA_KELAS">
                          ⭐ SEMUA KELAS ({allAttendances.length} presensi, {allJournals.length} jurnal)
                        </option>
                        {allAvailableClasses.map((c) => {
                          const attCount = allAttendances.filter((a) => isClassMatch(a.classId, c.id)).length;
                          const jrnCount = allJournals.filter((j) => isClassMatch(j.classId, c.id)).length;
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} ({attCount} presensi, {jrnCount} jurnal)
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                )}
              </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bulan:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-2 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {[
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
                  ].map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tahun:</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-2 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-100 p-4 rounded-3xl border border-slate-300 overflow-x-auto shadow-inner">
            {/* Quick Class Switcher Toolbar */}
            {!isDocPerSekolah && allAvailableClasses.length > 0 && (
              <div className="bg-white rounded-2xl border border-indigo-200 p-3 mb-3 no-print flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-700" />
                    <span>Kelas Cetak Terpilih:</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {allAvailableClasses.map((c) => {
                      const isSelected = effectiveClassId === c.id;
                      const attCount = allAttendances.filter((a) => isClassMatch(a.classId, c.id)).length;
                      const jrnCount = allJournals.filter((j) => isClassMatch(j.classId, c.id)).length;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClassId(c.id)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200'
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-indigo-900 text-indigo-100' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {attCount} presensi / {jrnCount} jurnal
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
                  <span>Dokumen khusus kelas: <strong className="text-indigo-950 font-bold">{selectedClassName}</strong></span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-slate-300 overflow-hidden">
              {docType === 'JURNAL_KELAS' ? (
                <PrintableJournalSheet
                  id="kepsek-journal-print"
                  school={currentSchool}
                  classId={effectiveClassId}
                  className={selectedClassName}
                  journals={allJournals.filter((j) => {
                    if (isAllClassesSelected) {
                      if (!allAvailableClasses.some((sc) => isClassMatch(j.classId, sc.id))) return false;
                    } else {
                      if (!effectiveClassId) return false;
                      const matchClass = isClassMatch(j.classId, effectiveClassId);
                      if (!matchClass) return false;
                    }
                    const dateInfo = normalizeDateString(j.date);
                    if (!dateInfo) return false;
                    return dateInfo.year === selectedYear && dateInfo.month === selectedMonth;
                  })}
                  periodeText={`Bulan ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][selectedMonth - 1]} ${selectedYear}`}
                  paperSize={paperSize}
                  selectedMonth={selectedMonth}
                />
              ) : (
                <PrintableAttendanceSheet
                  id="kepsek-attendance-print"
                  school={currentSchool}
                  docType={docType}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  selectedClassId={isDocPerSekolah ? undefined : effectiveClassId}
                  className={isDocPerSekolah ? undefined : selectedClassName}
                  assignments={assignments}
                  teachers={schoolTeachers}
                  attendances={allAttendances}
                  paperSize={paperSize}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONITORING */}
      {activeTab === 'MONITORING' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Monitoring KBM &amp; Jurnal Pembelajaran Guru
              </h3>
              <p className="text-xs text-slate-500">
                Daftar pengisian jurnal terbaru oleh para guru di {currentSchool.name}.
              </p>
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
            >
              <option value="">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-slate-100">
            {allJournals
              .filter((j) => !selectedClassId || j.classId === selectedClassId)
              .map((j) => {
                const cObj = classes.find((c) => c.id === j.classId);
                return (
                  <div key={j.id} className="py-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{j.subjectName} &bull; Jam Ke-{j.jamKe}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold border border-indigo-200">
                          {cObj ? cObj.name : 'Kelas'}
                        </span>
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">{j.materi}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Guru: {j.teacherName} &bull; Tgl: {j.date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {j.keterangan}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteJournal(j.id, `${j.subjectName} (${j.teacherName})`)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition shrink-0"
                        title="Hapus rekaman jurnal ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type || 'danger'}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
