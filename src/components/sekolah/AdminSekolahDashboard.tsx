import React, { useState, useEffect } from 'react';
import {
  School,
  User,
  TeacherAssignment,
  SchoolClass,
  Subject,
  ClassJournalEntry,
  TeacherAttendanceEntry,
  TeacherRoleType,
  HierarchyJabatan,
  DokumenCetakType,
  RekapFilterType,
  DocumentSignatureConfig,
  PaperSize,
  JenjangSekolah,
  Akreditasi,
} from '../../types';
import { StorageService, normalizeDateString, isClassMatch as checkClassMatch } from '../../utils/storage';
import { exportToPdfClient, printDocumentUniversal } from '../../utils/pdfGenerator';
import { compressImageToDataUrl } from '../../utils/imageCompressor';
import { PrintableAttendanceSheet } from '../print/PrintableAttendanceSheet';
import { PrintableJournalSheet } from '../print/PrintableJournalSheet';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Printer,
  Upload,
  ArrowUpDown,
  Plus,
  Trash2,
  Download,
  Save,
  FileSignature,
  Users,
  CheckCircle2,
  AlertCircle,
  Database,
  GraduationCap,
} from 'lucide-react';

interface AdminSekolahDashboardProps {
  currentSchool: School;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSchoolUpdated: () => void;
}

