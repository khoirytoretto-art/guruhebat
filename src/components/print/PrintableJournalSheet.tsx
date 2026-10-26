import React from 'react';
import { School, ClassJournalEntry, PaperSize } from '../../types';
import { StorageService, normalizeDateString, isClassMatch } from '../../utils/storage';

interface PrintableJournalSheetProps {
  id?: string;
  school: School;
  classId?: string;
  className?: string;
  journals: ClassJournalEntry[];
  periodeText: string;
  paperSize?: PaperSize;
  selectedMonth?: number;
  onlyTeacherId?: string;
  onlyTeacherName?: string;
}

export const PrintableJournalSheet: React.FC<PrintableJournalSheetProps> = ({
  id = 'journal-print-document',
  school,
  classId,
  className,
  journals,
  periodeText,
  paperSize = 'F4',
  selectedMonth,
  onlyTeacherId,
  onlyTeacherName,
}) => {
  const foundation = StorageService.getFoundation();
  const schoolClasses = StorageService.getClasses(school.id);
  // Jika cetak akun guru mandiri (onlyTeacherId ada), jangan izinkan mode SEMUA_KELAS agar selalu terfilter sesuai kelasnya
  const isAllClasses = !onlyTeacherId && (classId === 'SEMUA_KELAS' || classId === 'ALL' || className === 'Semua Kelas');
  const classObj = isAllClasses
    ? null
    : schoolClasses.find(
        (c) => (classId && c.id === classId) || (className && (c.name.toLowerCase() === className.toLowerCase() || c.id === className))
      );
  const displayClassName = isAllClasses
    ? 'Semua Kelas'
    : (classObj
        ? classObj.name
        : (className || (schoolClasses.length > 0 ? schoolClasses[0].name : 'Kelas')));
  const effectiveClassId = isAllClasses
    ? 'SEMUA_KELAS'
    : (classObj
        ? classObj.id
        : (classId || (schoolClasses.length > 0 ? schoolClasses[0].id : '')));

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
    pihak2Nama: school.wakaKurikulum || 'Wali Kelas',
    pihak2Nip: school.nipWakaKurikulum,
    lokasiKota: 'Riau',
  };

  const isF4 = paperSize === 'F4';
  const containerMinWidth = isF4 ? '1140px' : '990px';

  // Tampilan Semester Sesuai Ketentuan Resmi:
  // Bulan Juli - Desember = Semester Ganjil
  // Bulan Januari - Juni = Semester Genap
  const firstDateInfo = journals.length > 0 && journals[0].date ? normalizeDateString(journals[0].date) : null;
  const derivedMonth = selectedMonth || (firstDateInfo ? firstDateInfo.month : new Date().getMonth() + 1);
  const semesterLabel = derivedMonth >= 7 && derivedMonth <= 12 ? 'Semester Ganjil' : 'Semester Genap';

  // Jurnal pembelajaran kelas: terfilter otomatis berdasarkan schoolId dan classId aktif milik guru
  const studyJournals = journals.filter((j) => {
    // 1. Verifikasi sekolah ketat
    if (j.schoolId !== school.id) return false;

    // 2. Filter akun guru jika onlyTeacherId aktif
    if (onlyTeacherId) {
      const matchTeacher =
        j.teacherId === onlyTeacherId ||
        (onlyTeacherName && j.teacherName && j.teacherName.trim().toLowerCase() === onlyTeacherName.trim().toLowerCase());
      if (!matchTeacher) return false;
    }

    // 3. Verifikasi kelas
    if (isAllClasses) {
      return schoolClasses.some((sc) => isClassMatch(j.classId, sc.id, schoolClasses, school.id));
    }
    const target = effectiveClassId || displayClassName || className;
    if (!target || !j.classId) return false;
    return isClassMatch(j.classId, target, schoolClasses, school.id);
  });

  const finalJournals = studyJournals;

  // Urutkan rekaman jurnal pembelajaran:
  // 1. Tanggal dimulai dari yang terlama (ascending: tanggal terlama ke tanggal terbaru)
  // 2. Jam ke- nya dimulai dari 1 (ascending: 1, 2, 3...)
  const sortedJournals = [...finalJournals].sort((a, b) => {
    const infoA = normalizeDateString(a.date);
    const infoB = normalizeDateString(b.date);
    const dateA = infoA ? infoA.formatted : (a.date || '');
    const dateB = infoB ? infoB.formatted : (b.date || '');
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const jamA = typeof a.jamKe === 'number' ? a.jamKe : parseInt(String(a.jamKe || 0), 10);
    const jamB = typeof b.jamKe === 'number' ? b.jamKe : parseInt(String(b.jamKe || 0), 10);
    return jamA - jamB;
  });

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
      {/* KOP RESMI: LOGO YAYASAN DI KIRI & LOGO SEKOLAH DI KANAN */}
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

          {/* TEKS KOP TENGAH */}
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

      {/* JUDUL REKAP JURNAL KELAS */}
      <div className="text-center mb-4">
        <h2 className="text-base sm:text-lg font-bold underline tracking-wide uppercase text-slate-950">
          REKAP JURNAL PEMBELAJARAN KELAS
        </h2>
        <div className="flex justify-between items-center text-xs font-semibold mt-2 px-1 text-slate-800">
          <div>
            <span>Kelas: </span>
            <span className="font-bold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {displayClassName}
            </span>
          </div>
          <div>
            <span>Periode: </span>
            <span className="font-bold">{periodeText}</span>
          </div>
          <div>
            <span>Tahun Ajaran: </span>
            <span className="font-bold">{school.tahunAjaranAktif || '2024/2025'} ({semesterLabel})</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            Ukuran Kertas: <strong>{paperSize === 'F4' ? 'F4 / Folio (330x215mm)' : 'A4 (297x210mm)'}</strong>
          </div>
        </div>
      </div>

      {/* TABEL JURNAL KELAS */}
      <div className="w-full">
        <table
          className="w-full text-left border-collapse text-xs"
          style={{
            border: '1px solid #000000',
            width: '100%',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', color: '#000000' }}>
              <th style={{ border: '1px solid #000000', padding: '8px 4px', textAlign: 'center', width: '36px', fontSize: '10px', fontWeight: 'bold' }}>No</th>
              <th style={{ border: '1px solid #000000', padding: '8px 8px', width: '130px', fontSize: '10px', fontWeight: 'bold' }}>Hari / Tanggal</th>
              <th style={{ border: '1px solid #000000', padding: '8px 4px', textAlign: 'center', width: '60px', fontSize: '10px', fontWeight: 'bold' }}>Jam Ke</th>
              <th style={{ border: '1px solid #000000', padding: '8px 8px', width: isF4 ? '200px' : '170px', fontSize: '10px', fontWeight: 'bold' }}>Mata Pelajaran</th>
              <th style={{ border: '1px solid #000000', padding: '8px 8px', width: isF4 ? '200px' : '170px', fontSize: '10px', fontWeight: 'bold' }}>Nama Guru</th>
              <th style={{ border: '1px solid #000000', padding: '8px 8px', fontSize: '10px', fontWeight: 'bold' }}>Materi Pembelajaran</th>
              <th style={{ border: '1px solid #000000', padding: '8px 8px', textAlign: 'center', width: '110px', fontSize: '10px', fontWeight: 'bold' }}>Kegiatan</th>
              <th style={{ border: '1px solid #000000', padding: '8px 8px', textAlign: 'center', width: '110px', fontSize: '10px', fontWeight: 'bold' }}>Keterangan</th>
              <th style={{ border: '1px solid #000000', padding: '8px 4px', textAlign: 'center', width: '65px', fontSize: '10px', fontWeight: 'bold' }}>Paraf</th>
            </tr>
          </thead>
          <tbody>
            {sortedJournals.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    border: '1px solid #000000',
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontStyle: 'italic',
                  }}
                >
                  Belum ada rekaman jurnal pembelajaran untuk kelas {className || ''} pada periode ini.
                </td>
              </tr>
            ) : (
              sortedJournals.map((j, idx) => {
                const dateInfo = normalizeDateString(j.date);
                let dayName = '-';
                let formattedDate = j.date || '-';
                if (dateInfo) {
                  const dateObj = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day);
                  dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                  formattedDate = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                }

                return (
                  <tr
                    key={j.id}
                    style={{
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfc',
                    }}
                  >
                    <td style={{ border: '1px solid #000000', padding: '8px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold', fontSize: '11px' }}>
                      {idx + 1}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'top' }}>
                      <div className="font-bold text-slate-950 text-[11px] uppercase tracking-tight">{dayName}</div>
                      <div className="text-[10px] text-slate-700 font-medium mt-0.5">{formattedDate}</div>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: '800', fontSize: '12px' }}>
                      {j.jamKe}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <span className="font-bold text-slate-900 text-[11px] leading-tight block">{j.subjectName || 'Pembelajaran'}</span>
                      {isAllClasses && j.classId && (
                        <div className="text-[9px] text-indigo-900 font-extrabold bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 inline-block mt-1 uppercase">
                          Kls: {j.classId}
                        </div>
                      )}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <div className="font-bold text-slate-900 text-[11px] leading-tight">{j.teacherName}</div>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <p className="text-slate-950 text-[11px] leading-[1.3] font-medium">{j.materi}</p>
                      {j.catatan && (
                        <p className="text-[10px] text-slate-600 italic mt-1 bg-slate-50 p-1 rounded border-l-2 border-slate-300">Catatan: {j.catatan}</p>
                      )}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: '800',
                          backgroundColor: j.jenisKegiatan === 'KBM' ? '#eff6ff' : '#fff7ed',
                          color: j.jenisKegiatan === 'KBM' ? '#1e40af' : '#9a3412',
                          border: `1px solid ${j.jenisKegiatan === 'KBM' ? '#bfdbfe' : '#fed7aa'}`,
                          textTransform: 'uppercase'
                        }}
                      >
                        {j.jenisKegiatan}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: '800',
                          backgroundColor: j.keterangan === 'Tuntas' ? '#f0fdf4' : '#fef2f2',
                          color: j.keterangan === 'Tuntas' ? '#166534' : '#991b1b',
                          border: `1px solid ${j.keterangan === 'Tuntas' ? '#bbf7d0' : '#fecaca'}`,
                          textTransform: 'uppercase'
                        }}
                      >
                        {j.keterangan}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '8px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div className="w-10 h-8 border border-dashed border-slate-300 mx-auto rounded flex items-center justify-center text-[8px] text-slate-300 italic">
                        Paraf
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CATATAN PENGESAHAN */}
      <div className="mt-3 flex justify-end text-[10px] text-slate-500 italic">
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
