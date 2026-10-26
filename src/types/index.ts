export type UserRole = 'ADMIN_YAYASAN' | 'ADMIN_SEKOLAH' | 'GURU' | 'KEPALA_SEKOLAH';

export type TeacherRoleType = 
  | 'GURU_BIDANG_STUDI' 
  | 'GURU_BANTU' 
  | 'GURU_DINIYAH'
  | 'KOORDINATOR_KOKURIKULER'
  | 'PEMBINA_EKSTRAKURIKULER';

export type HierarchyJabatan = 
  | 'KEPALA_SEKOLAH' 
  | 'WAKA_KURIKULUM' 
  | 'WAKA_KESISWAAN' 
  | 'KOORDINATOR_KOKURIKULER'
  | 'PEMBINA_EKSTRAKURIKULER'
  | 'WALI_KELAS' 
  | 'GURU_KELAS' 
  | 'GURU_BIDANG_STUDI'
  | 'GURU_BANTU'
  | 'GURU_DINIYAH'
  | 'GURU';

export type JenjangSekolah = 'PAUD' | 'TK' | 'SD' | 'MI' | 'SMP' | 'MTs' | 'SMA' | 'MA' | 'SMK' | 'DINIYAH';

export type Akreditasi = 'A (Unggul)' | 'B (Baik)' | 'C (Cukup)' | 'Belum Terakreditasi';

export interface DocumentSignatureConfig {
  tampilkanTandaTangan: boolean; // Jika false, mode cetak tanpa tanda tangan
  pakaiTanggal?: boolean; // Pilihan admin: pakai tanggal otomatis apa tidak
  tanggalManual?: string; // Tanggal dokumen (otomatis hari ini atau custom)
  pihak1Aktif: boolean;
  pihak1Label: string; // Misal: "Mengetahui,"
  pihak1Jabatan: string; // Misal: "Kepala Sekolah"
  pihak1Nama: string;
  pihak1Nip?: string;
  pihak2Aktif: boolean;
  pihak2Label: string; // Misal: "Disahkan di Riau,"
  pihak2Jabatan: string; // Misal: "Waka Kurikulum / Wali Kelas"
  pihak2Nama: string;
  pihak2Nip?: string;
  lokasiKota: string; // Misal: "Riau"
}

export interface School {
  id: string;
  name: string;
  jenjang: JenjangSekolah;
  npsn: string;
  akreditasi: Akreditasi;
  alamat: string;
  telepon: string;
  email: string;
  logoUrl?: string;
  kepalaSekolah: string;
  nipKepalaSekolah?: string;
  wakaKurikulum?: string;
  nipWakaKurikulum?: string;
  wakaKesiswaan?: string;
  nipWakaKesiswaan?: string;
  tahunAjaranAktif: string; // e.g. "2025/2026"
  semesterAktif: 'Ganjil' | 'Genap';
  foundationName: string;
  latitude?: number; // Koordinat Lintang sekolah
  longitude?: number; // Koordinat Bujur sekolah
  enableGeofencing?: boolean; // Status aktifasi pembatasan jarak absen
  geofencingRadius?: number; // Jarak radius pembatasan dalam meter (misal: 50, 100)
  lockAttendanceTodayOnly?: boolean; // Fitur kunci absen hanya tanggal hari berjalan (otomatis)
  signatureConfig?: DocumentSignatureConfig;
}

export interface User {
  id: string;
  username: string;
  password?: string; // Plaintext or Salted Hash
  passwordHash?: string; // Strong PBKDF2/SHA-256 salted hash
  salt?: string; // Salt for cryptographic verification
  name: string;
  email: string;
  phone?: string;
  nip?: string;
  role: UserRole;
  schoolId?: string; // For ADMIN_SEKOLAH or KEPALA_SEKOLAH
  assignedSchoolIds?: string[]; // For GURU: schools where teacher is assigned by yayasan
  isLocked?: boolean;
  statusAktif?: 'AKTIF' | 'NONAKTIF'; // Status aktif akun (bisa dinonaktifkan oleh Admin Yayasan)
  pesanKhusus?: string; // Pesan manual dari admin yayasan khusus untuk akun ini
  lastOnline?: string; // Waktu terakhir aktif / online (ISO String)
  photoUrl?: string; // Foto guru yang diupload yayasan
  avatar?: string;
}

export interface AdminChatConfig {
  whatsappNumber: string; // Nomor WhatsApp Admin Yayasan (misal 08117000111)
  chatPromptText: string; // Teks pengantar chat admin
  waTemplateMessage: string; // Template teks awalan saat chat WA dibuka
}

