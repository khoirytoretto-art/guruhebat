import React, { useState, useEffect } from 'react';
import {
  User,
  School,
  TeacherRoleType,
  SchoolClass,
  Subject,
  ClassJournalEntry,
  TeacherAttendanceEntry,
  JenisKegiatan,
  KeteranganJurnal,
  PaperSize,
  DokumenCetakType,
} from '../../types';
import { StorageService, normalizeDateString, isClassMatch, canonicalizeSchoolId, canonicalizeClassId } from '../../utils/storage';
import { calculateDistance, getCurrentLocation } from '../../utils/location';
import { PrintableJournalSheet } from '../print/PrintableJournalSheet';
import { PrintableAttendanceSheet } from '../print/PrintableAttendanceSheet';
import { exportToPdfClient, printDocumentUniversal } from '../../utils/pdfGenerator';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  School as SchoolIcon,
  BookOpen,
  Clock,
  CheckCircle2,
  Save,
  Printer,
  Download,
  Trash2,
  Sparkles,
  Award,
  ArrowLeft,
  ChevronRight,
  UserCheck,
  Building2,
  Calendar,
  Layers,
  RotateCcw,
  FileText,
  AlertCircle,
  MapPin,
} from 'lucide-react';

interface GuruDashboardProps {
  currentUser: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onDataChanged: () => void;
}