export const AdminSekolahDashboard: React.FC<AdminSekolahDashboardProps> = ({
  currentSchool,
  activeTab,
  onTabChange,
  onSchoolUpdated,
}) => {
  const [school, setSchool] = useState<School>(currentSchool);
  const [notification, setNotification] = useState<string | null>(null);
  const [pdfLoadingStatus, setPdfLoadingStatus] = useState<string | null>(null);

  // Storage Data
  const [allUsers, setAllUsers] = useState<User[]>(StorageService.getUsers());
  const [assignments, setAssignments] = useState<TeacherAssignment[]>(
    StorageService.getAssignmentsBySchool(currentSchool.id)
  );
  const [classes, setClasses] = useState<SchoolClass[]>(
    StorageService.getClasses(currentSchool.id)
  );
  const [subjects, setSubjects] = useState<Subject[]>(
    StorageService.getSubjects(currentSchool.id)
  );
  const [journals, setJournals] = useState<ClassJournalEntry[]>(
    StorageService.getJournals({ schoolId: currentSchool.id })
  );
  const [attendances, setAttendances] = useState<TeacherAttendanceEntry[]>(
    StorageService.getAttendances({ schoolId: currentSchool.id })
  );

  // Rekap Print Filter States with Persistent LocalStorage
  const [docType, setDocTypeState] = useState<DokumenCetakType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`asistenguru_doc_type_${currentSchool.id}`);
      if (saved) return saved as DokumenCetakType;
    }
    return 'DAFTAR_HADIR_GURU';
  });

  const setDocType = (dt: DokumenCetakType) => {
    setDocTypeState(dt);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`asistenguru_doc_type_${currentSchool.id}`, dt);
      } catch {}
    }
  };

  const [filterType, setFilterType] = useState<RekapFilterType>('BULANAN');
  const [paperSize, setPaperSize] = useState<PaperSize>('F4');
  
  const [selectedClassId, setSelectedClassIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`asistenguru_class_id_${currentSchool.id}`);
      if (saved) return saved;
    }
    const currentClasses = StorageService.getClasses(currentSchool.id);
    return currentClasses.length > 0 ? currentClasses[0].id : '';
  });

  const setSelectedClassId = (cid: string) => {
    setSelectedClassIdState(cid);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`asistenguru_class_id_${currentSchool.id}`, cid);
      } catch {}
    }
  };

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);

  // Synchronize internal state when currentSchool changes
  useEffect(() => {
    setSchool(currentSchool);
    setAllUsers(StorageService.getUsers());
    const newClasses = StorageService.getClasses(currentSchool.id);
    setClasses(newClasses);
    setAssignments(StorageService.getAssignmentsBySchool(currentSchool.id));
    setSubjects(StorageService.getSubjects(currentSchool.id));
    setJournals(StorageService.getJournals({ schoolId: currentSchool.id }));
    setAttendances(StorageService.getAttendances({ schoolId: currentSchool.id }));
    if (!selectedClassId && newClasses.length > 0) {
      setSelectedClassId(newClasses[0].id);
    }
  }, [currentSchool.id, currentSchool]);

  // Real-time Storage update listener
  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      const freshSchool = StorageService.getSchoolById(currentSchool.id);
      if (freshSchool) setSchool(freshSchool);
      setAllUsers(StorageService.getUsers());
      setClasses(StorageService.getClasses(currentSchool.id));
      setAssignments(StorageService.getAssignmentsBySchool(currentSchool.id));
      setSubjects(StorageService.getSubjects(currentSchool.id));
      setJournals(StorageService.getJournals({ schoolId: currentSchool.id }));
      setAttendances(StorageService.getAttendances({ schoolId: currentSchool.id }));
    });
    return () => unsub();
  }, [currentSchool.id]);

  // Safe In-App Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form states
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [mgmtTab, setMgmtTab] = useState<'JURNAL' | 'PRESENSI'>('JURNAL');
  const [mgmtSearch, setMgmtSearch] = useState('');
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassTingkat, setNewClassTingkat] = useState(1);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState<{
    name: string;
    code: string;
    teacherId: string;
    classIds: string[];
  }>({
    name: '',
    code: '',
    teacherId: '',
    classIds: [],
  });

  // TANDA TANGAN STATE
  const [signatureConfig, setSignatureConfig] = useState<DocumentSignatureConfig>(
    currentSchool.signatureConfig || {
      tampilkanTandaTangan: true,
      pakaiTanggal: true,
      tanggalManual: '',
      pihak1Aktif: true,
      pihak1Label: 'Mengetahui,',
      pihak1Jabatan: 'Kepala Sekolah',
      pihak1Nama: currentSchool.kepalaSekolah,
      pihak1Nip: currentSchool.nipKepalaSekolah,
      pihak2Aktif: true,
      pihak2Label: 'Disahkan di Riau,',
      pihak2Jabatan: 'Waka Kurikulum / Wali Kelas',
      pihak2Nama: currentSchool.wakaKurikulum || currentSchool.kepalaSekolah,
      pihak2Nip: currentSchool.nipWakaKurikulum,
      lokasiKota: 'Riau',
    }
  );

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshData = () => {
    const updatedSch = StorageService.getSchoolById(school.id) || school;
    setSchool(updatedSch);
    if (updatedSch.signatureConfig) {
      setSignatureConfig(updatedSch.signatureConfig);
    }
    setAllUsers(StorageService.getUsers());
    setAssignments(StorageService.getAssignmentsBySchool(school.id));
    setClasses(StorageService.getClasses(school.id));
    setSubjects(StorageService.getSubjects(school.id));
    setJournals(StorageService.getJournals({ schoolId: school.id }));
    setAttendances(StorageService.getAttendances({ schoolId: school.id }));
    onSchoolUpdated();
  };

  // Teachers assigned to this school (by yayasan, assignment, subject, or who have logged attendance/journals)
  const assignmentTeacherIds = new Set(assignments.map((a) => a.teacherId));
  const subjectTeacherIds = new Set(subjects.map((s) => s.teacherId).filter(Boolean));
  const attendanceTeacherIds = new Set(attendances.map((a) => a.teacherId).filter(Boolean));
  const journalTeacherIds = new Set(journals.map((j) => j.teacherId).filter(Boolean));

  const yayasanTeachersForSchool = allUsers.filter(
    (u) =>
      (u.role === 'GURU' || u.role === 'KEPALA_SEKOLAH') &&
      (u.assignedSchoolIds?.includes(school.id) ||
        u.schoolId === school.id ||
        assignmentTeacherIds.has(u.id) ||
        subjectTeacherIds.has(u.id) ||
        attendanceTeacherIds.has(u.id) ||
        journalTeacherIds.has(u.id))
  );

  // KECUALI KOKURIKULER DAN EKSTRA HANYA PERSEKOLAH
  const isDocPerSekolah =
    docType === 'DAFTAR_HADIR_KOKURIKULER' ||
    docType === 'DAFTAR_HADIR_EKSTRAKURIKULER';

  // 1. SAVE PROFILE LEMBAGA & LOGO
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.updateSchool(school);
    showToast('Profil lembaga, logo, dan akreditasi berhasil diperbarui.');
    refreshData();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 280, 280, 0.85);
        setSchool({ ...school, logoUrl: compressed });
        showToast('Logo berhasil dipilih & dikompres optimal! Silakan klik Simpan Profil.');
      } catch {
        showToast('Gagal memproses gambar logo sekolah');
      }
    }
  };

  // 2. SIMPAN PENGATURAN TANDA TANGAN DOKUMEN
  const handleSaveSignatureConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...school,
      signatureConfig,
    };
    StorageService.updateSchool(updated);
    setSchool(updated);
    showToast('Pengaturan tanda tangan dokumen cetak berhasil disimpan!');
    refreshData();
  };

  const handleQuickUpdateSignature = (newConfig: DocumentSignatureConfig) => {
    setSignatureConfig(newConfig);
    const updated = {
      ...school,
      signatureConfig: newConfig,
    };
    StorageService.updateSchool(updated);
    setSchool(updated);
  };

  const handleSwapSignatures = () => {
    const nextCfg: DocumentSignatureConfig = {
      ...signatureConfig,
      pihak1Aktif: signatureConfig.pihak2Aktif,
      pihak1Label: signatureConfig.pihak2Label.startsWith('Disahkan') ? 'Mengetahui,' : signatureConfig.pihak2Label,
      pihak1Jabatan: signatureConfig.pihak2Jabatan,
      pihak1Nama: signatureConfig.pihak2Nama,
      pihak1Nip: signatureConfig.pihak2Nip,
      pihak2Aktif: signatureConfig.pihak1Aktif,
      pihak2Label: signatureConfig.pihak1Label.startsWith('Mengetahui')
        ? `Disahkan di ${signatureConfig.lokasiKota || 'Riau'},`
        : signatureConfig.pihak1Label,
      pihak2Jabatan: signatureConfig.pihak1Jabatan,
      pihak2Nama: signatureConfig.pihak1Nama,
      pihak2Nip: signatureConfig.pihak1Nip,
    };
    handleQuickUpdateSignature(nextCfg);
    showToast('Posisi tanda tangan kiri & kanan berhasil ditukar!');
  };

  // 3. TEACHER ROLE ASSIGNMENTS
  const handleToggleTeacherRole = (teacherId: string, role: TeacherRoleType) => {
    const existing = assignments.find((a) => a.teacherId === teacherId);
    let currentRoles: TeacherRoleType[] = existing ? [...existing.roles] : [];
    if (currentRoles.includes(role)) {
      currentRoles = currentRoles.filter((r) => r !== role);
    } else {
      currentRoles.push(role);
    }

    const asg: TeacherAssignment = {
      id: existing ? existing.id : `asg-${Date.now()}-${teacherId}`,
      teacherId,
      schoolId: school.id,
      roles: currentRoles,
      jabatan: existing?.jabatan || 'GURU_BIDANG_STUDI',
      customJabatan: existing?.customJabatan || '',
      urutan: existing?.urutan || (assignments.length + 1),
      assignedClassIds: existing?.assignedClassIds || (classes.map((c) => c.id)),
      namaKokurikuler: existing?.namaKokurikuler || 'Projek P5 (Kearifan Lokal)',
      namaEkstrakurikuler: existing?.namaEkstrakurikuler || 'Pramuka / Ekstrakurikuler',
    };
    StorageService.saveAssignment(asg);
    refreshData();
    showToast('Peran penugasan guru berhasil diperbarui.');
  };

  const handleUpdateKokurikulerName = (teacherId: string, namaKokurikuler: string) => {
    const existing = assignments.find((a) => a.teacherId === teacherId);
    if (!existing) return;
    const updated: TeacherAssignment = {
      ...existing,
      namaKokurikuler,
    };
    StorageService.saveAssignment(updated);
    refreshData();
  };

  const handleUpdateEkstrakurikulerName = (teacherId: string, namaEkstrakurikuler: string) => {
    const existing = assignments.find((a) => a.teacherId === teacherId);
    if (!existing) return;
    const updated: TeacherAssignment = {
      ...existing,
      namaEkstrakurikuler,
    };
    StorageService.saveAssignment(updated);
    refreshData();
  };

  const handleUpdateAssignmentJabatan = (
    teacherId: string,
    jabatan: HierarchyJabatan,
    customJabatan: string,
    urutan: number
  ) => {
    const existing = assignments.find((a) => a.teacherId === teacherId);
    if (!existing) return;
    const updated: TeacherAssignment = {
      ...existing,
      jabatan,
      customJabatan,
      urutan,
    };
    StorageService.saveAssignment(updated);
    refreshData();
  };

  // 4. URUTAN HIERARKI
  const moveUrutan = (index: number, direction: 'UP' | 'DOWN') => {
    const sorted = [...assignments].sort((a, b) => a.urutan - b.urutan);
    if (direction === 'UP' && index > 0) {
      const prev = sorted[index - 1];
      const curr = sorted[index];
      const tempUrutan = curr.urutan;
      curr.urutan = prev.urutan;
      prev.urutan = tempUrutan;
      StorageService.saveAssignment(curr);
      StorageService.saveAssignment(prev);
      refreshData();
    } else if (direction === 'DOWN' && index < sorted.length - 1) {
      const next = sorted[index + 1];
      const curr = sorted[index];
      const tempUrutan = curr.urutan;
      curr.urutan = next.urutan;
      next.urutan = tempUrutan;
      StorageService.saveAssignment(curr);
      StorageService.saveAssignment(next);
      refreshData();
    }
  };

  // 5. KELAS & MAPEL HANDLERS
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const newCls: SchoolClass = {
      id: `class-${Date.now()}`,
      schoolId: school.id,
      name: newClassName.trim(),
      tingkat: newClassTingkat,
    };
    StorageService.addClass(newCls);
    setNewClassName('');
    setShowClassModal(false);
    refreshData();
    showToast(`Kelas "${newCls.name}" berhasil ditambahkan.`);
  };

  const handleDeleteClass = (classId: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Data Kelas?',
      message: `Yakin ingin menghapus kelas "${name}"? Seluruh data jurnal dan presensi di kelas ini akan terhapus.`,
      confirmText: 'Ya, Hapus Kelas',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteClass(classId);
        refreshData();
        showToast(`Kelas "${name}" telah berhasil dihapus.`);
      },
    });
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name || !subjectForm.teacherId) return;
    const newSubj: Subject = {
      id: `subj-${Date.now()}`,
      schoolId: school.id,
      name: subjectForm.name,
      code: subjectForm.code || subjectForm.name.slice(0, 3).toUpperCase(),
      teacherId: subjectForm.teacherId,
      classIds: subjectForm.classIds,
    };
    StorageService.addSubject(newSubj);
    setSubjectForm({ name: '', code: '', teacherId: '', classIds: [] });
    setShowSubjectModal(false);
    refreshData();
    showToast(`Mata pelajaran "${newSubj.name}" berhasil ditambahkan.`);
  };

  const handleDeleteSubject = (subjId: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Mata Pelajaran?',
      message: `Yakin ingin menghapus mata pelajaran "${name}" dari lembaga ${school.name}?`,
      confirmText: 'Ya, Hapus Mapel',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteSubject(subjId);
        refreshData();
        showToast(`Mata pelajaran "${name}" telah berhasil dihapus.`);
      },
    });
  };

  const handleDeleteAssignment = (asgId: string, teacherName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Penugasan Guru?',
      message: `Yakin ingin menghapus penugasan "${teacherName}" dari daftar lembaga ${school.name}?`,
      confirmText: 'Ya, Hapus Penugasan',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteAssignment(asgId);
        refreshData();
        showToast(`Penugasan "${teacherName}" telah dihapus.`);
      },
    });
  };

  const handleDeleteJournal = (journalId: string, desc: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Catatan Jurnal KBM?',
      message: `Yakin ingin menghapus jurnal materi "${desc}"? Data akan dihapus secara permanen dari basis data lembaga.`,
      confirmText: 'Ya, Hapus Jurnal',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteJournal(journalId);
        refreshData();
        showToast('Catatan jurnal pembelajaran berhasil dihapus.');
      },
    });
  };

  const handleDeleteAttendance = (attId: string, desc: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Rekaman Presensi?',
      message: `Yakin ingin menghapus rekaman presensi "${desc}"? Data akan dihapus secara permanen.`,
      confirmText: 'Ya, Hapus Presensi',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteAttendance(attId);
        refreshData();
        showToast('Rekaman presensi berhasil dihapus.');
      },
    });
  };

  // 6. DOWNLOAD PDF VIA CLIENT-SIDE
  const handleDownloadPdf = async () => {
    const elementId =
      docType === 'JURNAL_KELAS'
        ? 'journal-print-document'
        : 'attendance-print-document';
    setPdfLoadingStatus(`Memproses PDF ${paperSize}...`);
    const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name || 'Semua-Kelas';
    const classTag = isDocPerSekolah ? 'Persekolah' : selectedClassName.replace(/\s+/g, '_');
    const filename = `${docType}_${school.jenjang}_${classTag}_${selectedMonth}-${selectedYear}_${paperSize}.pdf`;

    const success = await exportToPdfClient({
      elementId,
      filename,
      orientation: 'landscape',
      paperSize,
      onProgress: (status) => setPdfLoadingStatus(status),
    });

    if (success) {
      showToast(`PDF ${paperSize} Landscape berhasil diunduh!`);
    }
    setPdfLoadingStatus(null);
  };

  const handleBrowserPrint = () => {
    const elementId =
      docType === 'JURNAL_KELAS'
        ? 'journal-print-document'
        : 'attendance-print-document';
    printDocumentUniversal({ elementId, paperSize });
  };

  // 7. FILTERING LOGIC (WAJIB PER-KELAS & TERINTEGRASI PENUH)
  // Gunakan HANYA kelas resmi yang telah diinputkan oleh admin untuk sekolah ini (tanpa kelas bayangan/sintetis)
  const allAvailableClasses = classes;

  const isClassMatch = (entryClassId?: string, targetIdOrName?: string) => {
    return checkClassMatch(entryClassId, targetIdOrName, allAvailableClasses, school.id);
  };

  const isAllClassesSelected = selectedClassId === 'SEMUA_KELAS' || selectedClassId === 'ALL';
  const effectiveClassId = isAllClassesSelected
    ? 'SEMUA_KELAS'
    : (selectedClassId || (allAvailableClasses.length > 0 ? allAvailableClasses[0].id : ''));
  const selectedClassObj = isAllClassesSelected
    ? null
    : allAvailableClasses.find(
        (c) => c.id === effectiveClassId || c.name.toLowerCase() === effectiveClassId.toLowerCase()
      );
  const selectedClassName = isAllClassesSelected
    ? 'Semua Kelas'
    : (selectedClassObj?.name || (classes.length > 0 ? classes[0].name : 'Kelas'));

  const filteredJournals = journals.filter((j) => {
    // 1. Jurnal kelas: jika SEMUA_KELAS loloskan jurnal milik kelas sekolah ini, jika per-kelas cocokkan kelas tepat
    if (!isAllClassesSelected) {
      if (!effectiveClassId) return false;
      const matchClass = isClassMatch(j.classId, effectiveClassId);
      if (!matchClass) return false;
    } else {
      if (!allAvailableClasses.some((sc) => isClassMatch(j.classId, sc.id))) return false;
    }

    // 2. Normalisasi tanggal
    const dateInfo = normalizeDateString(j.date);
    if (!dateInfo) return false;
    if (filterType === 'HARIAN') {
      const targetDay = (selectedDay || '').split('T')[0].trim();
      return dateInfo.formatted === targetDay;
    } else if (filterType === 'BULANAN') {
      return dateInfo.year === selectedYear && dateInfo.month === selectedMonth;
    } else if (filterType === 'TAHUNAN') {
      return dateInfo.year === selectedYear;
    }
    return true;
  });

  const getPeriodeLabel = () => {
    if (filterType === 'HARIAN') {
      const parts = (selectedDay || '').split('T')[0].trim().split('-').map(Number);
      const dObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(selectedDay);
      return dObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } else if (filterType === 'BULANAN') {
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    } else {
      return `Tahun ${selectedYear}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-top-4 ${
            notification.includes('Sudah absen') || notification.includes('Gagal') || notification.includes('Harap')
              ? 'bg-rose-900 border-rose-700'
              : 'bg-emerald-900 border-emerald-700'
          }`}
        >
          {notification.includes('Sudah absen') || notification.includes('Gagal') || notification.includes('Harap') ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* TAB 1: CETAK REKAP & DOKUMEN LANDSCAPE (PER-KELAS / PERSEKOLAH) */}
      {activeTab === 'CETAK_REKAP' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-700" />
                  Filter Dokumen Cetak (Per-Kelas / Persekolah)
                </h3>
                <p className="text-xs text-slate-500">
                  Cetak Jurnal & Absen per-kelas, kecuali Kokurikuler & Ekstrakurikuler yang dicetak tingkat persekolah.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                  title="Cetak langsung browser"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Browser</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!!pdfLoadingStatus}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-2xl shadow transition flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{pdfLoadingStatus || `Unduh PDF (${paperSize})`}</span>
                </button>
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Ukuran Kertas:
                </label>
                <div className="flex rounded-xl border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPaperSize('A4')}
                    className={`flex-1 py-2 font-bold text-[11px] cursor-pointer ${
                      paperSize === 'A4' ? 'bg-indigo-700 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('F4')}
                    className={`flex-1 py-2 font-bold text-[11px] cursor-pointer ${
                      paperSize === 'F4' ? 'bg-indigo-700 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    F4 (Folio)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Pilih Dokumen:
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DokumenCetakType)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold text-blue-900 bg-blue-50/50"
                >
                  <option value="DAFTAR_HADIR_GURU">DAFTAR HADIR GURU (Per-Kelas)</option>
                  <option value="JURNAL_KELAS">REKAP JURNAL PEMBELAJARAN KELAS (Per-Kelas)</option>
                  {school.jenjang === 'SD' && (
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
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Pilih Kelas Rekap:</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-extrabold uppercase">
                    {isDocPerSekolah ? 'Lembaga' : 'Per-Kelas'}
                  </span>
                </label>
                {isDocPerSekolah ? (
                  <div className="w-full px-3 py-2.5 border border-purple-300 rounded-xl bg-purple-50 text-purple-900 font-bold text-center">
                    Tingkat Persekolah (Seluruh Lembaga)
                  </div>
                ) : (
                  <select
                    value={effectiveClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-indigo-400 focus:border-indigo-600 rounded-xl font-bold bg-white text-indigo-950 shadow-xs cursor-pointer text-xs"
                  >
                    <option value="SEMUA_KELAS">
                      ⭐ SEMUA KELAS ({attendances.length} presensi, {journals.length} jurnal)
                    </option>
                    {allAvailableClasses.map((c) => {
                      const attCount = attendances.filter((a) => isClassMatch(a.classId, c.id)).length;
                      const jrnCount = journals.filter((j) => isClassMatch(j.classId, c.id)).length;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({attCount} presensi, {jrnCount} jurnal)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Periode Rekap:
                </label>
                <div className="flex rounded-xl border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFilterType('HARIAN')}
                    className={`flex-1 py-2 font-bold text-[11px] ${
                      filterType === 'HARIAN' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Harian
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('BULANAN')}
                    className={`flex-1 py-2 font-bold text-[11px] ${
                      filterType === 'BULANAN' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('TAHUNAN')}
                    className={`flex-1 py-2 font-bold text-[11px] ${
                      filterType === 'TAHUNAN' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tahunan
                  </button>
                </div>
              </div>

              <div>
                {filterType === 'HARIAN' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Pilih Tanggal:</label>
                    <input
                      type="date"
                      value={selectedDay}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedDay(val);
                        const dInfo = normalizeDateString(val);
                        if (dInfo) {
                          setSelectedMonth(dInfo.month);
                          setSelectedYear(dInfo.year);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                )}
                {filterType === 'BULANAN' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">Bulan:</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full px-2 py-2 border border-slate-300 rounded-xl"
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
                      <label className="block font-bold text-slate-700 mb-1.5">Tahun:</label>
                      <input
                        type="number"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full px-2 py-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                )}
                {filterType === 'TAHUNAN' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Pilih Tahun:</label>
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pratinjau Dokumen Landscape */}
          <div className="border border-slate-200 rounded-3xl bg-slate-100 p-4 overflow-x-auto shadow-inner">
            {/* Quick Class Switcher Toolbar */}
            {!isDocPerSekolah && allAvailableClasses.length > 0 && (
              <div className="bg-white rounded-2xl border border-indigo-200 p-3 mb-3 no-print flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-700" />
                    <span>Kelas Cetak Terpilih:</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedClassId('SEMUA_KELAS')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        effectiveClassId === 'SEMUA_KELAS'
                          ? 'bg-indigo-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200'
                      }`}
                    >
                      <span>⭐ Semua Kelas</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        effectiveClassId === 'SEMUA_KELAS' ? 'bg-indigo-900 text-indigo-100' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {attendances.length} presensi / {journals.length} jurnal
                      </span>
                    </button>
                    {allAvailableClasses.map((c) => {
                      const isSelected = effectiveClassId === c.id;
                      const attCount = attendances.filter((a) => isClassMatch(a.classId, c.id)).length;
                      const jrnCount = journals.filter((j) => isClassMatch(j.classId, c.id)).length;
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

            {/* Quick Signature & Date Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-3 no-print flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-indigo-700" />
                  <span>Pengesahan Tanda Tangan & Tanggal:</span>
                </span>

                {/* Switch Tanda Tangan ON/OFF */}
                <label className={`flex items-center gap-1.5 cursor-pointer font-bold px-2.5 py-1.5 rounded-xl border transition text-xs select-none ${
                  signatureConfig.tampilkanTandaTangan
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}>
                  <input
                    type="checkbox"
                    checked={signatureConfig.tampilkanTandaTangan}
                    onChange={(e) =>
                      handleQuickUpdateSignature({ ...signatureConfig, tampilkanTandaTangan: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>{signatureConfig.tampilkanTandaTangan ? '✓ Tanda Tangan Aktif' : '✗ Cetak Tanpa Tanda Tangan'}</span>
                </label>

                {/* Switch Pakai Tanggal ON/OFF */}
                {signatureConfig.tampilkanTandaTangan && (
                  <label className={`flex items-center gap-1.5 cursor-pointer font-bold px-2.5 py-1.5 rounded-xl border transition text-xs select-none ${
                    signatureConfig.pakaiTanggal !== false
                      ? 'bg-blue-50 border-blue-300 text-blue-900'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={signatureConfig.pakaiTanggal !== false}
                      onChange={(e) =>
                        handleQuickUpdateSignature({ ...signatureConfig, pakaiTanggal: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>{signatureConfig.pakaiTanggal !== false ? '📅 Pakai Tanggal Otomatis' : 'Tanpa Tanggal'}</span>
                  </label>
                )}

                {/* Tombol Tukar Posisi Kiri ⇄ Kanan */}
                {signatureConfig.tampilkanTandaTangan && (
                  <button
                    type="button"
                    onClick={handleSwapSignatures}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                    title="Tukar posisi pihak penanda tangan kiri dan kanan"
                  >
                    <span>⇄ Tukar Kiri/Kanan</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => onTabChange('TANDA_TANGAN')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Atur Nama & Posisi Lengkap &rarr;</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-300 overflow-hidden">
              {docType === 'JURNAL_KELAS' ? (
                <PrintableJournalSheet
                  school={{ ...school, signatureConfig }}
                  classId={effectiveClassId}
                  className={selectedClassName}
                  journals={filteredJournals}
                  periodeText={getPeriodeLabel()}
                  paperSize={paperSize}
                  selectedMonth={selectedMonth}
                />
              ) : (
                <PrintableAttendanceSheet
                  school={{ ...school, signatureConfig }}
                  docType={docType}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  selectedClassId={isDocPerSekolah ? undefined : effectiveClassId}
                  className={isDocPerSekolah ? undefined : selectedClassName}
                  assignments={assignments}
                  teachers={yayasanTeachersForSchool}
                  attendances={attendances}
                  paperSize={paperSize}
                />
              )}
            </div>
          </div>

          {/* KELOLA & HAPUS REKAMAN JURNAL / PRESENSI LEMBAGA */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-rose-600" />
                  <span>Kelola &amp; Hapus Data Jurnal / Presensi Lembaga</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Perbaiki atau hapus rekaman yang salah input/duplikat oleh guru di {school.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDataManagement(!showDataManagement)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <span>{showDataManagement ? 'Tutup Panel Kelola' : 'Buka Panel Kelola Data'}</span>
                <span>{showDataManagement ? '▲' : '▼'}</span>
              </button>
            </div>

            {showDataManagement && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMgmtTab('JURNAL')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        mgmtTab === 'JURNAL' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Daftar Jurnal Pembelajaran ({filteredJournals.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMgmtTab('PRESENSI')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        mgmtTab === 'PRESENSI' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Daftar Presensi Guru ({attendances.length})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={mgmtSearch}
                    onChange={(e) => setMgmtSearch(e.target.value)}
                    placeholder="Cari guru, materi, atau tanggal..."
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white w-full sm:w-64 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {mgmtTab === 'JURNAL' ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Tanggal / Jam</th>
                          <th className="py-2.5 px-3">Kelas / Mapel</th>
                          <th className="py-2.5 px-3">Guru &amp; Materi</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredJournals
                          .filter((j) => {
                            if (!mgmtSearch.trim()) return true;
                            const q = mgmtSearch.toLowerCase();
                            return (
                              j.teacherName.toLowerCase().includes(q) ||
                              j.materi.toLowerCase().includes(q) ||
                              j.subjectName.toLowerCase().includes(q) ||
                              j.date.includes(q)
                            );
                          })
                          .map((j) => {
                            const cObj = classes.find((c) => c.id === j.classId);
                            return (
                              <tr key={j.id} className="hover:bg-slate-50/80 transition">
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900">{j.date}</div>
                                  <div className="text-[10px] text-slate-500">Jam Ke-{j.jamKe}</div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-800">{cObj?.name || 'Kelas'}</div>
                                  <div className="text-[10px] text-purple-700 font-bold">{j.subjectName}</div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{j.teacherName}</div>
                                  <div className="text-[11px] text-slate-600 line-clamp-1">{j.materi}</div>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    j.keterangan === 'Tuntas' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {j.keterangan}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteJournal(j.id, `${j.subjectName} - ${j.materi}`)}
                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                                    title="Hapus rekaman jurnal ini"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        {filteredJournals.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                              Tidak ada rekaman jurnal pada filter yang dipilih.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Tanggal / Waktu</th>
                          <th className="py-2.5 px-3">Guru</th>
                          <th className="py-2.5 px-3">Peran / Kegiatan</th>
                          <th className="py-2.5 px-3">Keterangan</th>
                          <th className="py-2.5 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendances
                          .filter((a) => {
                            if (!mgmtSearch.trim()) return true;
                            const q = mgmtSearch.toLowerCase();
                            return (
                              a.teacherName.toLowerCase().includes(q) ||
                              (a.namaKegiatan && a.namaKegiatan.toLowerCase().includes(q)) ||
                              (a.keterangan && a.keterangan.toLowerCase().includes(q)) ||
                              a.date.includes(q)
                            );
                          })
                          .map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{a.date}</div>
                                <div className="text-[10px] text-slate-500 font-mono font-semibold">
                                  {a.timeRangeFormatted || `${a.jamMasuk}-${a.jamKeluar}`}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{a.teacherName}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  {a.namaKegiatan || a.roleUsed}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-[11px] text-slate-600 line-clamp-1">{a.keterangan || '-'}</div>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttendance(a.id, `${a.teacherName} (${a.date})`)}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                                  title="Hapus rekaman presensi ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        {attendances.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                              Tidak ada rekaman presensi di sekolah ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENGATURAN TANDA TANGAN DOKUMEN CETAK */}
      {activeTab === 'TANDA_TANGAN' && (
        <form onSubmit={handleSaveSignatureConfig} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-blue-700" />
              Pengaturan Tanda Tangan Dokumen Cetak
            </h2>
            <p className="text-xs text-slate-500">
              Admin sekolah dapat mengatur siapa saja yang bertanda tangan, atau memilih mencetak dokumen tanpa tanda tangan.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm text-slate-900 block">
                Lembar Tanda Tangan di Dokumen
              </span>
              <span className="text-xs text-slate-500">
                Aktifkan jika dokumen ditujukan untuk pengesahan resmi, nonaktifkan jika untuk rekap data mentah.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={signatureConfig.tampilkanTandaTangan}
                onChange={(e) =>
                  setSignatureConfig({ ...signatureConfig, tampilkanTandaTangan: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {signatureConfig.tampilkanTandaTangan && (
            <>
              {/* PENGATURAN TITIMANGSA & TANGGAL OTOMATIS */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 pb-2.5">
                  <div>
                    <h3 className="font-extrabold text-blue-950 text-sm flex items-center gap-1.5">
                      <span>📅 Pengaturan Tanggal Dokumen Otomatis</span>
                    </h3>
                    <p className="text-[11px] text-blue-800">
                      Admin dapat memilih apakah lembar pengesahan menampilkan tanggal otomatis atau dicetak tanpa tanggal.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs bg-white px-3 py-1.5 rounded-xl border border-blue-300 text-blue-950 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={signatureConfig.pakaiTanggal !== false}
                      onChange={(e) =>
                        setSignatureConfig({ ...signatureConfig, pakaiTanggal: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>{signatureConfig.pakaiTanggal !== false ? 'Gunakan Tanggal Otomatis (Aktif)' : 'Cetak Tanpa Tanggal'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Kota / Wilayah Titimangsa:
                    </label>
                    <input
                      type="text"
                      value={signatureConfig.lokasiKota || 'Riau'}
                      onChange={(e) =>
                        setSignatureConfig({ ...signatureConfig, lokasiKota: e.target.value })
                      }
                      placeholder="Contoh: Riau / Banjarmasin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Ditampilkan pada teks: "Disahkan di [Kota], [Tanggal]"
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Tanggal Khusus / Manual (Opsional):
                    </label>
                    <input
                      type="text"
                      value={signatureConfig.tanggalManual || ''}
                      onChange={(e) =>
                        setSignatureConfig({ ...signatureConfig, tanggalManual: e.target.value })
                      }
                      placeholder="Kosongkan untuk otomatis tanggal hari ini"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Jika kosong, sistem otomatis mencetak tanggal hari ini.
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTION BAR: TUKAR POSISI KIRI ⇄ KANAN */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/70 p-3 rounded-2xl border border-amber-200 text-xs">
                <div>
                  <span className="font-bold text-amber-950 block">Atur Penanda Tangan Manual:</span>
                  <span className="text-[11px] text-amber-800">
                    Ubah manual siapa di sebelah kiri dan siapa di sebelah kanan, atau gunakan tombol tukar posisi.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSwapSignatures}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                >
                  <span>⇄ Tukar Posisi (Kiri ⇄ Kanan)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* PIHAK 1 (KIRI) */}
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-sm text-blue-900">
                      Pihak Penanda Tangan 1 (Kiri)
                    </span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={signatureConfig.pihak1Aktif}
                      onChange={(e) =>
                        setSignatureConfig({ ...signatureConfig, pihak1Aktif: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Aktifkan</span>
                  </label>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teks Pengantar</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak1Label}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak1Label: e.target.value })
                    }
                    placeholder="Mengetahui,"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jabatan Pihak 1</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak1Jabatan}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak1Jabatan: e.target.value })
                    }
                    placeholder="Kepala Sekolah"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak1Nama}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak1Nama: e.target.value })
                    }
                    placeholder="Nama Kepala Sekolah"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP (Opsional)</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak1Nip || ''}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak1Nip: e.target.value })
                    }
                    placeholder="19750814..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
              </div>

              {/* PIHAK 2 (KANAN) */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-sm text-blue-900">
                    Pihak Penanda Tangan 2 (Kanan)
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={signatureConfig.pihak2Aktif}
                      onChange={(e) =>
                        setSignatureConfig({ ...signatureConfig, pihak2Aktif: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Aktifkan</span>
                  </label>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teks Pengantar Titimangsa</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak2Label}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak2Label: e.target.value })
                    }
                    placeholder="Disahkan di Riau,"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jabatan Pihak 2</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak2Jabatan}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak2Jabatan: e.target.value })
                    }
                    placeholder="Waka Kurikulum / Wali Kelas / Guru Piket"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak2Nama}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak2Nama: e.target.value })
                    }
                    placeholder="Nama Waka atau Wali Kelas"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP (Opsional)</label>
                  <input
                    type="text"
                    value={signatureConfig.pihak2Nip || ''}
                    onChange={(e) =>
                      setSignatureConfig({ ...signatureConfig, pihak2Nip: e.target.value })
                    }
                    placeholder="19820412..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          </>
        )}

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl shadow transition flex items-center gap-2 cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" /> Simpan Pengaturan Tanda Tangan
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: PENUGASAN & PERAN GURU */}
      {activeTab === 'PERAN_GURU' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">
              Penugasan Peran Guru di {school.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Khusus jenjang SD: Guru dapat memegang lebih dari satu peran (Guru Bidang Studi, Guru Bantu, Guru Diniyah, Kokurikuler, Ekskul).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {yayasanTeachersForSchool.map((teacher) => {
              const asg = assignments.find((a) => a.teacherId === teacher.id);
              const currentRoles = asg?.roles || [];
              return (
                <div
                  key={teacher.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {teacher.photoUrl ? (
                        <img
                          src={teacher.photoUrl}
                          alt={teacher.name}
                          className="w-11 h-11 rounded-2xl object-cover border"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center">
                          {teacher.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{teacher.name}</h3>
                        <p className="text-xs text-slate-500">
                          NIP: {teacher.nip || '-'} &bull; @{teacher.username}
                        </p>
                      </div>
                    </div>
                    {asg && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(asg.id, teacher.name)}
                        className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl cursor-pointer transition text-xs flex items-center gap-1 font-semibold shrink-0"
                        title="Hapus Penugasan Guru dari Lembaga ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <label className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-xl hover:bg-white transition">
                      <input
                        type="checkbox"
                        checked={currentRoles.includes('GURU_BIDANG_STUDI')}
                        onChange={() => handleToggleTeacherRole(teacher.id, 'GURU_BIDANG_STUDI')}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-blue-900">Guru Bidang Studi</span>
                        <span className="text-[10px] text-slate-500 block">
                          Mengisi Jurnal Kelas &amp; Absensi (Per-Kelas)
                        </span>
                      </div>
                    </label>

                    {school.jenjang === 'SD' && (
                      <>
                        <label className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-xl hover:bg-white transition">
                          <input
                            type="checkbox"
                            checked={currentRoles.includes('GURU_BANTU')}
                            onChange={() => handleToggleTeacherRole(teacher.id, 'GURU_BANTU')}
                            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-teal-900">Guru Bantu</span>
                            <span className="text-[10px] text-slate-500 block">
                              Mengisi Absensi Hadir (Per-Kelas)
                            </span>
                          </div>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-xl hover:bg-white transition">
                          <input
                            type="checkbox"
                            checked={currentRoles.includes('GURU_DINIYAH')}
                            onChange={() => handleToggleTeacherRole(teacher.id, 'GURU_DINIYAH')}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-indigo-900">Guru Diniyah</span>
                            <span className="text-[10px] text-slate-500 block">
                              Mengisi Absensi Hadir (Per-Kelas)
                            </span>
                          </div>
                        </label>
                      </>
                    )}

                    {/* KOORDINATOR KOKURIKULER (HANYA PERSEKOLAH) */}
                    <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentRoles.includes('KOORDINATOR_KOKURIKULER')}
                          onChange={() => handleToggleTeacherRole(teacher.id, 'KOORDINATOR_KOKURIKULER')}
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-purple-900 flex items-center gap-1.5">
                            <span>Koordinator Kokurikuler (Projek P5)</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-purple-200 text-purple-900 font-bold rounded-full">Persekolah</span>
                          </span>
                          <span className="text-[10px] text-purple-700 block">
                            Berlaku tingkat persekolah (seluruh sekolah)
                          </span>
                        </div>
                      </label>
                      {currentRoles.includes('KOORDINATOR_KOKURIKULER') && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-bold text-purple-800 mb-0.5">
                            Tema Projek Kokurikuler:
                          </label>
                          <input
                            type="text"
                            placeholder="cth: Projek P5 - Tema Kearifan Lokal..."
                            value={asg?.namaKokurikuler || ''}
                            onChange={(e) => handleUpdateKokurikulerName(teacher.id, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-purple-950 font-medium focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* PEMBINA EKSTRAKURIKULER (HANYA PERSEKOLAH) */}
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentRoles.includes('PEMBINA_EKSTRAKURIKULER')}
                          onChange={() => handleToggleTeacherRole(teacher.id, 'PEMBINA_EKSTRAKURIKULER')}
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5">
                            <span>Pembina Ekstrakurikuler</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-900 font-bold rounded-full">Persekolah</span>
                          </span>
                          <span className="text-[10px] text-amber-700 block">
                            Berlaku tingkat persekolah (seluruh sekolah)
                          </span>
                        </div>
                      </label>
                      {currentRoles.includes('PEMBINA_EKSTRAKURIKULER') && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                            Nama Ekstrakurikuler yang Dibina:
                          </label>
                          <input
                            type="text"
                            placeholder="cth: Pramuka, Tahfidz Club, PMR, Futsal..."
                            value={asg?.namaEkstrakurikuler || ''}
                            onChange={(e) => handleUpdateEkstrakurikulerName(teacher.id, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-amber-950 font-medium focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: URUTAN JABATAN DOKUMEN CETAK */}
      {activeTab === 'URUTAN_JABATAN' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-3xl p-4 text-xs text-blue-900">
            <h3 className="font-bold text-sm mb-1">Standarisasi Urutan Hierarki Dokumen Cetak</h3>
            <p>
              Urutan baris nama pada lembar dokumen: 1. Kepala Sekolah &bull; 2. Waka Kurikulum &bull; 3. Waka Kesiswaan &bull; 4. Wali Kelas &bull; 5. Guru Kelas &bull; 6. Guru Mata Pelajaran / Bantu / Diniyah.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">Urutan</th>
                    <th className="py-3 px-4">Nama Guru / Pejabat</th>
                    <th className="py-3 px-4">Struktur Jabatan</th>
                    <th className="py-3 px-4">Keterangan Label Dokumen</th>
                    <th className="py-3 px-4 text-right">Ubah Posisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments
                    .sort((a, b) => a.urutan - b.urutan)
                    .map((asg, index) => {
                      const user = allUsers.find((u) => u.id === asg.teacherId);
                      return (
                        <tr key={asg.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-center font-black text-slate-800 text-sm">
                            #{asg.urutan}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{user?.name || 'Guru'}</div>
                            <div className="text-[10px] text-slate-500">NIP: {user?.nip || '-'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={asg.jabatan}
                              onChange={(e) =>
                                handleUpdateAssignmentJabatan(
                                  asg.teacherId,
                                  e.target.value as HierarchyJabatan,
                                  asg.customJabatan || '',
                                  asg.urutan
                                )
                              }
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                            >
                              <option value="KEPALA_SEKOLAH">1. Kepala Sekolah</option>
                              <option value="WAKA_KURIKULUM">2. Waka Kurikulum</option>
                              <option value="WAKA_KESISWAAN">3. Waka Kesiswaan</option>
                              <option value="KOORDINATOR_KOKURIKULER">4. Koordinator Kokurikuler</option>
                              <option value="PEMBINA_EKSTRAKURIKULER">5. Pembina Ekstrakurikuler</option>
                              <option value="WALI_KELAS">6. Wali Kelas</option>
                              <option value="GURU_KELAS">7. Guru Kelas</option>
                              <option value="GURU_BIDANG_STUDI">Guru Bidang Studi</option>
                              {school.jenjang === 'SD' && (
                                <>
                                  <option value="GURU_BANTU">Guru Bantu</option>
                                  <option value="GURU_DINIYAH">Guru Diniyah</option>
                                </>
                              )}
                              <option value="GURU">Guru Lainnya</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={asg.customJabatan || ''}
                              placeholder="Misal: Wali Kelas 1A / Guru PAI"
                              onChange={(e) =>
                                handleUpdateAssignmentJabatan(
                                  asg.teacherId,
                                  asg.jabatan,
                                  e.target.value,
                                  asg.urutan
                                )
                              }
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                            />
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              disabled={index === 0}
                              onClick={() => moveUrutan(index, 'UP')}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg text-xs font-bold cursor-pointer"
                              title="Pindahkan ke atas"
                            >
                              &uarr;
                            </button>
                            <button
                              disabled={index === assignments.length - 1}
                              onClick={() => moveUrutan(index, 'DOWN')}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg text-xs font-bold cursor-pointer"
                              title="Pindahkan ke bawah"
                            >
                              &darr;
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAssignment(asg.id, user?.name || 'Guru')}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition inline-flex items-center align-middle"
                              title="Hapus Penugasan dari Lembaga ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MATA PELAJARAN & KELAS */}
      {activeTab === 'MAPEL_KELAS' && (
        <div className="space-y-6">
          {/* Section Kelas */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Daftar Kelas di {school.name}</h3>
                <p className="text-xs text-slate-500">
                  Data kelas untuk pengelompokan jurnal dan presensi (dibuat per-kelas).
                </p>
              </div>
              <button
                onClick={() => setShowClassModal(true)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Kelas
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between"
                >
                  <span className="font-bold text-slate-900">{cls.name}</span>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500">Tingkat {cls.tingkat}</span>
                    <button
                      onClick={() => handleDeleteClass(cls.id, cls.name)}
                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section Mata Pelajaran */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Mata Pelajaran & Guru Pengampu</h3>
                <p className="text-xs text-slate-500">
                  Admin sekolah memilih guru pengampu dari guru yayasan yang ditugaskan ke lembaga ini.
                </p>
              </div>
              <button
                onClick={() => setShowSubjectModal(true)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Mata Pelajaran
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects.map((subj) => {
                const teacher = allUsers.find((u) => u.id === subj.teacherId);
                return (
                  <div
                    key={subj.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {subj.code || 'MAPEL'}
                        </span>
                        <button
                          onClick={() => handleDeleteSubject(subj.id, subj.name)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Mata Pelajaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{subj.name}</h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 text-xs">
                      <div className="text-[11px] text-slate-500">Guru Pengampu:</div>
                      <div className="font-semibold text-blue-900">
                        {teacher ? teacher.name : 'Belum Ditentukan'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PROFIL LEMBAGA, LOGO & AKREDITASI */}
      {activeTab === 'PROFIL' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Profil Lembaga, Logo Sekolah & Akreditasi
            </h2>
            <p className="text-xs text-slate-500">
              Data resmi yang dicantumkan pada Kop Surat dokumen cetak rekap.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2 bg-slate-50 p-4.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border border-slate-300 bg-white p-1.5 flex items-center justify-center shrink-0">
                {school.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt="Logo Sekolah"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold">Tanpa Logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="block font-bold text-slate-800">Logo Resmi Sekolah / Lembaga</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3.5 py-2 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Sekolah</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Lembaga</label>
              <input
                type="text"
                required
                value={school.name}
                onChange={(e) => setSchool({ ...school, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">NPSN</label>
              <input
                type="text"
                required
                value={school.npsn}
                onChange={(e) => setSchool({ ...school, npsn: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Jenjang Pendidikan</label>
              <select
                value={school.jenjang || 'SD'}
                onChange={(e) => setSchool({ ...school, jenjang: e.target.value as JenjangSekolah })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-blue-900"
              >
                <option value="PAUD">PAUD (Pendidikan Anak Usia Dini)</option>
                <option value="TK">TK / RA (Taman Kanak-Kanak)</option>
                <option value="SD">SD (Sekolah Dasar)</option>
                <option value="MI">MI (Madrasah Ibtidaiyah)</option>
                <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                <option value="MTs">MTs (Madrasah Tsanawiyah)</option>
                <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                <option value="MA">MA (Madrasah Aliyah)</option>
                <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                <option value="DINIYAH">Diniyah</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status Akreditasi</label>
              <select
                value={school.akreditasi}
                onChange={(e) => setSchool({ ...school, akreditasi: e.target.value as Akreditasi })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-blue-900"
              >
                <option value="A (Unggul)">A (Unggul)</option>
                <option value="B (Baik)">B (Baik)</option>
                <option value="C (Cukup)">C (Cukup)</option>
                <option value="Belum Terakreditasi">Belum Terakreditasi</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran Aktif</label>
              <input
                type="text"
                value={school.tahunAjaranAktif}
                onChange={(e) => setSchool({ ...school, tahunAjaranAktif: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                required
                value={school.kepalaSekolah}
                onChange={(e) => setSchool({ ...school, kepalaSekolah: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                value={school.nipKepalaSekolah || ''}
                onChange={(e) => setSchool({ ...school, nipKepalaSekolah: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl shadow transition flex items-center gap-2 cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" /> Simpan Profil Sekolah
            </button>
          </div>
        </form>
      )}

      {/* MODAL TAMBAH KELAS */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-blue-800 text-white p-4.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Tambah Kelas Baru</h3>
              <button
                onClick={() => setShowClassModal(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddClass} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kelas</label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Contoh: Kelas 1 Abu Bakar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tingkat Kelas (Angka)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={newClassTingkat}
                  onChange={(e) => setNewClassTingkat(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-3.5 py-2 border rounded-xl text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-blue-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH MAPEL */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-blue-800 text-white p-4.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Tambah Mata Pelajaran</h3>
              <button
                onClick={() => setShowSubjectModal(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddSubject} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="Contoh: Fiqih Ibadah / Matematika"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kode Pelajaran (Opsional)</label>
                <input
                  type="text"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  placeholder="FQH / MTK"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Guru Pengampu (Dari Guru Yayasan):
                </label>
                <select
                  required
                  value={subjectForm.teacherId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, teacherId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="">-- Pilih Guru --</option>
                  {yayasanTeachersForSchool.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (@{t.username})
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-3.5 py-2 border rounded-xl text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-blue-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