export interface BroadcastMessage {
  pesanPusat: string; // Pesan manual admin pusat untuk pengguna (termasuk yang dinonaktifkan)
  judulPesan?: string;
  updatedAt?: string;
}

export interface TeacherAssignment {
  id: string;
  teacherId: string;
  schoolId: string;
  roles: TeacherRoleType[]; // Special for SD: can select more than one
  jabatan: HierarchyJabatan;
  customJabatan?: string;
  urutan: number; // Hierarki urutan cetak
  assignedClassIds: string[]; // classes assigned
  waliKelasDiKelasId?: string; // if wali kelas
  namaKokurikuler?: string; // e.g. "Projek P5 (Kearifan Lokal)"
  namaEkstrakurikuler?: string; // e.g. "Pramuka", "Tahfidz Club", "PMR"
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string; // e.g. "Kelas 1A", "Kelas 2B", "Kelas 7A"
  tingkat: number; // 1, 2, 3, etc.
  waliKelasId?: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string; // e.g. "Matematika", "Pendidikan Agama Islam", "Tahfidz"
  code?: string;
  teacherId: string; // Assigned teacher
  classIds?: string[]; // which classes take this subject
}

export type JenisKegiatan = 
  | 'KBM' 
  | 'Asesmen' 
  | 'Pendampingan' 
  | 'Bimbingan Diniyah' 
  | 'Praktik Ibadah' 
  | 'Tahsin' 
  | 'Tahfidz' 
  | 'UH' 
  | 'PTS' 
  | 'PAS' 
  | 'REMEDIAL' 
  | 'PRAKTIK';

export type KeteranganJurnal = 'Tuntas' | 'Belum Tuntas' | 'Terkendala';

export interface ClassJournalEntry {
  id: string;
  schoolId: string;
  classId: string; // Diisi dan dicetak per-kelas
  teacherId: string;
  teacherName: string;
  teacherRole?: TeacherRoleType; // 'GURU_BIDANG_STUDI' | 'GURU_BANTU' | 'GURU_DINIYAH'
  date: string; // YYYY-MM-DD
  jamKe: number; // 1, 2, 3, 4, ...
  subjectId: string;
  subjectName: string;
  materi: string;
  jenisKegiatan: JenisKegiatan;
  keterangan: KeteranganJurnal;
  catatan?: string;
  createdAt: string;
}

export interface TeacherAttendanceEntry {
  id: string;
  schoolId: string;
  classId?: string; // Wajib terisi untuk KBM / Guru Bidang Studi / Guru Bantu / Diniyah (Per-kelas). Opsional untuk Kokurikuler & Ekstrakurikuler (Per-sekolah).
  teacherId: string;
  teacherName: string;
  roleUsed: TeacherRoleType; // 'GURU_BIDANG_STUDI' | 'GURU_BANTU' | 'GURU_DINIYAH' | 'KOORDINATOR_KOKURIKULER' | 'PEMBINA_EKSTRAKURIKULER'
  date: string; // YYYY-MM-DD
  jamMasuk: string; // e.g. "07:30"
  jamKeluar: string; // e.g. "09:00"
  timeRangeFormatted?: string; // e.g. "07:30-09:00"
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALFA';
  keterangan?: string;
  namaKegiatan?: string; // e.g. "Latihan Pramuka", "Projek P5 Tema Kearifan Lokal"
  materiKegiatan?: string; // Agenda atau materi pelaksanaan
  jumlahPeserta?: string; // e.g. "32 Siswa"
  createdAt: string;
}

export interface FoundationInfo {
  name: string;
  tagline: string;
  ketuaYayasan: string;
  alamat: string;
  telepon: string;
  email: string;
  logoYayasanUrl?: string;
  logoAppUrl?: string;
  kutipanLucu?: string;
  kutipanAuthor?: string;
}

export type RekapFilterType = 'HARIAN' | 'BULANAN' | 'TAHUNAN';
export type PaperSize = 'A4' | 'F4';

export type DokumenCetakType = 
  | 'DAFTAR_HADIR_GURU' 
  | 'DAFTAR_HADIR_GURU_BANTU' 
  | 'DAFTAR_HADIR_GURU_DINIYAH' 
  | 'DAFTAR_HADIR_KOKURIKULER'
  | 'DAFTAR_HADIR_EKSTRAKURIKULER'
  | 'JURNAL_KELAS';

export interface PasswordResetRequest {
  id: string;
  userId?: string;
  username: string;
  name?: string;
  role?: UserRole;
  schoolName?: string;
  notes?: string;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  resolvedAt?: string;
}