export const GuruDashboard: React.FC<GuruDashboardProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  onDataChanged,
}) => {
  const allSchools = StorageService.getSchools();
  // Validasi penugasan guru & kepala sekolah mengajar:
  // Tampilkan semua sekolah yang sah ditugaskan (assignedSchoolIds, schoolId, atau penugasan tugas/mapel)
  const allTeacherAssignments = StorageService.getAssignments().filter(
    (a) => a.teacherId === currentUser.id
  );
  const allTeacherSubjects = StorageService.getSubjects().filter(
    (s) => s.teacherId === currentUser.id
  );

  const schoolIdSet = new Set<string>();
  if (currentUser.schoolId) schoolIdSet.add(currentUser.schoolId);
  if (Array.isArray(currentUser.assignedSchoolIds)) {
    currentUser.assignedSchoolIds.forEach((sid) => {
      if (sid) schoolIdSet.add(sid);
    });
  }
  allTeacherAssignments.forEach((a) => {
    if (a.schoolId) schoolIdSet.add(a.schoolId);
  });
  allTeacherSubjects.forEach((s) => {
    if (s.schoolId) schoolIdSet.add(s.schoolId);
  });

  const validSchoolIds = Array.from(schoolIdSet);
  const assignedSchools = allSchools.filter((s) => validSchoolIds.includes(s.id));
  const primarySchool = allSchools.find((s) => s.id === currentUser.schoolId);
  const defaultSchool = primarySchool || (assignedSchools.length > 0 ? assignedSchools[0] : null);

  // STEP WIZARD:
  // Step 1: PILIH SEKOLAH
  // Step 2: PILIH TUGAS (Guru Bidang Studi, Guru Bantu, Guru Diniyah, dll) Sesuai Inputan Admin
  // Step 3: FORM INPUTAN & MENU SESUAI TUGAS TERPILIH
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(defaultSchool);
  const [selectedRole, setSelectedRole] = useState<TeacherRoleType>('GURU_BIDANG_STUDI');

  // Active sub-tab inside Step 3 (Khusus untuk tugas yang dipilih saat ini)
  // 'ABSEN' = Absen KBM / Absen Bantu / Absen Diniyah / Presensi Kokurikuler / Presensi Ekskul
  // 'JURNAL' = Hanya untuk Guru Bidang Studi
  // 'RIWAYAT_CETAK' = Riwayat presensi dan cetak dokumen rekap
  const [activeDutyTab, setActiveDutyTab] = useState<'ABSEN' | 'JURNAL' | 'RIWAYAT_CETAK'>('ABSEN');

  // School Specific Data
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>(() => {
    return defaultSchool ? StorageService.getClasses(defaultSchool.id) : [];
  });
  const [schoolSubjects, setSchoolSubjects] = useState<Subject[]>(() => {
    return defaultSchool ? StorageService.getSubjects(defaultSchool.id, currentUser.id) : [];
  });
  const [teacherAssignment, setTeacherAssignment] = useState<any>(() => {
    if (!defaultSchool) return null;
    const asgs = StorageService.getAssignmentsBySchool(defaultSchool.id);
    return asgs.find((a) => a.teacherId === currentUser.id) || null;
  });

  // NOTIFICATION & MODALS
  const [notification, setNotification] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>('F4');
  const [isSaving, setIsSaving] = useState(false);

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

  // FORM ABSEN STATE (Guru Bidang Studi, Guru Bantu, Guru Diniyah - PER-KELAS)
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [absenDate, setAbsenDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [absenJamMasuk, setAbsenJamMasuk] = useState<string>('07:30');
  const [absenJamKeluar, setAbsenJamKeluar] = useState<string>('09:00');
  const [absenKeterangan, setAbsenKeterangan] = useState<string>('');

  // FORM JURNAL STATE (KHUSUS GURU BIDANG STUDI - PER-KELAS)
  const [journalJamKe, setJournalJamKe] = useState<number>(1);
  const [journalSubjectId, setJournalSubjectId] = useState<string>('');
  const [journalMateri, setJournalMateri] = useState<string>('');
  const [journalJenisKegiatan, setJournalJenisKegiatan] = useState<JenisKegiatan>('KBM');
  const [journalKeterangan, setJournalKeterangan] = useState<KeteranganJurnal>('Tuntas');
  const [journalDate, setJournalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [journalCatatan, setJournalCatatan] = useState<string>('');
  const [bantuSubjectCustom, setBantuSubjectCustom] = useState<string>('Pendampingan Belajar');
  const [diniyahMateriCustom, setDiniyahMateriCustom] = useState<string>('Tahsin & Bimbingan Ibadah');

  // FORM KOKURIKULER (P5) - HANYA PER-SEKOLAH
  const [kokuDate, setKokuDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [kokuJamMasuk, setKokuJamMasuk] = useState<string>('13:00');
  const [kokuJamKeluar, setKokuJamKeluar] = useState<string>('15:00');
  const [kokuNama, setKokuNama] = useState<string>('');
  const [kokuMateri, setKokuMateri] = useState<string>('');
  const [kokuPeserta, setKokuPeserta] = useState<string>('');

  // FORM EKSTRAKURIKULER - HANYA PER-SEKOLAH
  const [ekskulDate, setEkskulDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ekskulJamMasuk, setEkskulJamMasuk] = useState<string>('15:30');
  const [ekskulJamKeluar, setEkskulJamKeluar] = useState<string>('17:00');
  const [ekskulNama, setEkskulNama] = useState<string>('');
  const [ekskulMateri, setEkskulMateri] = useState<string>('');
  const [ekskulPeserta, setEkskulPeserta] = useState<string>('');

  // CETAK REKAP STATE
  const [cetakDocType, setCetakDocType] = useState<DokumenCetakType>('DAFTAR_HADIR_GURU');
  const [cetakMonth, setCetakMonth] = useState<number>(new Date().getMonth() + 1);
  const [cetakYear, setCetakYear] = useState<number>(new Date().getFullYear());
  const [cetakClassId, setCetakClassId] = useState<string>('');

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Sync activeTab from navigation
  useEffect(() => {
    if (activeTab === 'RIWAYAT_CETAK') {
      if (selectedSchool) {
        setCurrentStep(3);
        setActiveDutyTab('RIWAYAT_CETAK');
      } else {
        setCurrentStep(1);
      }
    } else if (activeTab === 'INPUT_TUGAS') {
      // Pertama kali yang muncul adalah PILIH SEKOLAH
      setCurrentStep(1);
      setActiveDutyTab('ABSEN');
    }
  }, [activeTab]);

  // Load school classes & assignments when selectedSchool changes
  useEffect(() => {
    if (selectedSchool) {
      const cls = StorageService.getClasses(selectedSchool.id);
      // HANYA pelajaran masing-masing guru yang telah diinputkan admin masing-masing
      const mySubjs = StorageService.getSubjects(selectedSchool.id, currentUser.id);
      const asgs = StorageService.getAssignmentsBySchool(selectedSchool.id);
      const myAsg = asgs.find((a) => a.teacherId === currentUser.id);

      setSchoolClasses(cls);
      setSchoolSubjects(mySubjs);
      setTeacherAssignment(myAsg);

      if (cls.length > 0) {
        // Cari kelas aktif yang diajar oleh guru ini
        const taughtClassIds = Array.from(new Set(mySubjs.flatMap((s) => s.classIds || [])));
        const primaryClassId = taughtClassIds.length > 0 && cls.some((c) => c.id === taughtClassIds[0])
          ? taughtClassIds[0]
          : cls[0].id;

        const isSelectedValid = cls.some((c) => c.id === selectedClassId);
        if (!isSelectedValid) {
          setSelectedClassId(primaryClassId);
        }
        const isCetakValid = cls.some((c) => c.id === cetakClassId);
        if (!isCetakValid) {
          setCetakClassId(primaryClassId);
        }
      } else {
        setSelectedClassId('');
        setCetakClassId('');
      }

      if (mySubjs.length > 0) {
        setJournalSubjectId(mySubjs[0].id);
      } else {
        setJournalSubjectId('');
      }

      if (myAsg) {
        if (myAsg.namaKokurikuler) setKokuNama(myAsg.namaKokurikuler);
        if (myAsg.namaEkstrakurikuler) setEkskulNama(myAsg.namaEkstrakurikuler);
      }
    }
  }, [selectedSchool?.id]);

  useEffect(() => {
    if (selectedSchool?.lockAttendanceTodayOnly) {
      const today = new Date().toISOString().split('T')[0];
      setAbsenDate(today);
      setKokuDate(today);
      setEkskulDate(today);
    }
  }, [selectedSchool?.id, selectedSchool?.lockAttendanceTodayOnly]);

  // Roles assigned by admin for this teacher at selected school
  const getAvailableRolesForSchool = (): TeacherRoleType[] => {
    if (!selectedSchool) return [];
    const asgs = StorageService.getAssignmentsBySchool(selectedSchool.id);
    const myAsg = asgs.find((a) => a.teacherId === currentUser.id);

    // Ambil peran resmi yang diberikan oleh admin untuk guru ini di sekolah ini
    let rawRoles: TeacherRoleType[] = [];
    if (myAsg) {
      if (Array.isArray(myAsg.roles) && myAsg.roles.length > 0) {
        rawRoles = myAsg.roles as TeacherRoleType[];
      } else {
        // Admin telah menyimpan penugasan dan belum mencentang peran apapun
        rawRoles = [];
      }
    } else {
      // Jika admin sekolah belum pernah membuka/mengatur penugasan di sekolah ini,
      // defaultkan ke Guru Bidang Studi standar (BUKAN Ekstra/Kokurikuler/Bantu/Diniyah)
      rawRoles = ['GURU_BIDANG_STUDI'];
    }

    // Filter ketat:
    // 1. GURU_BANTU & GURU_DINIYAH hanya boleh muncul jika jenjang SD dan resmi dicentang admin
    // 2. KOORDINATOR_KOKURIKULER hanya muncul jika resmi dicentang admin
    // 3. PEMBINA_EKSTRAKURIKULER hanya muncul jika resmi dicentang admin
    return rawRoles.filter((r) => {
      if (selectedSchool.jenjang !== 'SD' && (r === 'GURU_BANTU' || r === 'GURU_DINIYAH')) {
        return false;
      }
      return true;
    });
  };

  const availableRoles = getAvailableRolesForSchool();

  // Pastikan selectedRole selalu valid dan sesuai dengan peran yang ditugaskan
  useEffect(() => {
    if (selectedSchool) {
      const avail = getAvailableRolesForSchool();
      if (avail.length > 0 && !avail.includes(selectedRole)) {
        setSelectedRole(avail[0]);
      }
    }
  }, [selectedSchool?.id]);

  // Handle select school -> proceed to step 2 (Pilih Tugas)
  const handleSelectSchool = (school: School) => {
    setSelectedSchool(school);
    const cls = StorageService.getClasses(school.id);
    const mySubjs = StorageService.getSubjects(school.id, currentUser.id);
    setSchoolClasses(cls);
    setSchoolSubjects(mySubjs);
    const taughtClassIds = Array.from(new Set(mySubjs.flatMap((s) => s.classIds || [])));
    const activeClassId = taughtClassIds.length > 0 && cls.some((c) => c.id === taughtClassIds[0])
      ? taughtClassIds[0]
      : (cls.length > 0 ? cls[0].id : '');
    setSelectedClassId(activeClassId);
    setCetakClassId(activeClassId);
    if (mySubjs.length > 0) {
      setJournalSubjectId(mySubjs[0].id);
    } else {
      setJournalSubjectId('');
    }

    const asgs = StorageService.getAssignmentsBySchool(school.id);
    const myAsg = asgs.find((a) => a.teacherId === currentUser.id);
    let rawRoles: TeacherRoleType[] = [];
    if (myAsg) {
      if (Array.isArray(myAsg.roles) && myAsg.roles.length > 0) {
        rawRoles = myAsg.roles as TeacherRoleType[];
      } else {
        rawRoles = [];
      }
    } else {
      rawRoles = ['GURU_BIDANG_STUDI'];
    }
    
    rawRoles = rawRoles.filter((r) => {
      if (school.jenjang !== 'SD' && (r === 'GURU_BANTU' || r === 'GURU_DINIYAH')) {
        return false;
      }
      return true;
    });

    if (rawRoles.length > 0) {
      setSelectedRole(rawRoles[0]);
    }
    setCurrentStep(2);
  };

  // Handle select role -> proceed to step 3 (Form Inputan & Menu Tugas Tersebut)
  const handleSelectRole = (role: TeacherRoleType) => {
    setSelectedRole(role);
    setActiveDutyTab('ABSEN');
    // Set default cetak doc type based on selected role
    if (role === 'GURU_BIDANG_STUDI') {
      setCetakDocType('DAFTAR_HADIR_GURU');
    } else if (role === 'GURU_BANTU') {
      setCetakDocType('DAFTAR_HADIR_GURU_BANTU');
    } else if (role === 'GURU_DINIYAH') {
      setCetakDocType('DAFTAR_HADIR_GURU_DINIYAH');
    } else if (role === 'KOORDINATOR_KOKURIKULER') {
      setCetakDocType('DAFTAR_HADIR_KOKURIKULER');
    } else if (role === 'PEMBINA_EKSTRAKURIKULER') {
      setCetakDocType('DAFTAR_HADIR_EKSTRAKURIKULER');
    }
    setCurrentStep(3);
  };

  // SUBMIT FORM ABSEN PER-KELAS (GURU BIDANG STUDI, GURU BANTU, GURU DINIYAH)
  const handleSubmitAbsenKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) {
      showToast('Harap pilih sekolah terlebih dahulu.');
      return;
    }
    if (!selectedClassId) {
      showToast('Harap pilih kelas pembelajaran (wajib per-kelas).');
      return;
    }
    if (!absenJamMasuk || !absenJamKeluar) {
      showToast('Harap isi jam masuk dan jam keluar.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedSchool?.lockAttendanceTodayOnly && absenDate !== todayStr) {
      showToast(`GAGAL BOSS! Tanggal absen dikunci untuk hari ini (${todayStr}).`);
      return;
    }

    // Validasi absen ganda pada tanggal, kelas, dan PERAN yang sama
    const existingAtt = StorageService.getAttendances().find((a) => {
      if (a.teacherId !== currentUser.id) return false;
      if (canonicalizeSchoolId(a.schoolId) !== canonicalizeSchoolId(selectedSchool?.id)) return false;
      if (canonicalizeClassId(a.schoolId, a.classId) !== canonicalizeClassId(selectedSchool?.id, selectedClassId)) return false;
      if (a.roleUsed !== selectedRole) return false; // Peran harus sama
      const aDateNorm = a.date ? a.date.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      const targetDateNorm = absenDate ? absenDate.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      return aDateNorm === targetDateNorm;
    });

    if (existingAtt) {
      showToast(`Sudah absen sebagai ${getRoleLabel(selectedRole)} di kelas ini!`);
      return;
    }

    // VALIDASI RADIUS 50 METER (GEOFENCING)
    if (selectedSchool?.enableGeofencing && selectedSchool.latitude && selectedSchool.longitude) {
      setIsSaving(true);
      try {
        const pos = await getCurrentLocation();
        const dist = calculateDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          selectedSchool.latitude, 
          selectedSchool.longitude
        );

        const radius = selectedSchool.geofencingRadius || 50;
        if (dist > radius) {
          showToast(`GAGAL BOSS! Anda tidak dianggap Sekolah, Karena tidak berada dalam lokasi Sekolah!`);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        showToast(`Gagal verifikasi lokasi: ${err.message}. Pastikan GPS aktif.`);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);
    try {
      let targetClass = schoolClasses.find((c) => c.id === selectedClassId);
    if (!targetClass && schoolClasses.length > 0) {
      targetClass = schoolClasses[0];
    }
    const finalClassId = targetClass ? targetClass.id : selectedClassId;
    const finalSchoolId = selectedSchool.id;
    const className = targetClass ? targetClass.name : 'Kelas';
    const timeRange = `${absenJamMasuk}-${absenJamKeluar}`;

    let defaultKet = `KBM ${className}`;
    if (selectedRole === 'GURU_BANTU') defaultKet = `Pendampingan ${className}`;
    if (selectedRole === 'GURU_DINIYAH') defaultKet = `Bimbingan Diniyah ${className}`;

    const newAttendance: TeacherAttendanceEntry = {
      id: `att-${Date.now()}`,
      schoolId: finalSchoolId,
      classId: finalClassId, // Wajib per-kelas
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      roleUsed: selectedRole,
      date: absenDate,
      jamMasuk: absenJamMasuk,
      jamKeluar: absenJamKeluar,
      timeRangeFormatted: timeRange,
      status: 'HADIR',
      keterangan: absenKeterangan || defaultKet,
      createdAt: new Date().toISOString(),
    };

    StorageService.addAttendance(newAttendance);
    // Otomatis sinkronkan filter cetak agar guru langsung melihat rekaman barunya di lembar cetak
    setCetakClassId(finalClassId);
    if (absenDate) {
      const parts = absenDate.split('-');
      if (parts.length === 3) {
        setCetakYear(parseInt(parts[0], 10));
        setCetakMonth(parseInt(parts[1], 10));
      }
    }
    showToast('Absen Berhasil Disimpan');
    setAbsenKeterangan('');
    onDataChanged();
    } finally {
      setIsSaving(false);
    }
  };

  // SUBMIT FORM JURNAL PEMBELAJARAN (GURU STUDI, GURU BANTU, GURU DINIYAH - PER-KELAS)
  const handleSubmitJurnalKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) {
      showToast('Harap pilih sekolah terlebih dahulu.');
      return;
    }
    if (!selectedClassId) {
      showToast('Harap pilih kelas pembelajaran (wajib per-kelas).');
      return;
    }

    // Untuk Guru Studi wajib ada mata pelajaran. Untuk Guru Bantu & Diniyah opsional/otomatis
    if (selectedRole === 'GURU_BIDANG_STUDI' && (!journalSubjectId || schoolSubjects.length === 0)) {
      showToast('belum ada tugas mengajar. Harap hubungi Admin Sekolah untuk menetapkan mata pelajaran Anda.');
      return;
    }

    // Validasi jurnal ganda pada tanggal, kelas, dan jam yang sama
    const existingJournal = StorageService.getJournals().find((j) => {
      if (j.teacherId !== currentUser.id) return false;
      if (canonicalizeSchoolId(j.schoolId) !== canonicalizeSchoolId(selectedSchool?.id)) return false;
      if (canonicalizeClassId(j.schoolId, j.classId) !== canonicalizeClassId(selectedSchool?.id, selectedClassId)) return false;
      if (Number(j.jamKe) === Number(journalJamKe)) {
        const jDateNorm = j.date ? j.date.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
        const targetDateNorm = journalDate ? journalDate.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
        return jDateNorm === targetDateNorm;
      }
      return false;
    });

    if (existingJournal) {
      showToast(`Jurnal untuk jam ke-${journalJamKe} di kelas ini sudah ada!`);
      return;
    }

    if (!journalMateri.trim()) {
      showToast('Harap isi materi / kompetensi yang diajarkan atau didampingi.');
      return;
    }

    // VALIDASI RADIUS 50 METER (GEOFENCING)
    if (selectedSchool?.enableGeofencing && selectedSchool.latitude && selectedSchool.longitude) {
      setIsSaving(true);
      try {
        const pos = await getCurrentLocation();
        const dist = calculateDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          selectedSchool.latitude, 
          selectedSchool.longitude
        );

        const radius = selectedSchool.geofencingRadius || 50;
        if (dist > radius) {
          showToast(`GAGAL BOSS! Anda tidak dianggap Sekolah, Karena tidak berada dalam lokasi Sekolah!`);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        showToast(`Gagal verifikasi lokasi: ${err.message}. Pastikan GPS aktif.`);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);
    try {
      let targetClass = schoolClasses.find((c) => c.id === selectedClassId);
    if (!targetClass && schoolClasses.length > 0) {
      targetClass = schoolClasses[0];
    }
    const finalClassId = targetClass ? targetClass.id : selectedClassId;
    const finalSchoolId = selectedSchool.id;
    const targetSubj = schoolSubjects.find((s) => s.id === journalSubjectId);

    let finalSubjectName = 'Pembelajaran';
    if (selectedRole === 'GURU_BIDANG_STUDI') {
      finalSubjectName = targetSubj ? targetSubj.name : 'Mata Pelajaran';
    } else if (selectedRole === 'GURU_BANTU') {
      finalSubjectName = targetSubj ? `Pendampingan ${targetSubj.name}` : (bantuSubjectCustom || 'Pendampingan Belajar');
    } else if (selectedRole === 'GURU_DINIYAH') {
      finalSubjectName = targetSubj ? targetSubj.name : (diniyahMateriCustom || 'Bimbingan Diniyah');
    }

    const newJournal: ClassJournalEntry = {
      id: `jrn-${Date.now()}`,
      schoolId: finalSchoolId,
      classId: finalClassId, // Wajib per-kelas
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      teacherRole: selectedRole,
      date: journalDate,
      jamKe: Number(journalJamKe),
      subjectId: journalSubjectId || `subj-${selectedRole.toLowerCase()}`,
      subjectName: finalSubjectName,
      materi: journalMateri,
      jenisKegiatan: journalJenisKegiatan,
      keterangan: journalKeterangan,
      catatan: journalCatatan,
      createdAt: new Date().toISOString(),
    };

    StorageService.addJournal(newJournal);
    // Otomatis sinkronkan filter cetak agar guru langsung melihat rekaman barunya di lembar cetak
    setCetakClassId(finalClassId);
    setCetakDocType('JURNAL_KELAS');
    if (journalDate) {
      const parts = journalDate.split('-');
      if (parts.length === 3) {
        setCetakYear(parseInt(parts[0], 10));
        setCetakMonth(parseInt(parts[1], 10));
      }
    }
    showToast(`Jurnal ${finalSubjectName} di ${targetClass?.name} berhasil disimpan!`);
    setJournalMateri('');
    setJournalCatatan('');
    onDataChanged();
    } finally {
      setIsSaving(false);
    }
  };

  // SUBMIT FORM KOKURIKULER (HANYA PER-SEKOLAH)
  const handleSubmitKokurikuler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) {
      showToast('Harap pilih sekolah terlebih dahulu.');
      return;
    }
    if (!kokuNama.trim()) {
      showToast('Harap isi nama kegiatan atau tema projek P5 kokurikuler.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedSchool?.lockAttendanceTodayOnly && kokuDate !== todayStr) {
      showToast(`GAGAL BOSS! Tanggal presensi dikunci untuk hari ini (${todayStr}).`);
      return;
    }

    // Cek duplikasi presensi kokurikuler pada tanggal yang sama
    const existingKoku = StorageService.getAttendances().find((a) => {
      if (a.teacherId !== currentUser.id) return false;
      if (canonicalizeSchoolId(a.schoolId) !== canonicalizeSchoolId(selectedSchool?.id)) return false;
      if (a.roleUsed !== 'KOORDINATOR_KOKURIKULER') return false;
      const aDateNorm = a.date ? a.date.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      const targetDateNorm = kokuDate ? kokuDate.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      return aDateNorm === targetDateNorm;
    });

    if (existingKoku) {
      showToast('Sudah absen sebagai Koordinator Kokurikuler hari ini!');
      return;
    }

    // VALIDASI RADIUS 50 METER (GEOFENCING)
    if (selectedSchool?.enableGeofencing && selectedSchool.latitude && selectedSchool.longitude) {
      setIsSaving(true);
      try {
        const pos = await getCurrentLocation();
        const dist = calculateDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          selectedSchool.latitude, 
          selectedSchool.longitude
        );

        const radius = selectedSchool.geofencingRadius || 50;
        if (dist > radius) {
          showToast(`GAGAL BOSS! Anda tidak dianggap Sekolah, Karena tidak berada dalam lokasi Sekolah!`);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        showToast(`Gagal verifikasi lokasi: ${err.message}`);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);
    try {
      const timeRange = `${kokuJamMasuk}-${kokuJamKeluar}`;
    const newAttendance: TeacherAttendanceEntry = {
      id: `att-koku-${Date.now()}`,
      schoolId: selectedSchool.id,
      classId: 'persekolah', // Khusus kokurikuler: tingkat persekolah
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      roleUsed: 'KOORDINATOR_KOKURIKULER',
      date: kokuDate,
      jamMasuk: kokuJamMasuk,
      jamKeluar: kokuJamKeluar,
      timeRangeFormatted: timeRange,
      status: 'HADIR',
      namaKegiatan: kokuNama,
      materiKegiatan: kokuMateri,
      jumlahPeserta: kokuPeserta,
      keterangan: `Projek Kokurikuler Persekolah: ${kokuNama}`,
      createdAt: new Date().toISOString(),
    };

    StorageService.addAttendance(newAttendance);
    showToast('Absen Berhasil');
    setKokuMateri('');
    onDataChanged();
    } finally {
      setIsSaving(false);
    }
  };

  // SUBMIT FORM EKSTRAKURIKULER (HANYA PER-SEKOLAH)
  const handleSubmitEkstrakurikuler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) {
      showToast('Harap pilih sekolah terlebih dahulu.');
      return;
    }
    if (!ekskulNama.trim()) {
      showToast('Harap isi nama kegiatan ekstrakurikuler.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedSchool?.lockAttendanceTodayOnly && ekskulDate !== todayStr) {
      showToast(`GAGAL BOSS! Tanggal presensi dikunci untuk hari ini (${todayStr}).`);
      return;
    }

    // Cek duplikasi presensi ekstrakurikuler pada tanggal yang sama
    const existingEkskul = StorageService.getAttendances().find((a) => {
      if (a.teacherId !== currentUser.id) return false;
      if (canonicalizeSchoolId(a.schoolId) !== canonicalizeSchoolId(selectedSchool?.id)) return false;
      if (a.roleUsed !== 'PEMBINA_EKSTRAKURIKULER') return false;
      if (a.namaKegiatan && a.namaKegiatan.trim().toLowerCase() !== ekskulNama.trim().toLowerCase()) return false;
      const aDateNorm = a.date ? a.date.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      const targetDateNorm = ekskulDate ? ekskulDate.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
      return aDateNorm === targetDateNorm;
    });

    if (existingEkskul) {
      showToast(`Sudah absen Pembina ${ekskulNama} hari ini!`);
      return;
    }

    // VALIDASI RADIUS 50 METER (GEOFENCING)
    if (selectedSchool?.enableGeofencing && selectedSchool.latitude && selectedSchool.longitude) {
      setIsSaving(true);
      try {
        const pos = await getCurrentLocation();
        const dist = calculateDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          selectedSchool.latitude, 
          selectedSchool.longitude
        );

        const radius = selectedSchool.geofencingRadius || 50;
        if (dist > radius) {
          showToast(`GAGAL BOSS! Anda tidak dianggap Sekolah, Karena tidak berada dalam lokasi Sekolah!`);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        showToast(`Gagal verifikasi lokasi: ${err.message}`);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);
    try {
      const timeRange = `${ekskulJamMasuk}-${ekskulJamKeluar}`;
    const newAttendance: TeacherAttendanceEntry = {
      id: `att-ekskul-${Date.now()}`,
      schoolId: selectedSchool.id,
      classId: 'persekolah', // Khusus ekstrakurikuler: tingkat persekolah
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      roleUsed: 'PEMBINA_EKSTRAKURIKULER',
      date: ekskulDate,
      jamMasuk: ekskulJamMasuk,
      jamKeluar: ekskulJamKeluar,
      timeRangeFormatted: timeRange,
      status: 'HADIR',
      namaKegiatan: ekskulNama,
      materiKegiatan: ekskulMateri,
      jumlahPeserta: ekskulPeserta,
      keterangan: `Ekstrakurikuler Persekolah: ${ekskulNama}`,
      createdAt: new Date().toISOString(),
    };

    StorageService.addAttendance(newAttendance);
    showToast('Absen Berhasil');
    setEkskulMateri('');
    onDataChanged();
    } finally {
      setIsSaving(false);
    }
  };

  // HAPUS DATA PRESENSI
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

  // HAPUS DATA JURNAL
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

  const printElementId =
    cetakDocType === 'JURNAL_KELAS'
      ? 'journal-print-document'
      : 'attendance-print-document';

  // PRINTING & PDF EXPORT
  const handleBrowserPrint = () => {
    printDocumentUniversal({ elementId: printElementId, paperSize });
  };

  const handleDownloadMyPdf = async () => {
    if (!selectedSchool) return;
    setPdfStatus('Memproses PDF...');
    try {
      const elementId = printElementId;
      const classTag = cetakClassId ? `_Kelas_${cetakClassId}` : '_Persekolah';
      const filename = `${cetakDocType}_${currentUser.name}_${classTag}_${paperSize}.pdf`;

      const success = await exportToPdfClient({
        elementId,
        filename,
        orientation: 'landscape',
        paperSize,
        onProgress: (status) => setPdfStatus(status),
      });

      if (!success) {
        showToast('Gagal menghasilkan PDF langsung. Menampilkan dialog cetak browser.');
        printDocumentUniversal({ elementId: printElementId, paperSize });
      }
    } catch (err) {
      console.error(err);
      printDocumentUniversal({ elementId: printElementId, paperSize });
    } finally {
      setPdfStatus(null);
    }
  };

  // Data queries
  const allAttendances = selectedSchool
    ? StorageService.getAttendances({ schoolId: selectedSchool.id })
    : [];
  const myAttendances = allAttendances.filter(
    (a) => (a.teacherId === currentUser.id || a.teacherName === currentUser.name) && a.roleUsed === selectedRole
  );

  const allJournals = selectedSchool
    ? StorageService.getJournals({ schoolId: selectedSchool.id })
    : [];
  const myJournals = allJournals.filter(
    (j) => j.teacherId === currentUser.id || j.teacherName === currentUser.name
  );

  const isCetakPerSekolah =
    cetakDocType === 'DAFTAR_HADIR_KOKURIKULER' ||
    cetakDocType === 'DAFTAR_HADIR_EKSTRAKURIKULER';

  const effectiveCetakClassId = cetakClassId || (schoolClasses.length > 0 ? schoolClasses[0].id : '');
  const cetakTargetClass = schoolClasses.find((c) => c.id === effectiveCetakClassId);
  const cetakClassName = cetakTargetClass ? cetakTargetClass.name : undefined;

  const filteredCetakJournals = myJournals.filter((j) => {
    if (!selectedSchool || j.schoolId !== selectedSchool.id) return false;
    if (!effectiveCetakClassId) return false;
    const matchClass = isClassMatch(j.classId, effectiveCetakClassId, schoolClasses, selectedSchool.id);
    if (!matchClass) return false;
    const dateInfo = normalizeDateString(j.date);
    if (dateInfo) {
      if (dateInfo.year !== cetakYear || dateInfo.month !== cetakMonth) return false;
    }
    return true;
  });

  const getRoleLabel = (r: TeacherRoleType) => {
    switch (r) {
      case 'GURU_BIDANG_STUDI':
        return 'Guru Bidang Studi';
      case 'GURU_BANTU':
        return 'Guru Bantu';
      case 'GURU_DINIYAH':
        return 'Guru Diniyah';
      case 'KOORDINATOR_KOKURIKULER':
        return 'Koordinator Kokurikuler (P5)';
      case 'PEMBINA_EKSTRAKURIKULER':
        return 'Pembina Ekstrakurikuler';
      default:
        return r;
    }
  };

  const getRoleDescription = (r: TeacherRoleType) => {
    switch (r) {
      case 'GURU_BIDANG_STUDI':
        return 'Mengisi Presensi KBM Per-Kelas dan Jurnal Pembelajaran Kelas.';
      case 'GURU_BANTU':
        return 'Mengisi Presensi Pendampingan Guru Bantu Per-Kelas.';
      case 'GURU_DINIYAH':
        return 'Mengisi Presensi Bimbingan Ibadah & Tahsin Per-Kelas.';
      case 'KOORDINATOR_KOKURIKULER':
        return 'Mencatat pelaksanaan kegiatan projek P5 tingkat persekolah (seluruh sekolah).';
      case 'PEMBINA_EKSTRAKURIKULER':
        return 'Mencatat presensi latihan ekstrakurikuler tingkat persekolah.';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-4 sm:right-6 z-50 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-top-4 ${
            notification.includes('Sudah absen') || notification.includes('Gagal') || notification.includes('GAGAL')
              ? 'bg-rose-900 border-rose-700'
              : 'bg-emerald-900 border-emerald-700'
          }`}
        >
          {notification.includes('Sudah absen') || notification.includes('Gagal') || notification.includes('GAGAL') ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-bold">{notification}</span>
        </div>
      )}

      {/* HEADER NAVIGASI LANGKAH BERTINGKAT (ALUR WIZARD) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3 sm:p-4 shadow-xs no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onTabChange('BERANDA')}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm sm:text-base font-bold transition border border-slate-200 cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600" />
          <span>Kembali ke Beranda</span>
        </button>

        {/* Indikator Alur Bertingkat */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-bold overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              currentStep === 1
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 text-center text-xs flex items-center justify-center font-black">1</span>
            <span>Pilih Sekolah</span>
          </button>

          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />

          <button
            type="button"
            disabled={!selectedSchool}
            onClick={() => setCurrentStep(2)}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-40 ${
              currentStep === 2
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 text-center text-xs flex items-center justify-center font-black">2</span>
            <span>Pilih Tugas</span>
          </button>

          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />

          <button
            type="button"
            disabled={!selectedSchool}
            onClick={() => setCurrentStep(3)}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-40 ${
              currentStep === 3
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 text-center text-xs flex items-center justify-center font-black">3</span>
            <span>Input & Cetak</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LANGKAH 1: PILIH SEKOLAH / LEMBAGA (PERTAMA KALI MUNCUL)                   */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-4 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
              <span>Langkah 1 Dari 3</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              Pilih Sekolah Tempat Mengajar
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Silakan pilih salah satu lembaga sekolah di bawah ini untuk memulai pengisian:
            </p>
          </div>

          {assignedSchools.length === 0 ? (
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-2">
              <p className="text-base font-bold text-amber-900">
                Anda belum ditugaskan ke sekolah manapun oleh Admin Yayasan.
              </p>
              <p className="text-sm text-amber-700">
                Silakan hubungi Administrator Yayasan Walisongo Rumbai Jaya untuk penugasan sekolah.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {assignedSchools.map((school) => {
                const isSelected = selectedSchool?.id === school.id;
                return (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => handleSelectSchool(school)}
                    className={`p-5 rounded-2xl border-2 text-left transition flex items-start gap-4 cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                      <SchoolIcon className="w-7 h-7 text-emerald-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border">
                        Jenjang {school.jenjang}
                      </span>
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 mt-1.5 leading-snug">
                        {school.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">
                        NPSN: {school.npsn} &bull; {school.akreditasi}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <span>Pilih Sekolah Ini</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LANGKAH 2: PILIH TUGAS (SESUAI INPUTAN ADMIN)                              */}
      {/* ========================================================================= */}
      {currentStep === 2 && selectedSchool && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold mb-2">
                <span>Langkah 2 Dari 3</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                Pilih Tugas di {selectedSchool.name}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-1">
                Pilih tugas yang ingin Anda laksanakan hari ini (sesuai inputan resmi admin):
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-sm text-emerald-800 font-bold hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto bg-slate-100 px-3.5 py-2 rounded-xl"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Ganti Sekolah</span>
            </button>
          </div>

          {availableRoles.length === 0 ? (
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-2">
              <p className="text-base font-bold text-amber-900">
                Anda belum memiliki tugas yang aktif di {selectedSchool.name}.
              </p>
              <p className="text-sm text-amber-700">
                Silakan hubungi Administrator Sekolah untuk menetapkan tugas mengajar Anda di sekolah ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {availableRoles.map((role) => {
                const isSelected = selectedRole === role;
                let IconComponent = BookOpen;
                let badgeColor = 'bg-blue-100 text-blue-900 border-blue-200';
                let scopeText = 'Per-Kelas (Absen & Jurnal)';

                if (role === 'GURU_BANTU') {
                  IconComponent = UserCheck;
                  badgeColor = 'bg-teal-100 text-teal-900 border-teal-200';
                  scopeText = 'Per-Kelas (Absen Guru Bantu)';
                } else if (role === 'GURU_DINIYAH') {
                  IconComponent = BookOpen;
                  badgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-200';
                  scopeText = 'Per-Kelas (Absen Diniyah)';
                } else if (role === 'KOORDINATOR_KOKURIKULER') {
                  IconComponent = Sparkles;
                  badgeColor = 'bg-purple-100 text-purple-900 border-purple-200';
                  scopeText = 'Tingkat Persekolah (Projek P5)';
                } else if (role === 'PEMBINA_EKSTRAKURIKULER') {
                  IconComponent = Award;
                  badgeColor = 'bg-amber-100 text-amber-900 border-amber-200';
                  scopeText = 'Tingkat Persekolah (Ekstrakurikuler)';
                }

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={`p-5 sm:p-6 rounded-2xl border-2 text-left transition flex items-start gap-4 cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                      <IconComponent className="w-7 h-7 text-emerald-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                        {scopeText}
                      </span>
                      <h3 className="font-black text-base sm:text-lg text-slate-900 mt-2 leading-snug">
                        {getRoleLabel(role)}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                        {getRoleDescription(role)}
                      </p>
                      {role === 'GURU_BIDANG_STUDI' && (
                        <div className="mt-2 text-xs">
                          {schoolSubjects.length > 0 ? (
                            <span className="text-emerald-800 font-bold bg-emerald-100/90 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 border border-emerald-200">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Mapel: {schoolSubjects.map((s) => s.name).join(', ')}</span>
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold bg-amber-100 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 border border-amber-300">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>belum ada tugas mengajar</span>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <span>Buka Form Inputan</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LANGKAH 3: FORM INPUTAN & MENU SESUAI TUGAS TERPILIH                      */}
      {/* ========================================================================= */}
      {currentStep === 3 && selectedSchool && (
        <div className="space-y-4 animate-in fade-in">
          {/* Active Context Bar: Sekolah & Tugas, plus Tombol Ganti */}
          <div className="bg-emerald-900 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 border border-white/20 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                  {selectedSchool.name} &bull; <span className="text-emerald-300">{getRoleLabel(selectedRole)}</span>
                </h3>
                <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5 font-medium">
                  Pengajar: <strong>{currentUser.name}</strong> &bull; Yayasan Walisongo Rumbai Jaya
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ganti Tugas</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <SchoolIcon className="w-3.5 h-3.5" />
                <span>Ganti Sekolah</span>
              </button>
            </div>
          </div>

          {/* MENU-MENU / SUB-TABS DI HALAMAN GURU SESUAI TUGAS TERPILIH */}
          <div className="flex rounded-2xl bg-slate-200/80 p-1.5 max-w-2xl mx-auto shadow-inner no-print">
            {/* TAB 1: FORM ABSEN / PRESENSI SESUAI TUGAS */}
            <button
              type="button"
              onClick={() => setActiveDutyTab('ABSEN')}
              className={`flex-1 py-3 px-2 text-xs sm:text-base font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] ${
                activeDutyTab === 'ABSEN'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {selectedRole === 'GURU_BIDANG_STUDI' && '1. Absen KBM'}
                {selectedRole === 'GURU_BANTU' && '1. Absen Guru Bantu'}
                {selectedRole === 'GURU_DINIYAH' && '1. Absen Diniyah'}
                {selectedRole === 'KOORDINATOR_KOKURIKULER' && '1. Presensi Kokurikuler'}
                {selectedRole === 'PEMBINA_EKSTRAKURIKULER' && '1. Presensi Ekstrakurikuler'}
              </span>
            </button>

            {/* TAB 2: JURNAL PEMBELAJARAN (GURU BIDANG STUDI, BANTU, DINIYAH) */}
            {(selectedRole === 'GURU_BIDANG_STUDI' || selectedRole === 'GURU_BANTU' || selectedRole === 'GURU_DINIYAH') && (
              <button
                type="button"
                onClick={() => setActiveDutyTab('JURNAL')}
                className={`flex-1 py-3 px-2 text-xs sm:text-base font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] ${
                  activeDutyTab === 'JURNAL'
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {selectedRole === 'GURU_BIDANG_STUDI' ? '2. Isi Jurnal KBM' : '2. Isi Jurnal'}
                </span>
              </button>
            )}

            {/* TAB TERAKHIR: RIWAYAT & CETAK DOKUMEN REKAP */}
            <button
              type="button"
              onClick={() => setActiveDutyTab('RIWAYAT_CETAK')}
              className={`flex-1 py-3 px-2 text-xs sm:text-base font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] ${
                activeDutyTab === 'RIWAYAT_CETAK'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {selectedRole === 'GURU_BIDANG_STUDI' ? '3. Riwayat & Cetak' : '2. Riwayat & Cetak'}
              </span>
            </button>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* KONTEN SUB-TAB 1: FORM ABSEN / PRESENSI SESUAI TUGAS               */}
          {/* ----------------------------------------------------------------- */}
          {activeDutyTab === 'ABSEN' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
              {/* HEADER FORM */}
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-600" />
                    <span>
                      {selectedRole === 'GURU_BIDANG_STUDI' && 'Form Absen KBM (Dibuat Per-Kelas)'}
                      {selectedRole === 'GURU_BANTU' && 'Form Absen Guru Bantu (Dibuat Per-Kelas)'}
                      {selectedRole === 'GURU_DINIYAH' && 'Form Absen Guru Diniyah (Dibuat Per-Kelas)'}
                      {selectedRole === 'KOORDINATOR_KOKURIKULER' && 'Presensi Koordinator Kokurikuler P5 (Per-Sekolah)'}
                      {selectedRole === 'PEMBINA_EKSTRAKURIKULER' && 'Presensi Pembina Ekstrakurikuler (Per-Sekolah)'}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {selectedRole === 'GURU_BIDANG_STUDI' && 'Pencatatan jam hadir mengajar kelas reguler per-kelas.'}
                    {selectedRole === 'GURU_BANTU' && 'Pencatatan jam hadir pendampingan belajar guru bantu per-kelas.'}
                    {selectedRole === 'GURU_DINIYAH' && 'Pencatatan jam hadir bimbingan ibadah & tahsin per-kelas.'}
                    {selectedRole === 'KOORDINATOR_KOKURIKULER' && 'Pencatatan projek kokurikuler tingkat sekolah (tidak dipisah per-kelas).'}
                    {selectedRole === 'PEMBINA_EKSTRAKURIKULER' && 'Pencatatan latihan ekstrakurikuler tingkat sekolah (tidak dipisah per-kelas).'}
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-200 shrink-0">
                  {getRoleLabel(selectedRole)}
                </span>
              </div>

              {/* FORM PER-KELAS: GURU BIDANG STUDI, GURU BANTU, GURU DINIYAH */}
              {(selectedRole === 'GURU_BIDANG_STUDI' || selectedRole === 'GURU_BANTU' || selectedRole === 'GURU_DINIYAH') && (
                <form onSubmit={handleSubmitAbsenKelas} className="space-y-4 max-w-2xl mx-auto">
                  {/* PILIH KELAS PEMBELAJARAN (WAJIB PER-KELAS) */}
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                    <label className="block font-black text-emerald-950 text-sm sm:text-base">
                      Pilih Kelas Pembelajaran (Wajib Per-Kelas) *
                    </label>
                    <select
                      required
                      value={selectedClassId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedClassId(val);
                        setCetakClassId(val);
                      }}
                      className="w-full px-4 py-3.5 rounded-xl border border-emerald-300 bg-white text-emerald-950 font-bold text-base focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                    >
                      {schoolClasses.length === 0 ? (
                        <option value="">-- Belum ada data kelas di sekolah ini --</option>
                      ) : (
                        schoolClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} (Tingkat {cls.tingkat})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Tanggal {selectedSchool?.lockAttendanceTodayOnly && <span className="text-xs text-indigo-700 font-semibold">(Terkunci Hari Ini)</span>}
                      </label>
                      <input
                        type="date"
                        required
                        readOnly={!!selectedSchool?.lockAttendanceTodayOnly}
                        value={absenDate}
                        onChange={(e) => !selectedSchool?.lockAttendanceTodayOnly && setAbsenDate(e.target.value)}
                        className={`w-full px-4 py-3.5 rounded-xl border text-base min-h-[48px] ${
                          selectedSchool?.lockAttendanceTodayOnly 
                            ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-bold cursor-not-allowed'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Nama Guru
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentUser.name}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-base font-semibold cursor-not-allowed min-h-[48px]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jam Masuk
                      </label>
                      <input
                        type="time"
                        required
                        value={absenJamMasuk}
                        onChange={(e) => setAbsenJamMasuk(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-mono text-lg font-bold text-emerald-800 min-h-[48px]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jam Keluar
                      </label>
                      <input
                        type="time"
                        required
                        value={absenJamKeluar}
                        onChange={(e) => setAbsenJamKeluar(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-mono text-lg font-bold text-emerald-800 min-h-[48px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Keterangan / Catatan Kehadiran
                    </label>
                    <input
                      type="text"
                      value={absenKeterangan}
                      onChange={(e) => setAbsenKeterangan(e.target.value)}
                      placeholder={
                        selectedRole === 'GURU_BANTU'
                          ? 'Contoh: Pendampingan baca tulis & tugas siswa'
                          : selectedRole === 'GURU_DINIYAH'
                          ? 'Contoh: Bimbingan tahsin Juz Amma & praktik ibadah'
                          : 'Contoh: Mengajar KBM tatap muka materi bab 1'
                      }
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-base min-h-[48px]"
                    />
                  </div>

                  {/* INDIKATOR RADIUS GEOFENCING (UNTUK GURU BIDANG STUDI, GURU BANTU, GURU DINIYAH) */}
                  {selectedSchool?.enableGeofencing && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-emerald-950 font-bold">
                        <MapPin className="w-5 h-5 text-emerald-600 shrink-0 animate-bounce" />
                        <span>
                          Validasi Radius Geofencing ({selectedSchool.geofencingRadius || 50} Meter) Aktif untuk {getRoleLabel(selectedRole)}
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-emerald-700 text-white rounded-lg font-black text-xs shadow-2xs">
                        Radius {selectedSchool.geofencingRadius || 50}m
                      </span>
                    </div>
                  )}

                  {(() => {
                    const isDup = Boolean(
                      selectedClassId &&
                      absenDate &&
                      selectedSchool &&
                      StorageService.getAttendances().some((a) => {
                        if (a.teacherId !== currentUser.id) return false;
                        if (a.schoolId && canonicalizeSchoolId(a.schoolId) !== canonicalizeSchoolId(selectedSchool.id)) return false;
                        if (canonicalizeClassId(a.schoolId, a.classId) !== canonicalizeClassId(selectedSchool.id, selectedClassId)) return false;
                        if (a.roleUsed !== selectedRole) return false; // Memastikan pengecekan spesifik per peran (Guru Bantu / Guru Diniyah / Guru Studi)
                        const aDateNorm = a.date ? a.date.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
                        const targetDateNorm = absenDate ? absenDate.split('-').map((p) => p.padStart(2, '0')).join('-') : '';
                        return aDateNorm === targetDateNorm;
                      })
                    );

                    return (
                      <>
                        {isDup && (
                          <div className="p-3.5 bg-rose-50 border-2 border-rose-500 rounded-2xl text-rose-700 font-bold text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
                            <span className="text-xl shrink-0">⚠️</span>
                            <span>Sudah absen sebagai {getRoleLabel(selectedRole)} di kelas &amp; tanggal ini! Silakan pilih kelas atau tanggal lain.</span>
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isDup || isSaving}
                            className={`w-full py-4 px-6 font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-base sm:text-lg min-h-[50px] ${
                              (isDup || isSaving)
                                ? 'bg-slate-400 text-white cursor-not-allowed opacity-90 shadow-none'
                                : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/25 cursor-pointer active:scale-98'
                            }`}
                          >
                            {isSaving ? (
                              <RotateCcw className="w-5 h-5 animate-spin" />
                            ) : (
                              <Save className="w-5 h-5" />
                            )}
                            <span>
                              {isSaving
                                ? 'Sedang Verifikasi Lokasi & Menyimpan...'
                                : isDup
                                  ? 'Sudah Absen Hari Ini'
                                  : `Simpan Absen ${getRoleLabel(selectedRole)}`}
                            </span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </form>
              )}

              {/* FORM PER-SEKOLAH: KOORDINATOR KOKURIKULER (P5) */}
              {selectedRole === 'KOORDINATOR_KOKURIKULER' && (
                <form onSubmit={handleSubmitKokurikuler} className="space-y-4 max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Tanggal Projek {selectedSchool?.lockAttendanceTodayOnly && <span className="text-xs text-indigo-700 font-semibold">(Terkunci Hari Ini)</span>}
                      </label>
                      <input
                        type="date"
                        required
                        readOnly={!!selectedSchool?.lockAttendanceTodayOnly}
                        value={kokuDate}
                        onChange={(e) => !selectedSchool?.lockAttendanceTodayOnly && setKokuDate(e.target.value)}
                        className={`w-full px-4 py-3.5 rounded-xl border text-base min-h-[48px] ${
                          selectedSchool?.lockAttendanceTodayOnly 
                            ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-bold cursor-not-allowed'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Nama Koordinator
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentUser.name}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-base font-semibold cursor-not-allowed min-h-[48px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-purple-900 text-sm sm:text-base mb-1.5">
                        Nama Kegiatan / Tema Projek P5:
                      </label>
                      <input
                        type="text"
                        required
                        value={kokuNama}
                        onChange={(e) => setKokuNama(e.target.value)}
                        placeholder="Contoh: Projek P5 - Tema Kearifan Lokal / Bhinneka Tunggal Ika"
                        className="w-full px-4 py-3.5 rounded-xl border border-purple-300 bg-purple-50/40 text-purple-950 font-bold text-base min-h-[48px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jam Mulai:
                      </label>
                      <input
                        type="time"
                        required
                        value={kokuJamMasuk}
                        onChange={(e) => setKokuJamMasuk(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-mono text-lg font-bold text-purple-900 min-h-[48px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jam Selesai:
                      </label>
                      <input
                        type="time"
                        required
                        value={kokuJamKeluar}
                        onChange={(e) => setKokuJamKeluar(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-mono text-lg font-bold text-purple-900 min-h-[48px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jumlah Peserta (Siswa Persekolah):
                      </label>
                      <input
                        type="text"
                        value={kokuPeserta}
                        onChange={(e) => setKokuPeserta(e.target.value)}
                        placeholder="Contoh: 45 Siswa gabungan"
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-base min-h-[48px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Materi / Agenda Pelaksanaan Projek:
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={kokuMateri}
                      onChange={(e) => setKokuMateri(e.target.value)}
                      placeholder="Jelaskan agenda dan tahapan projek hari ini..."
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300 text-base leading-relaxed"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className={`w-full py-4 px-6 font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-base sm:text-lg min-h-[50px] ${
                        isSaving
                          ? 'bg-slate-400 text-white cursor-not-allowed shadow-none'
                          : 'bg-purple-700 hover:bg-purple-800 text-white shadow-purple-700/25 cursor-pointer active:scale-98'
                      }`}
                    >
                      {isSaving ? (
                        <RotateCcw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                      <span>{isSaving ? 'Sedang Menyimpan...' : 'Simpan Presensi Kokurikuler (Persekolah)'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* FORM PER-SEKOLAH: PEMBINA EKSTRAKURIKULER */}
              {selectedRole === 'PEMBINA_EKSTRAKURIKULER' && (
                <form onSubmit={handleSubmitEkstrakurikuler} className="space-y-4 max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Tanggal Latihan {selectedSchool?.lockAttendanceTodayOnly && <span className="text-xs text-indigo-700 font-semibold">(Terkunci Hari Ini)</span>}
                      </label>
                      <input
                        type="date"
                        required
                        readOnly={!!selectedSchool?.lockAttendanceTodayOnly}
                        value={ekskulDate}
                        onChange={(e) => !selectedSchool?.lockAttendanceTodayOnly && setEkskulDate(e.target.value)}
                        className={`w-full px-4 py-3.5 rounded-xl border text-base min-h-[48px] ${
                          selectedSchool?.lockAttendanceTodayOnly 
                            ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-bold cursor-not-allowed'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Nama Pembina
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentUser.name}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-base font-semibold cursor-not-allowed min-h-[48px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-amber-900 text-sm sm:text-base mb-1.5">
                        Nama Ekstrakurikuler:
                      </label>
                      <input
                        type="text"
                        required
                        value={ekskulNama}
                        onChange={(e) => setEkskulNama(e.target.value)}
                        placeholder="Contoh: Pramuka / Futsal / Tahfidz Club / PMR"
                        className="w-full px-4 py-3.5 rounded-xl border border-amber-300 bg-amber-50/40 text-amber-950 font-bold text-base min-h-[48px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jam Mulai:
                      </label>
                      <input
                        type="time"
                        required
                        value={ekskulJamMasuk}
                        onChange={(e) => setEkskulJamMasuk(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-mono text-lg font-bold text-amber-900 min-h-[48px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jam Selesai:
                      </label>
                      <input
                        type="time"
                        required
                        value={ekskulJamKeluar}
                        onChange={(e) => setEkskulJamKeluar(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-mono text-lg font-bold text-amber-900 min-h-[48px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                        Jumlah Anggota yang Hadir:
                      </label>
                      <input
                        type="text"
                        value={ekskulPeserta}
                        onChange={(e) => setEkskulPeserta(e.target.value)}
                        placeholder="Contoh: 32 Anggota dari seluruh kelas"
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-base min-h-[48px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Materi / Agenda Latihan:
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={ekskulMateri}
                      onChange={(e) => setEkskulMateri(e.target.value)}
                      placeholder="Jelaskan teknik atau agenda latihan..."
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300 text-base leading-relaxed"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className={`w-full py-4 px-6 font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-base sm:text-lg min-h-[50px] ${
                        isSaving
                          ? 'bg-slate-400 text-white cursor-not-allowed shadow-none'
                          : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25 cursor-pointer active:scale-98'
                      }`}
                    >
                      {isSaving ? (
                        <RotateCcw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                      <span>{isSaving ? 'Sedang Menyimpan...' : 'Simpan Presensi Ekstrakurikuler (Persekolah)'}</span>
                    </button>
                  </div>
                </form>
              )}
              {/* RIWAYAT PREVIEW PRESENSI YANG BARU SAJA DIISI */}
              <div className="mt-8 pt-6 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Riwayat Presensi yang Sudah Masuk ({myAttendances.length})</span>
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Tersimpan di Server Pusat
                  </span>
                </div>

                {myAttendances.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 italic">
                    Belum ada rekaman presensi untuk tugas {getRoleLabel(selectedRole)} di {selectedSchool.name}. Presensi yang Anda simpan akan langsung tercatat dan muncul di sini.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {myAttendances.map((att) => {
                      const cObj = schoolClasses.find((c) => c.id === att.classId);
                      return (
                        <div key={att.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-200 text-xs flex items-center justify-between gap-3 transition">
                          <div className="min-w-0 space-y-1">
                            <div className="font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                              <span>{att.namaKegiatan || getRoleLabel(att.roleUsed)}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                {att.classId === 'persekolah' ? 'Persekolah' : (cObj ? cObj.name : 'Per-Kelas')}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                                ✓ Berhasil Masuk
                              </span>
                            </div>
                            <div className="text-slate-600 text-[11px] flex items-center gap-2 flex-wrap">
                              <span>📅 {att.date}</span>
                              <span>&bull;</span>
                              <span className="font-mono text-emerald-800 font-bold">⏰ {att.timeRangeFormatted}</span>
                              {att.keterangan && <span>&bull; 📝 {att.keterangan}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttendance(att.id, att.namaKegiatan || att.roleUsed)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                            title="Hapus Presensi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* KONTEN SUB-TAB 2: FORM ISI JURNAL (BIDANG STUDI, BANTU, DINIYAH)  */}
          {/* ----------------------------------------------------------------- */}
          {activeDutyTab === 'JURNAL' && (selectedRole === 'GURU_BIDANG_STUDI' || selectedRole === 'GURU_BANTU' || selectedRole === 'GURU_DINIYAH') && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                    <span>
                      {selectedRole === 'GURU_BIDANG_STUDI' && 'Form Jurnal Pembelajaran KBM (Dibuat Per-Kelas)'}
                      {selectedRole === 'GURU_BANTU' && 'Form Jurnal Guru Bantu (Dibuat Per-Kelas)'}
                      {selectedRole === 'GURU_DINIYAH' && 'Form Jurnal Guru Diniyah (Dibuat Per-Kelas)'}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {selectedRole === 'GURU_BIDANG_STUDI' && 'Pencatatan materi kompetensi dasar pembelajaran kelas reguler per-kelas.'}
                    {selectedRole === 'GURU_BANTU' && 'Pencatatan materi pendampingan belajar guru bantu per-kelas.'}
                    {selectedRole === 'GURU_DINIYAH' && 'Pencatatan materi bimbingan ibadah & tahsin per-kelas.'}
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-bold border shrink-0 ${
                  selectedRole === 'GURU_BIDANG_STUDI' ? 'bg-blue-100 text-blue-900 border-blue-200' :
                  selectedRole === 'GURU_BANTU' ? 'bg-teal-100 text-teal-900 border-teal-200' :
                  'bg-indigo-100 text-indigo-900 border-indigo-200'
                }`}>
                  {getRoleLabel(selectedRole)}
                </span>
              </div>

              <form onSubmit={handleSubmitJurnalKelas} className="space-y-4 max-w-2xl mx-auto">
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                  <label className="block font-black text-emerald-950 text-sm sm:text-base">
                    Pilih Kelas Pembelajaran (Wajib Per-Kelas) *
                  </label>
                  <select
                    required
                    value={selectedClassId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedClassId(val);
                      setCetakClassId(val);
                    }}
                    className="w-full px-4 py-3.5 rounded-xl border border-emerald-300 bg-white text-emerald-950 font-bold text-base focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  >
                    {schoolClasses.length === 0 ? (
                      <option value="">-- Belum ada data kelas --</option>
                    ) : (
                      schoolClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} (Tingkat {cls.tingkat})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Tanggal Pelaksanaan
                    </label>
                    <input
                      type="date"
                      required
                      value={journalDate}
                      onChange={(e) => setJournalDate(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-base min-h-[48px]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Jam Ke- (JP)
                    </label>
                    <select
                      value={journalJamKe}
                      onChange={(e) => setJournalJamKe(Number(e.target.value))}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-bold text-base min-h-[48px]"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <option key={num} value={num}>
                          Jam Ke-{num}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* KELOMPOK PILIHAN BIDANG/MATA PELAJARAN */}
                  <div className="sm:col-span-2">
                    {selectedRole === 'GURU_BIDANG_STUDI' && (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block font-bold text-slate-700 text-sm sm:text-base">
                            Mata Pelajaran:
                          </label>
                          {schoolSubjects.length === 0 && (
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                              belum ada tugas mengajar
                            </span>
                          )}
                        </div>
                        <select
                          required
                          disabled={schoolSubjects.length === 0}
                          value={journalSubjectId}
                          onChange={(e) => setJournalSubjectId(e.target.value)}
                          className={`w-full px-4 py-3.5 rounded-xl border font-bold text-base min-h-[48px] ${
                            schoolSubjects.length === 0
                              ? 'bg-amber-50/70 border-amber-300 text-amber-900 cursor-not-allowed'
                              : 'border-slate-300 text-slate-900 bg-white'
                          }`}
                        >
                          {schoolSubjects.length === 0 ? (
                            <option value="">belum ada tugas mengajar</option>
                          ) : (
                            schoolSubjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} {s.code ? `(${s.code})` : ''}
                              </option>
                            ))
                          )}
                        </select>
                        {schoolSubjects.length === 0 && (
                          <div className="mt-2.5 p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs sm:text-sm">
                              <p className="font-bold text-amber-950">belum ada tugas mengajar</p>
                              <p className="text-amber-800 mt-0.5 leading-relaxed">
                                Administrator Sekolah belum menginputkan mata pelajaran untuk Anda di {selectedSchool.name}. Silakan hubungi admin sekolah agar mata pelajaran Anda didaftarkan.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                    Materi / Kompetensi yang Diajarkan *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={journalMateri}
                    onChange={(e) => setJournalMateri(e.target.value)}
                    placeholder="Contoh: Bab 2 Perkalian dan Pembagian Pecahan..."
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-300 text-base leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Jenis Kegiatan
                    </label>
                    <select
                      value={journalJenisKegiatan}
                      onChange={(e) => setJournalJenisKegiatan(e.target.value as JenisKegiatan)}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-semibold text-base min-h-[48px]"
                    >
                      <option value="KBM">KBM (Kegiatan Belajar Mengajar)</option>
                      <option value="UH">UH (Ulangan Harian)</option>
                      <option value="PTS">PTS (Penilaian Tengah Semester)</option>
                      <option value="PAS">PAS (Penilaian Akhir Semester)</option>
                      <option value="REMEDIAL">Remedial / Pengayaan</option>
                      <option value="PRAKTIK">Praktik / Eksperimen</option>
                      <option value="Asesmen">Asesmen / Evaluasi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                      Keterangan Capaian
                    </label>
                    <select
                      value={journalKeterangan}
                      onChange={(e) => setJournalKeterangan(e.target.value as KeteranganJurnal)}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-semibold text-base min-h-[48px]"
                    >
                      <option value="Tuntas">Tuntas (Materi Selesai)</option>
                      <option value="Belum Tuntas">Belum Tuntas (Perlu Dilanjutkan)</option>
                      <option value="Terkendala">Terkendala (Ada Kendala KBM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 text-sm sm:text-base mb-1.5">
                    Catatan Khusus Siswa / Kelas
                  </label>
                  <input
                    type="text"
                    value={journalCatatan}
                    onChange={(e) => setJournalCatatan(e.target.value)}
                    placeholder="Contoh: 3 siswa izin sakit, suasana kelas aktif dan tertib"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-base min-h-[48px]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={schoolSubjects.length === 0 || isSaving}
                    className={`w-full py-4 px-6 font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-base sm:text-lg min-h-[52px] ${
                      (schoolSubjects.length === 0 || isSaving)
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/25 cursor-pointer active:scale-98'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <RotateCcw className="w-5 h-5 animate-spin" />
                        <span>Sedang Menyimpan...</span>
                      </>
                    ) : schoolSubjects.length === 0 ? (
                      <span>belum ada tugas mengajar</span>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Simpan Jurnal KBM Kelas Ini</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* RIWAYAT JURNAL KBM YANG SUDAH MASUK */}
              <div className="mt-8 pt-6 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Riwayat Jurnal KBM yang Sudah Masuk ({myJournals.length})</span>
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Tersimpan di Server Pusat
                  </span>
                </div>

                {myJournals.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 italic">
                    Belum ada jurnal pembelajaran yang tersimpan untuk sekolah ini. Jurnal yang Anda simpan akan langsung tercatat dan muncul di sini.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {myJournals.map((jrn) => {
                      const cObj = schoolClasses.find((c) => c.id === jrn.classId);
                      return (
                        <div key={jrn.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-200 text-xs flex items-center justify-between gap-3 transition">
                          <div className="min-w-0 space-y-1">
                            <div className="font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                              <span>{jrn.subjectName || 'Mata Pelajaran'}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                                {cObj ? cObj.name : 'Kelas'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-mono">
                                Jam ke-{jrn.jamKe}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                jrn.keterangan === 'Tuntas' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                {jrn.keterangan || 'Tuntas'}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                                ✓ Berhasil Masuk
                              </span>
                            </div>
                            <div className="text-slate-800 font-medium">
                              Materi: <strong>{jrn.materi}</strong>
                            </div>
                            <div className="text-slate-500 text-[11px] flex items-center gap-2 flex-wrap">
                              <span>📅 {jrn.date}</span>
                              {jrn.jenisKegiatan && <span>&bull; Kegiatan: {jrn.jenisKegiatan}</span>}
                              {jrn.catatan && <span>&bull; Catatan: {jrn.catatan}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteJournal(jrn.id, jrn.materi)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                            title="Hapus Jurnal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* KONTEN SUB-TAB 3: RIWAYAT & CETAK DOKUMEN REKAP SESUAI TUGAS       */}
          {/* ----------------------------------------------------------------- */}
          {activeDutyTab === 'RIWAYAT_CETAK' && (
            <div className="space-y-4">
              {/* Card Pengaturan Cetak Landscape */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    Cetak Dokumen Rekap {getRoleLabel(selectedRole)}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Format cetak resmi landscape {paperSize} dengan pengesahan tanda tangan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl border border-slate-300 overflow-hidden text-xs mr-1">
                    <button
                      type="button"
                      onClick={() => setPaperSize('A4')}
                      className={`px-3 py-2 font-bold cursor-pointer min-h-[38px] ${
                        paperSize === 'A4' ? 'bg-indigo-700 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      A4
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperSize('F4')}
                      className={`px-3 py-2 font-bold cursor-pointer min-h-[38px] ${
                        paperSize === 'F4' ? 'bg-indigo-700 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      F4
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleBrowserPrint}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Browser</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMyPdf}
                    disabled={!!pdfStatus}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer min-h-[38px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>{pdfStatus || `Unduh PDF (${paperSize})`}</span>
                  </button>
                </div>
              </div>

              {/* Filter Cetak Bar */}
              <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs sm:text-sm no-print">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Dokumen Cetak:</label>
                  <select
                    value={cetakDocType}
                    onChange={(e) => setCetakDocType(e.target.value as DokumenCetakType)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold bg-white text-emerald-950 text-sm min-h-[42px]"
                  >
                    {selectedRole === 'GURU_BIDANG_STUDI' && (
                      <>
                        <option value="DAFTAR_HADIR_GURU">DAFTAR HADIR GURU (Per-Kelas)</option>
                        <option value="JURNAL_KELAS">REKAP JURNAL PEMBELAJARAN KELAS (Per-Kelas)</option>
                      </>
                    )}
                    {selectedRole === 'GURU_BANTU' && (
                      <option value="DAFTAR_HADIR_GURU_BANTU">DAFTAR HADIR GURU BANTU (Per-Kelas)</option>
                    )}
                    {selectedRole === 'GURU_DINIYAH' && (
                      <option value="DAFTAR_HADIR_GURU_DINIYAH">DAFTAR HADIR GURU DINIYAH (Per-Kelas)</option>
                    )}
                    {selectedRole === 'KOORDINATOR_KOKURIKULER' && (
                      <option value="DAFTAR_HADIR_KOKURIKULER">DAFTAR HADIR KOORDINATOR KOKURIKULER (P5)</option>
                    )}
                    {selectedRole === 'PEMBINA_EKSTRAKURIKULER' && (
                      <option value="DAFTAR_HADIR_EKSTRAKURIKULER">DAFTAR HADIR PEMBINA EKSTRAKURIKULER</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isCetakPerSekolah ? 'Cakupan Lembaga:' : 'Pilih Kelas Cetak (Per-Kelas):'}
                  </label>
                  {isCetakPerSekolah ? (
                    <div className="px-3 py-2.5 border border-purple-300 rounded-xl bg-purple-50 text-purple-900 font-bold text-sm min-h-[42px] flex items-center">
                      Tingkat Persekolah (Seluruh Lembaga)
                    </div>
                  ) : (
                    <select
                      value={effectiveCetakClassId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCetakClassId(val);
                        setSelectedClassId(val);
                      }}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold bg-white text-indigo-950 text-sm min-h-[42px]"
                    >
                      {schoolClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} (Tingkat {cls.tingkat})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Bulan:</label>
                    <select
                      value={cetakMonth}
                      onChange={(e) => setCetakMonth(Number(e.target.value))}
                      className="w-full px-2 py-2.5 border border-slate-300 rounded-xl bg-white text-sm min-h-[42px]"
                    >
                      {[
                        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
                      ].map((mName, i) => (
                        <option key={i + 1} value={i + 1}>
                          {mName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tahun:</label>
                    <select
                      value={cetakYear}
                      onChange={(e) => setCetakYear(Number(e.target.value))}
                      className="w-full px-2 py-2.5 border border-slate-300 rounded-xl bg-white text-sm min-h-[42px]"
                    >
                      {[2024, 2025, 2026, 2027].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* AREA PREVIEW DOKUMEN CETAK LANDSCAPE */}
              <div className="bg-slate-300/60 p-2 sm:p-5 rounded-3xl overflow-x-auto shadow-inner border border-slate-200">
                {cetakDocType === 'JURNAL_KELAS' ? (
                  <PrintableJournalSheet
                    id="journal-print-document"
                    school={selectedSchool}
                    classId={effectiveCetakClassId}
                    className={cetakClassName}
                    journals={filteredCetakJournals}
                    periodeText={`Bulan ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][cetakMonth - 1]} ${cetakYear}`}
                    paperSize={paperSize}
                    selectedMonth={cetakMonth}
                    onlyTeacherId={currentUser.id}
                    onlyTeacherName={currentUser.name}
                  />
                ) : (
                  <PrintableAttendanceSheet
                    id="attendance-print-document"
                    school={selectedSchool}
                    docType={cetakDocType}
                    selectedMonth={cetakMonth}
                    selectedYear={cetakYear}
                    selectedClassId={isCetakPerSekolah ? undefined : effectiveCetakClassId}
                    className={isCetakPerSekolah ? undefined : cetakClassName}
                    assignments={teacherAssignment ? [teacherAssignment] : []}
                    teachers={[currentUser]}
                    attendances={allAttendances.filter(
                      (a) =>
                        (a.teacherId === currentUser.id ||
                          (a.teacherName &&
                            a.teacherName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())) &&
                        a.schoolId === selectedSchool.id &&
                        (isCetakPerSekolah ? true : isClassMatch(a.classId, effectiveCetakClassId, schoolClasses, selectedSchool.id))
                    )}
                    paperSize={paperSize}
                    onlyTeacherId={currentUser.id}
                  />
                )}
              </div>

              {/* RIWAYAT PENGISIAN PRESENSI / JURNAL SAYA (TABEL HAPUS CEPAT) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3 no-print">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>
                      {cetakDocType === 'JURNAL_KELAS'
                        ? `Daftar Riwayat Jurnal Pembelajaran Saya (${myJournals.length})`
                        : `Daftar Riwayat Rekaman Presensi Tugas Ini (${myAttendances.length})`}
                    </span>
                  </h4>
                  <span className="text-xs text-slate-400">Klik ikon tong sampah merah untuk menghapus rekaman</span>
                </div>

                {cetakDocType === 'JURNAL_KELAS' ? (
                  myJournals.length === 0 ? (
                    <p className="text-xs sm:text-sm text-slate-400 py-4 text-center italic">
                      Belum ada rekaman jurnal pembelajaran untuk tugas ini di {selectedSchool.name}.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs sm:text-sm max-h-96 overflow-y-auto pr-1">
                      {myJournals.map((jrn) => {
                        const cObj = schoolClasses.find((c) => c.id === jrn.classId);
                        return (
                          <div key={jrn.id} className="py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <span>{jrn.subjectName || 'Mata Pelajaran'}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                  {cObj ? cObj.name : 'Kelas'}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-mono">
                                  Jam ke-{jrn.jamKe}
                                </span>
                              </div>
                              <div className="text-slate-700 text-xs mt-0.5">
                                Materi: <strong>{jrn.materi}</strong>
                              </div>
                              <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-2">
                                <span>📅 {jrn.date}</span>
                                {jrn.catatan && <span>&bull; Catatan: {jrn.catatan}</span>}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteJournal(jrn.id, jrn.materi)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                              title="Hapus Jurnal Pembelajaran"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  myAttendances.length === 0 ? (
                    <p className="text-xs sm:text-sm text-slate-400 py-4 text-center italic">
                      Belum ada rekaman presensi untuk tugas ini di {selectedSchool.name}.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs sm:text-sm max-h-96 overflow-y-auto pr-1">
                      {myAttendances.map((att) => {
                        const cObj = schoolClasses.find((c) => c.id === att.classId);
                        return (
                          <div key={att.id} className="py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <span>{att.namaKegiatan || getRoleLabel(att.roleUsed)}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {att.classId === 'persekolah' ? 'Persekolah' : (cObj ? cObj.name : 'Per-Kelas')}
                                </span>
                              </div>
                              <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-2">
                                <span>📅 {att.date}</span>
                                <span>&bull;</span>
                                <span className="font-mono text-emerald-700 font-bold">⏰ {att.timeRangeFormatted}</span>
                                {att.keterangan && <span>&bull; {att.keterangan}</span>}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteAttendance(att.id, att.namaKegiatan || att.roleUsed)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                              title="Hapus Presensi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRM MODAL */}
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
