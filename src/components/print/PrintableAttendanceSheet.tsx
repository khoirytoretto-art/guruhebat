import React from 'react';
import { School, TeacherAssignment, User, TeacherAttendanceEntry, DokumenCetakType, PaperSize } from '../../types';
import { StorageService, normalizeDateString, isClassMatch } from '../../utils/storage';

interface PrintableAttendanceSheetProps {
  id?: string;
  school: School;
  docType: DokumenCetakType;
  selectedMonth: number; // 1 - 12
  selectedYear: number;
  selectedClassId?: string;
  className?: string;
  assignments: TeacherAssignment[];
  teachers: User[];
  attendances: TeacherAttendanceEntry[];
  paperSize?: PaperSize;
  onlyTeacherId?: string; // Khusus tampilan cetak guru: hanya tampilkan namanya sendiri
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const PrintableAttendanceSheet: React.FC<PrintableAttendanceSheetProps> = ({
  id = 'attendance-print-document',
  school,
  docType,
  selectedMonth,
  selectedYear,
  selectedClassId,
  className,
  assignments,
  teachers,
  attendances,
  paperSize = 'F4',
  onlyTeacherId,
}) => {
  const foundation = StorageService.getFoundation();
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isSunday = (day: number) => {
    return new Date(selectedYear, selectedMonth - 1, day).getDay() === 0;
  };

  // KECUALI KOKURIKULER DAN EKSTRA HANYA PERSEKOLAH
  const isPerSekolahOnly =
    docType === 'DAFTAR_HADIR_KOKURIKULER' ||
    docType === 'DAFTAR_HADIR_EKSTRAKURIKULER';

  const roleFilter = 
    docType === 'DAFTAR_HADIR_GURU_BANTU' ? 'GURU_BANTU' :
    docType === 'DAFTAR_HADIR_GURU_DINIYAH' ? 'GURU_DINIYAH' :
    docType === 'DAFTAR_HADIR_KOKURIKULER' ? 'KOORDINATOR_KOKURIKULER' :
    docType === 'DAFTAR_HADIR_EKSTRAKURIKULER' ? 'PEMBINA_EKSTRAKURIKULER' :
    'GURU_BIDANG_STUDI';

  // Filter assignments for this specific school
  const schoolAssignments = assignments.filter((asg) => asg.schoolId === school.id);

  // Subject assignments in this school (for identifying teachers with teaching duties)
  const schoolSubjects = StorageService.getSubjects(school.id);
  const schoolClasses = StorageService.getClasses(school.id);

  // Resolusi target kelas yang ketat & akurat per-kelas
  // Jika cetak akun guru mandiri (onlyTeacherId ada), jangan izinkan mode SEMUA_KELAS agar selalu terfilter sesuai kelasnya
  const isAllClasses = !onlyTeacherId && (selectedClassId === 'SEMUA_KELAS' || selectedClassId === 'ALL' || className === 'Semua Kelas');
  const selectedClassObj = (!isAllClasses && selectedClassId)
    ? schoolClasses.find((c) => c.id === selectedClassId || c.name.toLowerCase() === selectedClassId.toLowerCase())
    : null;
  const targetClassId = isAllClasses
    ? 'SEMUA_KELAS'
    : (selectedClassObj
        ? selectedClassObj.id
        : (selectedClassId || (!isPerSekolahOnly && schoolClasses.length > 0 ? schoolClasses[0].id : undefined)));
  const targetClassName = isAllClasses
    ? 'Semua Kelas'
    : (selectedClassObj
        ? selectedClassObj.name
        : (className || (!isPerSekolahOnly && schoolClasses.length > 0 ? schoolClasses[0].name : undefined)));

  const matchesClass = (classId?: string) => {
    if (isPerSekolahOnly) return true;
    if (!classId) return false;
    if (classId === 'persekolah') return false; // Dokumen kelas tidak boleh mencampur rekaman persekolah
    // Jika SEMUA_KELAS dipilih pada panel admin/kepsek, pastikan kelas tersebut memang terdaftar di sekolah ini
    if (targetClassId === 'SEMUA_KELAS' || targetClassId === 'ALL') {
      return schoolClasses.some((sc) => isClassMatch(classId, sc.id, schoolClasses, school.id));
    }
    const target = targetClassId || targetClassName;
    if (!target) return false;
    return isClassMatch(classId, target, schoolClasses, school.id);
  };

  // Semua guru yang terhubung ke sekolah ini (dari penugasan, assignedSchoolIds, atau schoolId)
  const schoolTeachers = teachers.filter((t) => {
    if (!t) return false;
    if (t.role !== 'GURU' && t.role !== 'KEPALA_SEKOLAH') return false;
    if (t.schoolId === school.id) return true;
    if (Array.isArray(t.assignedSchoolIds) && t.assignedSchoolIds.includes(school.id)) return true;
    if (schoolAssignments.some((asg) => asg.teacherId === t.id)) return true;
    if (attendances.some((a) => (a.teacherId === t.id || a.teacherName === t.name) && a.schoolId === school.id)) return true;
    return false;
  });

  // Guru yang memiliki rekaman presensi pada sekolah dan kelas ini untuk role yang diminta
  const attendanceTeacherIds = new Set<string>();
  attendances.forEach((a) => {
    if (a.schoolId !== school.id) return;
    if (!matchesClass(a.classId)) return;

    if (docType === 'DAFTAR_HADIR_KOKURIKULER') {
      if (
        a.roleUsed === 'KOORDINATOR_KOKURIKULER' ||
        a.id.startsWith('att-koku-') ||
        (a.namaKegiatan && a.namaKegiatan.toLowerCase().includes('p5'))
      ) {
        if (a.teacherId) attendanceTeacherIds.add(a.teacherId);
      }
      return;
    }

    if (docType === 'DAFTAR_HADIR_EKSTRAKURIKULER') {
      if (
        a.roleUsed === 'PEMBINA_EKSTRAKURIKULER' ||
        a.id.startsWith('att-ekskul-') ||
        (a.namaKegiatan && !a.namaKegiatan.toLowerCase().includes('p5'))
      ) {
        if (a.teacherId) attendanceTeacherIds.add(a.teacherId);
      }
      return;
    }

    if (docType === 'DAFTAR_HADIR_GURU_BANTU') {
      if (a.roleUsed === 'GURU_BANTU' || a.roleUsed?.toLowerCase().includes('bantu')) {
        if (a.teacherId) attendanceTeacherIds.add(a.teacherId);
      }
      return;
    }

    if (docType === 'DAFTAR_HADIR_GURU_DINIYAH') {
      if (a.roleUsed === 'GURU_DINIYAH' || a.roleUsed?.toLowerCase().includes('diniyah')) {
        if (a.teacherId) attendanceTeacherIds.add(a.teacherId);
      }
      return;
    }

    // Dokumen DAFTAR_HADIR_GURU: Seluruh guru yang mengisi presensi di kelas ini
    if (a.teacherId) attendanceTeacherIds.add(a.teacherId);
  });

  // Himpunan guru yang mengajar mapel di kelas / sekolah ini
  const subjectTeacherIds = new Set<string>(
    schoolSubjects
      .filter((subj) => {
        if (!subj.teacherId) return false;
        if (!isPerSekolahOnly && targetClassId && subj.classIds && subj.classIds.length > 0) {
          return subj.classIds.some((cid) => matchesClass(cid));
        }
        return true;
      })
      .map((subj) => subj.teacherId)
  );

  // Kumpulkan seluruh penugasan & profil guru yang relevan
  const teacherCandidateMap = new Map<string, any>();
  const nameToIdMap = new Map<string, string>(); // name.toLowerCase() -> teacherId

  const addCandidate = (tid: string, name: string, data: any) => {
    if (!name) return;
    const normName = name.trim().toLowerCase();
    if (nameToIdMap.has(normName)) {
      const existingId = nameToIdMap.get(normName)!;
      const existingData = teacherCandidateMap.get(existingId);
      // Gabungkan data, prioritaskan yang memiliki roles lebih lengkap
      teacherCandidateMap.set(existingId, {
        ...existingData,
        ...data,
        roles: Array.from(new Set([...(existingData?.roles || []), ...(data?.roles || [])])),
        assignedClassIds: Array.from(new Set([...(existingData?.assignedClassIds || []), ...(data?.assignedClassIds || [])])),
      });
      return;
    }
    nameToIdMap.set(normName, tid);
    teacherCandidateMap.set(tid, data);
  };

  // 1. Tambahkan dari schoolAssignments
  schoolAssignments.forEach((asg) => {
    let matchRole = false;
    if (docType === 'DAFTAR_HADIR_GURU') {
      matchRole =
        asg.roles.includes('GURU_BIDANG_STUDI') ||
        subjectTeacherIds.has(asg.teacherId) ||
        attendanceTeacherIds.has(asg.teacherId);
    } else {
      matchRole = asg.roles.includes(roleFilter) || attendanceTeacherIds.has(asg.teacherId);
    }

    if (!matchRole) return;

    // Filter per-kelas jika penugasan spesifik kelas
    if (!isPerSekolahOnly && targetClassId && asg.assignedClassIds && asg.assignedClassIds.length > 0) {
      const matchAnyClass = asg.assignedClassIds.some((cid) => matchesClass(cid));
      if (!matchAnyClass && !attendanceTeacherIds.has(asg.teacherId) && !subjectTeacherIds.has(asg.teacherId)) {
        return;
      }
    }

    const user = teachers.find((t) => t.id === asg.teacherId) || StorageService.getUserById(asg.teacherId);
    addCandidate(asg.teacherId, user?.name || (asg as any).teacherName || 'Guru', asg);
  });

  // 2. Tambahkan guru sekolah yang belum memiliki penugasan eksplisit tapi aktif mengajar/absen di kelas ini
  schoolTeachers.forEach((t) => {
    const normName = (t.name || '').trim().toLowerCase();
    if (nameToIdMap.has(normName)) return;

    const hasAtt = attendanceTeacherIds.has(t.id);
    const hasSubj = subjectTeacherIds.has(t.id);

    if (docType === 'DAFTAR_HADIR_GURU') {
      if (hasAtt || hasSubj || (!targetClassId && schoolTeachers.length <= 15)) {
        addCandidate(t.id, t.name, {
          id: `synth-${t.id}`,
          schoolId: school.id,
          teacherId: t.id,
          teacherName: t.name,
          nip: t.nip || '-',
          jabatan: 'GURU_BIDANG_STUDI' as const,
          roles: ['GURU_BIDANG_STUDI'],
          urutan: 99,
          assignedClassIds: targetClassId ? [targetClassId] : [],
        });
      }
    } else if (hasAtt) {
      addCandidate(t.id, t.name, {
        id: `synth-${t.id}`,
        schoolId: school.id,
        teacherId: t.id,
        teacherName: t.name,
        nip: t.nip || '-',
        jabatan: roleFilter as any,
        roles: [roleFilter],
        urutan: 99,
        assignedClassIds: targetClassId ? [targetClassId] : [],
      });
    }
  });

  // 3. JAMINAN UTAMA: Setiap guru yang memiliki rekaman presensi di kelas/sekolah ini DIJAMIN MUNCUL di baris lembar cetak
  attendances.forEach((a) => {
    if (a.schoolId !== school.id) return;
    if (!matchesClass(a.classId)) return;
    const tid = a.teacherId;
    const tname = (a.teacherName || '').trim();
    if (!tid && !tname) return;

    // Filter dokumen spesifik
    if (docType === 'DAFTAR_HADIR_GURU_BANTU' && a.roleUsed !== 'GURU_BANTU' && !a.roleUsed?.toLowerCase().includes('bantu')) return;
    if (docType === 'DAFTAR_HADIR_GURU_DINIYAH' && a.roleUsed !== 'GURU_DINIYAH' && !a.roleUsed?.toLowerCase().includes('diniyah')) return;
    if (docType === 'DAFTAR_HADIR_KOKURIKULER' && a.roleUsed !== 'KOORDINATOR_KOKURIKULER' && !a.id.startsWith('att-koku-') && !a.namaKegiatan?.toLowerCase().includes('p5')) return;
    if (docType === 'DAFTAR_HADIR_EKSTRAKURIKULER' && a.roleUsed !== 'PEMBINA_EKSTRAKURIKULER' && !a.id.startsWith('att-ekskul-')) return;

    if (!nameToIdMap.has(tname.toLowerCase())) {
      const uObj = tid ? (StorageService.getUserById(tid) || teachers.find((t) => t.id === tid)) : undefined;
      const roleUsed: string = a.roleUsed || roleFilter;
      let jbt = 'Guru Bidang Studi';
      if (roleUsed === 'GURU_BANTU') jbt = 'Guru Bantu';
      else if (roleUsed === 'GURU_DINIYAH') jbt = 'Guru Diniyah';
      else if (roleUsed === 'KOORDINATOR_KOKURIKULER') jbt = 'Koord. Kokurikuler';
      else if (roleUsed === 'PEMBINA_EKSTRAKURIKULER') jbt = 'Pembina Ekstrakurikuler';
      else if (roleUsed === 'GURU_KELAS') jbt = 'Guru Kelas';

      addCandidate(tid || `att-name-${tname}`, tname, {
        id: `att-teacher-${tid || tname}`,
        schoolId: school.id,
        teacherId: tid || tname,
        teacherName: uObj?.name || a.teacherName || 'Guru',
        nip: uObj?.nip || '-',
        jabatan: jbt,
        customJabatan: jbt,
        roles: [roleUsed],
        urutan: 99,
        assignedClassIds: a.classId ? [a.classId] : (targetClassId ? [targetClassId] : []),
      });
    }
  });

  // Urutkan daftar guru
  const relevantAssignments = Array.from(teacherCandidateMap.values()).sort((a, b) => {
    const urutA = a.urutan !== undefined && a.urutan !== null ? a.urutan : 99;
    const urutB = b.urutan !== undefined && b.urutan !== null ? b.urutan : 99;
    if (urutA !== urutB) return urutA - urutB;
    return (a.teacherName || '').localeCompare(b.teacherName || '');
  });

  // Khusus tampilan cetak akun guru mandiri: hanya tampilkan baris miliknya sendiri
  let finalAssignments = onlyTeacherId
    ? relevantAssignments.filter((asg) => asg.teacherId === onlyTeacherId)
    : relevantAssignments;

  if (onlyTeacherId && finalAssignments.length === 0) {
    const user = teachers.find((u) => u.id === onlyTeacherId) || StorageService.getUserById(onlyTeacherId);
    if (user) {
      let defaultJabatan = 'Guru Bidang Studi';
      if (roleFilter === 'GURU_BANTU') defaultJabatan = 'Guru Bantu';
      else if (roleFilter === 'GURU_DINIYAH') defaultJabatan = 'Guru Diniyah';
      else if (roleFilter === 'KOORDINATOR_KOKURIKULER') defaultJabatan = 'Koord. Kokurikuler';
      else if (roleFilter === 'PEMBINA_EKSTRAKURIKULER') defaultJabatan = 'Pembina Ekstrakurikuler';

      finalAssignments = [
        {
          id: `synth-${user.id}`,
          schoolId: school.id,
          teacherId: user.id,
          teacherName: user.name,
          nip: user.nip || '-',
          jabatan: roleFilter as any,
          customJabatan: defaultJabatan,
          roles: [roleFilter],
          urutan: 1,
          assignedClassIds: targetClassId ? [targetClassId] : [],
        },
      ];
    }
  }

  const teacherRows = finalAssignments.map((asg, index) => {
    const user = teachers.find((t) => t.id === asg.teacherId) || StorageService.getUserById(asg.teacherId);
    const teacherName = user?.name || (asg as any).teacherName || 'Guru';

    // Cari subjek atau peran spesifik di kelas/sekolah ini
    const teacherSubjs = schoolSubjects.filter((s) => s.teacherId === asg.teacherId);
    const recentAtt = attendances.find((a) => a.teacherId === asg.teacherId && a.schoolId === school.id);

    let jabatanLabel = (asg as any).customJabatan;
    if (!jabatanLabel) {
      if (docType === 'DAFTAR_HADIR_KOKURIKULER') {
        const activityName = asg.namaKokurikuler || recentAtt?.namaKegiatan || 'Projek P5';
        jabatanLabel = `Koord. ${activityName}`;
      } else if (docType === 'DAFTAR_HADIR_EKSTRAKURIKULER') {
        const activityName = asg.namaEkstrakurikuler || recentAtt?.namaKegiatan || 'Ekstrakurikuler';
        jabatanLabel = `Pembina ${activityName}`;
      } else if (docType === 'DAFTAR_HADIR_GURU_BANTU') {
        jabatanLabel = 'Guru Bantu';
      } else if (docType === 'DAFTAR_HADIR_GURU_DINIYAH') {
        jabatanLabel = 'Guru Diniyah';
      } else {
        // DAFTAR_HADIR_GURU (Guru Bidang Studi)
        if (teacherSubjs.length > 0) {
          jabatanLabel = `Guru ${teacherSubjs[0].name}`;
        } else if (asg.jabatan && asg.jabatan !== 'GURU') {
          jabatanLabel = asg.jabatan.replace(/_/g, ' ');
        } else {
          jabatanLabel = 'Guru Bidang Studi';
        }
      }
    }

    return {
      no: index + 1,
      teacherId: asg.teacherId,
      name: teacherName,
      nip: user?.nip || (asg as any).nip || '-',
      jabatan: jabatanLabel,
    };
  });

  const getAttendanceValue = (teacherId: string, day: number) => {
    const userObj = teachers.find((u) => u.id === teacherId) || StorageService.getUserById(teacherId);
    const targetRow = teacherRows.find((r) => r.teacherId === teacherId);
    const targetName = (targetRow?.name || userObj?.name || '').trim().toLowerCase();

    const matchingEntries = attendances.filter((a) => {
      // 1. Match identitas guru (by ID, nama guru di user, atau nama di baris tabel)
      const aName = (a.teacherName || '').trim().toLowerCase();
      const matchTeacher =
        a.teacherId === teacherId ||
        (userObj && a.teacherId === userObj.id) ||
        (targetName !== '' && aName === targetName) ||
        (userObj && aName === userObj.name.trim().toLowerCase());
      if (!matchTeacher) return false;

      // 2. Normalisasi tanggal akurat (menghapus format ISO 'T' dan spasi)
      const dateInfo = normalizeDateString(a.date);
      if (!dateInfo) return false;
      if (dateInfo.year !== selectedYear || dateInfo.month !== selectedMonth || dateInfo.day !== day) {
        return false;
      }

      // 3. Verifikasi sekolah
      if (a.schoolId !== school.id) return false;

      // 4. Verifikasi kelas jika dokumen per-kelas (Wajib per-kelas)
      if (!isPerSekolahOnly) {
        if (!matchesClass(a.classId)) return false;
      }

      // 5. Verifikasi peran sesuai jenis dokumen
      if (docType === 'DAFTAR_HADIR_KOKURIKULER') {
        return (
          a.roleUsed === 'KOORDINATOR_KOKURIKULER' ||
          a.id.startsWith('att-koku-') ||
          (a.namaKegiatan && a.namaKegiatan.toLowerCase().includes('p5'))
        );
      }
      if (docType === 'DAFTAR_HADIR_EKSTRAKURIKULER') {
        return (
          a.roleUsed === 'PEMBINA_EKSTRAKURIKULER' ||
          a.id.startsWith('att-ekskul-') ||
          (a.namaKegiatan && !a.namaKegiatan.toLowerCase().includes('p5'))
        );
      }
      if (docType === 'DAFTAR_HADIR_GURU_BANTU') {
        return a.roleUsed === 'GURU_BANTU' || a.roleUsed?.toLowerCase().includes('bantu');
      }
      if (docType === 'DAFTAR_HADIR_GURU_DINIYAH') {
        return a.roleUsed === 'GURU_DINIYAH' || a.roleUsed?.toLowerCase().includes('diniyah');
      }

      // DAFTAR_HADIR_GURU: Seluruh kehadiran guru di kelas ini ditampilkan langsung
      return true;
    });

    if (matchingEntries.length === 0) return '';
    
    // Deduplikasi tampilan: jangan tampilkan jam yang sama berulang kali di satu sel
    const displayStrings = matchingEntries.map((e) => {
      if (e.timeRangeFormatted && e.timeRangeFormatted.trim() !== '-') return e.timeRangeFormatted;
      if (e.jamMasuk && e.jamKeluar) return `${e.jamMasuk}-${e.jamKeluar}`;
      return e.status || 'HADIR';
    });
    
    // Gunakan pemisah khusus untuk mendeteksi sesi ganda
    return Array.from(new Set(displayStrings)).join('||');
  };

  const getDocTitle = () => {
    switch (docType) {
      case 'DAFTAR_HADIR_GURU_BANTU':
        return 'DAFTAR HADIR GURU BANTU';
      case 'DAFTAR_HADIR_GURU_DINIYAH':
        return 'DAFTAR HADIR GURU DINIYAH';
      case 'DAFTAR_HADIR_KOKURIKULER':
        return 'DAFTAR HADIR KOORDINATOR KOKURIKULER (P5)';
      case 'DAFTAR_HADIR_EKSTRAKURIKULER':
        return 'DAFTAR HADIR PEMBINA EKSTRAKURIKULER';
      default:
        return 'DAFTAR HADIR GURU';
    }
  };

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sig = school.signatureConfig || {
    tampilkanTandaTangan: true,
    pihak1Aktif: true,
    pihak1Label: 'Mengetahui,',
    pihak1Jabatan: 'Kepala Sekolah',
    pihak1Nama: school.kepalaSekolah,
    pihak1Nip: school.nipKepalaSekolah,
    pihak2Aktif: true,
    pihak2Label: 'Disahkan di Riau,',
    pihak2Jabatan: 'Waka Kurikulum / Wali Kelas',
    pihak2Nama: school.wakaKurikulum || school.kepalaSekolah,
    pihak2Nip: school.nipWakaKurikulum,
    lokasiKota: 'Riau',
  };

  const isF4 = paperSize === 'F4';
  const containerMinWidth = isF4 ? '1140px' : '990px';
  const nameColWidth = isF4 ? '165px' : '145px';
  const jabatanColWidth = isF4 ? '115px' : '100px';
  const dayColWidth = isF4 ? '25px' : '22px';

  // Tampilan Semester Sesuai Ketentuan Resmi:
  // Bulan Juli - Desember = Semester Ganjil
  // Bulan Januari - Juni = Semester Genap
  const semesterLabel = (selectedMonth >= 7 && selectedMonth <= 12) ? 'Semester Ganjil' : 'Semester Genap';

  return (
    <div
      id={id}
      className="printable-area bg-white text-black p-3 sm:p-4 font-sans mx-auto"
      style={{
        width: '100%',
        minWidth: containerMinWidth,
        backgroundColor: '#ffffff',
        color: '#000000',
        boxSizing: 'border-box',
      }}
    >
      {/* KOP SURAT RESMI: LOGO YAYASAN SEBELAH KIRI & LOGO SEKOLAH SEBELAH KANAN */}
      <div className="border-b-[3px] border-double border-slate-900 pb-2 mb-4">
        <div className="flex items-center justify-between gap-4">
          {/* LOGO YAYASAN (SEBELAH KIRI) */}
          <div className="w-24 h-24 flex items-center justify-center shrink-0">
            {foundation.logoYayasanUrl ? (
              <img
                src={foundation.logoYayasanUrl}
                alt="Logo Yayasan"
                className="max-w-full max-h-full object-contain p-1"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-20 h-20 bg-slate-50 flex items-center justify-center font-bold text-[10px] text-slate-400 border border-slate-200 rounded text-center leading-tight">
                LOGO<br />YAYASAN
              </div>
            )}
          </div>

          {/* TEKS IDENTITAS LEMBAGA (TENGAH) */}
          <div className="flex-1 text-center px-4">
            <h4 className="text-[11px] uppercase tracking-[0.1em] font-bold text-slate-800">
              {school.foundationName || foundation.name}
            </h4>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-950 mt-0.5 leading-none">
              {school.name}
            </h1>
            <p className="text-[11px] font-bold text-slate-900 mt-1.5 uppercase">
              NPSN: {school.npsn} &bull; Status Akreditasi: <span className="bg-slate-100 px-1 rounded">{school.akreditasi}</span>
            </p>
            <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
              {school.alamat}<br />
              Telp: {school.telepon} &bull; Email: {school.email}
            </p>
          </div>

          {/* LOGO SEKOLAH (SEBELAH KANAN) */}
          <div className="w-24 h-24 flex items-center justify-center shrink-0">
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt="Logo Sekolah"
                className="max-w-full max-h-full object-contain p-1"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-20 h-20 bg-slate-50 flex items-center justify-center font-bold text-[10px] text-slate-400 border border-slate-200 rounded text-center leading-tight">
                LOGO<br />SEKOLAH
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JUDUL DOKUMEN & IDENTITAS KELAS/PERSEKOLAH */}
      <div className="text-center mb-4">
        <h2 className="text-base font-bold underline tracking-wide uppercase text-slate-950">
          {getDocTitle()}
        </h2>
        <div className="flex justify-between items-center text-xs font-semibold mt-2 px-1 text-slate-800">
          <div>
            <span>Lembaga: </span>
            <span className="font-bold">{school.name}</span>
          </div>
          <div>
            {isPerSekolahOnly ? (
              <>
                <span>Cakupan: </span>
                <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Persekolah (Seluruh Lembaga)
                </span>
              </>
            ) : (
              <>
                <span>Kelas: </span>
                <span className="font-bold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {targetClassName || className || 'Kelas'}
                </span>
              </>
            )}
          </div>
          <div>
            <span>Bulan: </span>
            <span className="font-bold">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
          </div>
          <div>
            <span>Tahun Ajaran: </span>
            <span className="font-bold">{school.tahunAjaranAktif || '2024/2025'} ({semesterLabel})</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            Kertas: <strong>{paperSize === 'F4' ? 'F4 / Folio (330x215mm)' : 'A4 (297x210mm)'}</strong>
          </div>
        </div>
      </div>

      {/* TABEL FORMAT LANDSCAPE BERSIH */}
      <div className="w-full">
        <table
          className="doc-table w-full text-left border-collapse text-[10px]"
          style={{
            tableLayout: 'fixed',
            border: '1px solid #000000',
            borderCollapse: 'collapse',
            borderSpacing: 0,
            width: '100%',
          }}
        >
          <colgroup>
            <col style={{ width: '32px' }} />
            <col style={{ width: nameColWidth }} />
            <col style={{ width: jabatanColWidth }} />
            {daysArray.map((day) => (
              <col key={day} style={{ width: dayColWidth }} />
            ))}
            <col style={{ width: '38px' }} />
          </colgroup>
          <thead>
            <tr style={{ color: '#000000' }}>
              <th
                rowSpan={2}
                style={{
                  width: '32px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '4px 2px',
                  backgroundColor: '#f1f5f9',
                  boxSizing: 'border-box',
                }}
              >
                No
              </th>
              <th
                rowSpan={2}
                style={{
                  width: nameColWidth,
                  border: '1px solid #000000',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  padding: '4px 6px',
                  backgroundColor: '#f1f5f9',
                  boxSizing: 'border-box',
                }}
              >
                Nama Guru & NIP
              </th>
              <th
                rowSpan={2}
                style={{
                  width: jabatanColWidth,
                  border: '1px solid #000000',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  padding: '4px 6px',
                  backgroundColor: '#f1f5f9',
                  boxSizing: 'border-box',
                }}
              >
                Jabatan
              </th>
              <th
                colSpan={daysInMonth}
                style={{
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '4px 2px',
                  backgroundColor: '#f8fafc',
                  boxSizing: 'border-box',
                  fontSize: '9px',
                  fontWeight: 'bold',
                }}
              >
                Tanggal / Hari - Bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </th>
              <th
                rowSpan={2}
                style={{
                  width: '38px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '4px 2px',
                  backgroundColor: '#f1f5f9',
                  boxSizing: 'border-box',
                }}
              >
                Jml
              </th>
            </tr>
            <tr style={{ color: '#000000' }}>
              {daysArray.map((day) => {
                const sunday = isSunday(day);
                return (
                  <th
                    key={day}
                    style={{
                      width: dayColWidth,
                      border: '1px solid #000000',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      padding: '2px 0px',
                      fontSize: '9px',
                      fontWeight: '800',
                      backgroundColor: sunday ? '#fee2e2' : '#ffffff',
                      color: sunday ? '#dc2626' : '#000000',
                      boxSizing: 'border-box',
                    }}
                    title={sunday ? `Tgl ${day} (Hari Minggu - Libur)` : undefined}
                  >
                    <div style={{ lineHeight: 1 }}>{day}</div>
                    {sunday && (
                      <div style={{ fontSize: '5px', color: '#dc2626', fontWeight: 'bold', lineHeight: 1, marginTop: '1px' }}>
                        MIN
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {teacherRows.length === 0 ? (
              <tr>
                <td
                  colSpan={daysInMonth + 4}
                  style={{
                    border: '1px solid #000000',
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontStyle: 'italic',
                  }}
                >
                  Belum ada guru yang ditugaskan dengan peran ini di {isPerSekolahOnly ? 'sekolah ini' : `kelas ${className || 'ini'}`}.
                </td>
              </tr>
            ) : (
              teacherRows.map((row) => {
                let hadirCount = 0;
                return (
                  <tr
                    key={row.teacherId}
                    style={{
                      minHeight: '36px',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                    }}
                  >
                    <td
                      style={{
                        border: '1px solid #000000',
                        verticalAlign: 'middle',
                        padding: '4px 2px',
                        fontWeight: 'bold',
                      }}
                    >
                      {row.no}
                    </td>
                    <td
                      style={{
                        border: '1px solid #000000',
                        verticalAlign: 'middle',
                        padding: '4px 6px',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: '#000000', lineHeight: '1.25' }}>
                        {row.name}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#334155', marginTop: '1px' }}>
                        NIP: {row.nip}
                      </div>
                    </td>
                    <td
                      style={{
                        border: '1px solid #000000',
                        verticalAlign: 'middle',
                        padding: '4px 6px',
                        color: '#000000',
                        fontWeight: '500',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                      }}
                    >
                      {row.jabatan}
                    </td>
                      {/* Hari 1..31 dengan jam masuk & jam keluar */}
                      {daysArray.map((day) => {
                        const val = getAttendanceValue(row.teacherId, day);
                        if (val) hadirCount++;
                        const sunday = isSunday(day);

                        const isTimeRange = val && val.includes('-');
                        const parts = isTimeRange ? val.split('-') : [val];
                        return (
                          <td
                            key={day}
                            style={{
                              width: dayColWidth,
                              border: '1px solid #000000',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              padding: '0px',
                              backgroundColor: val ? '#f0fdf4' : (sunday ? '#fef2f2' : '#ffffff'),
                              color: val ? '#166534' : (sunday ? '#ef4444' : '#e2e8f0'),
                              overflow: 'hidden',
                              height: '36px',
                            }}
                            title={sunday ? `Tgl ${day} (Hari Minggu)` : (val ? `${row.name} (Tgl ${day}): ${val}` : undefined)}
                          >
                            {val ? (
                              val.includes('||') ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: '0.8',
                                    padding: '0',
                                    gap: '1px'
                                  }}
                                >
                                  {val.split('||').map((session, sIdx) => {
                                    const sessionParts = session.split('-');
                                    return (
                                      <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {sessionParts.length === 2 ? (
                                          <>
                                            <span style={{ fontSize: '6px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                                              {sessionParts[0].trim()}
                                            </span>
                                            <span style={{ fontSize: '6px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                                              {sessionParts[1].trim()}
                                            </span>
                                          </>
                                        ) : (
                                          <span style={{ fontSize: '7px', fontWeight: '900' }}>{session}</span>
                                        )}
                                        {sIdx < val.split('||').length - 1 && (
                                          <div style={{ height: '0.5px', width: '8px', backgroundColor: '#e2e8f0' }} />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                isTimeRange && parts.length === 2 ? (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: '0.9',
                                      padding: '0',
                                      transform: 'scale(0.95)',
                                    }}
                                  >
                                    <span style={{ fontSize: '7.5px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                                      {parts[0].trim()}
                                    </span>
                                    <div style={{ height: '1px', width: '6px', backgroundColor: '#cbd5e1', margin: '1px 0' }} />
                                    <span style={{ fontSize: '7.5px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                                      {parts[1].trim()}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '8px', fontWeight: '900' }}>
                                    {val}
                                  </span>
                                )
                              )
                            ) : (
                              <span style={{ fontSize: '9px', color: sunday ? '#fee2e2' : '#f1f5f9', fontWeight: 'bold' }}>
                                {sunday ? 'M' : ''}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          border: '1px solid #000000',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          fontWeight: 'bold',
                          backgroundColor: '#f8fafc',
                          fontSize: '10px',
                        }}
                      >
                        {hadirCount}
                      </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CATATAN PENGISIAN */}
      <div className="mt-3 flex justify-between text-[10px] text-slate-600 italic">
        <div>
          * Keterangan: {isPerSekolahOnly ? 'Dokumen tingkat persekolah (seluruh lembaga)' : `Dokumen per-kelas (${className || 'Semua Kelas'})`}. Sel terisi rentang jam kehadiran guru. Kolom merah (Min / M) = Hari Minggu (Libur).
        </div>
        <div>
          Dokumen Resmi AsistenGuru &bull; Format: {paperSize === 'F4' ? 'F4 / Folio (330mm)' : 'A4 (297mm)'} Landscape
        </div>
      </div>

      {/* LEMBAR PENGESAHAN TANDA TANGAN (HANYA MUNCUL JIKA AKTIF) */}
      {sig.tampilkanTandaTangan ? (
        <div
          className="signature-container mt-12 flex justify-between items-start text-xs text-slate-950 px-12"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          {sig.pihak1Aktif ? (
            <div className="text-center flex flex-col items-center" style={{ width: '280px' }}>
              <p className="text-slate-800 font-bold uppercase tracking-tight">{sig.pihak1Label || 'Mengetahui,'}</p>
              <p className="font-extrabold mt-1">{sig.pihak1Jabatan || 'Kepala Sekolah'}</p>
              {/* Ruang kosong tanda tangan & stempel fisik yang luas (100px) */}
              <div
                className="signature-space w-full"
                style={{
                  height: '100px',
                  minHeight: '100px',
                  display: 'block',
                }}
              />
              <p className="font-black underline text-slate-950 text-[13px] tracking-wide uppercase">
                {sig.pihak1Nama || school.kepalaSekolah}
              </p>
              <p className="text-[11px] text-slate-900 font-bold mt-1">
                NIP: {sig.pihak1Nip || school.nipKepalaSekolah || '-'}
              </p>
            </div>
          ) : <div style={{ width: '280px' }} />}

          {sig.pihak2Aktif ? (
            <div className="text-center flex flex-col items-center" style={{ width: '280px' }}>
              <p className="text-slate-800 font-bold uppercase tracking-tight">
                {sig.pakaiTanggal !== false
                  ? (sig.pihak2Label || `Disahkan di ${sig.lokasiKota || 'Riau'}, ${sig.tanggalManual || todayFormatted}`)
                  : (sig.pihak2Label || `Disahkan di ${sig.lokasiKota || 'Riau'}`)}
              </p>
              <p className="font-extrabold mt-1">{sig.pihak2Jabatan || 'Waka Kurikulum / Wali Kelas'}</p>
              {/* Ruang kosong tanda tangan fisik yang luas (100px) */}
              <div
                className="signature-space w-full"
                style={{
                  height: '100px',
                  minHeight: '100px',
                  display: 'block',
                }}
              />
              <p className="font-black underline text-slate-950 text-[13px] tracking-wide uppercase">
                {sig.pihak2Nama || school.wakaKurikulum || 'Petugas'}
              </p>
              <p className="text-[11px] text-slate-900 font-bold mt-1">
                NIP: {sig.pihak2Nip || school.nipWakaKurikulum || '-'}
              </p>
            </div>
          ) : <div style={{ width: '280px' }} />}
        </div>
      ) : null}
    </div>
  );
};
