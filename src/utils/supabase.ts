import { createClient } from '@supabase/supabase-js';

// Supabase Project Credentials
export const SUPABASE_CONFIG = {
  url:
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    'https://xgrhsebsrhwmcnpjizhx.supabase.co',
  anonKey:
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncmhzZWJzcmh3bWNucGppemh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2Nzk5NDAsImV4cCI6MjEwODI1NTk0MH0.3icsxBUmzhl4YGoIlgkIfeGDsyQsRrMzVR9LycvogbM',
};

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface SupabaseHealthStatus {
  configured: boolean;
  connected: boolean;
  tableReady: boolean;
  url: string;
  message: string;
  checkedAt: string;
}

/**
 * Memeriksa status koneksi ke Supabase dan ketersediaan tabel app_data
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const result: SupabaseHealthStatus = {
    configured: !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey),
    connected: false,
    tableReady: false,
    url: SUPABASE_CONFIG.url,
    message: 'Memeriksa koneksi...',
    checkedAt: new Date().toISOString(),
  };

  if (!result.configured) {
    result.message = 'Konfigurasi Supabase URL atau Anon Key belum lengkap.';
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('id, updated_at')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('not find the table')) {
        result.connected = true;
        result.tableReady = false;
        result.message = 'Terhubung ke Supabase, namun tabel `app_data` belum dibuat di SQL Editor.';
      } else {
        result.connected = false;
        result.tableReady = false;
        result.message = `Gagal query Supabase: ${error.message}`;
      }
      return result;
    }

    result.connected = true;
    result.tableReady = true;
    result.message = 'Berhasil terhubung ke Supabase! Database cloud aktif dan siap sinkronisasi.';
    return result;
  } catch (err: any) {
    result.connected = false;
    result.tableReady = false;
    result.message = `Koneksi gagal: ${err?.message || 'Network error'}`;
    return result;
  }
}

/**
 * Membaca snapshot data lengkap aplikasi dari tabel app_data di Supabase
 */
export async function fetchAppDataFromSupabase(): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('payload')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.warn('fetchAppDataFromSupabase error:', error.message);
      return null;
    }

    if (data && data.payload && typeof data.payload === 'object') {
      return data.payload;
    }
    return null;
  } catch (err) {
    console.warn('fetchAppDataFromSupabase network exception:', err);
    return null;
  }
}

/**
 * Menyimpan snapshot data lengkap aplikasi ke Supabase (tabel app_data baris 'main')
/**
 * Menyimpan snapshot data lengkap aplikasi ke Supabase (tabel app_data baris 'main')
 * dan secara otomatis menyinkronkan seluruh baris ke tabel-tabel relasional (schools, users, classes, subjects, assignments, journals, attendances)
 */
/**
 * Menyimpan hanya data yayasan dan konfigurasi admin ke Supabase (tabel app_data baris 'main')
 * Gunakan ini untuk memastikan logo dan pesan admin tersimpan permanen tanpa menunggu sinkronisasi penuh.
 */
export async function saveFoundationToSupabase(foundation: any, chatConfig: any, broadcastMsg: any): Promise<boolean> {
  try {
    // Ambil data payload saat ini terlebih dahulu untuk di-merge agar tidak menimpa data lain
    const currentPayload = await fetchAppDataFromSupabase();
    
    // CRITICAL: Jika gagal mengambil data (network error), jangan timpa dengan payload kosong!
    // Ini mencegah terhapusnya data schools/users di tabel snapshot app_data.
    if (!currentPayload) {
      console.warn('saveFoundationToSupabase: Gagal mengambil payload lama, membatalkan simpan langsung ke cloud agar tidak ada data yang hilang.');
      return false;
    }

    const updatedPayload = {
      ...currentPayload,
      foundation,
      adminChatConfig: chatConfig,
      broadcastMessage: broadcastMsg,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('app_data')
      .upsert(
        {
          id: 'main',
          payload: updatedPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    return !error;
  } catch (err) {
    console.warn('saveFoundationToSupabase error:', err);
    return false;
  }
}

export async function saveAppDataToSupabase(payload: any): Promise<boolean> {
  if (!payload || typeof payload !== 'object') return false;

  let appDataSuccess = false;
  try {
    const { error } = await supabase
      .from('app_data')
      .upsert(
        {
          id: 'main',
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (!error) {
      appDataSuccess = true;
    }
  } catch (err) {
    console.warn('saveAppDataToSupabase exception:', err);
  }

  // Sinkronkan juga seluruh tabel relasional terstruktur ke Supabase
  try {
    await syncAllRelationalToSupabase(payload);
  } catch (e) {
    console.warn('syncAllRelationalToSupabase exception:', e);
  }

  return appDataSuccess;
}

/**
 * Menyinkronkan seluruh data ke tabel-tabel relasional terpisah di Supabase
 */
export async function syncAllRelationalToSupabase(payload: any): Promise<void> {
  if (!payload || typeof payload !== 'object') return;

  // 1. Schools
  if (Array.isArray(payload.schools) && payload.schools.length > 0) {
    const schoolsToUpsert = payload.schools.map((s: any) => ({
      id: s.id,
      name: s.name,
      jenjang: s.jenjang,
      npsn: s.npsn || null,
      akreditasi: s.akreditasi || null,
      alamat: s.alamat || null,
      telepon: s.telepon || null,
      email: s.email || null,
      kepala_sekolah: s.kepalaSekolah || null,
      nip_kepala_sekolah: s.nipKepalaSekolah || null,
      waka_kurikulum: s.wakaKurikulum || null,
      nip_waka_kurikulum: s.nipWakaKurikulum || null,
      tahun_ajaran_aktif: s.tahunAjaranAktif || null,
      semester_aktif: s.semesterAktif || null,
      logo_url: s.logoUrl || null,
      signature_config: s.signatureConfig || null,
      latitude: s.latitude || null,
      longitude: s.longitude || null,
      enable_geofencing: s.enableGeofencing || false,
      geofencing_radius: s.geofencingRadius || 50,
      lock_attendance_today_only: s.lockAttendanceTodayOnly || false,
    }));
    await supabase.from('schools').upsert(schoolsToUpsert, { onConflict: 'id' });
  }

  // 2. Users
  if (Array.isArray(payload.users) && payload.users.length > 0) {
    const usersToUpsert = payload.users.map((u: any) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      name: u.name,
      email: u.email || null,
      phone: u.phone || null,
      nip: u.nip || null,
      role: u.role,
      school_id: u.schoolId || null,
      assigned_school_ids: u.assignedSchoolIds || [],
      photo_url: u.photoUrl || null,
      status_aktif: u.statusAktif || 'AKTIF',
      pesan_khusus: u.pesanKhusus || null,
      last_online: u.lastOnline || null,
    }));
    await supabase.from('users').upsert(usersToUpsert, { onConflict: 'id' });
  }

  // 3. Classes
  if (Array.isArray(payload.classes) && payload.classes.length > 0) {
    const classesToUpsert = payload.classes.map((c: any) => ({
      id: c.id,
      school_id: c.schoolId,
      name: c.name,
      tingkat: c.tingkat || 1,
      wali_kelas_id: c.waliKelasId || null,
    }));
    await supabase.from('classes').upsert(classesToUpsert, { onConflict: 'id' });
  }

  // 4. Subjects
  if (Array.isArray(payload.subjects) && payload.subjects.length > 0) {
    const subjectsToUpsert = payload.subjects.map((s: any) => ({
      id: s.id,
      school_id: s.schoolId,
      name: s.name,
      kode: s.kode || null,
      teacher_id: s.teacherId || null,
      class_ids: s.classIds || [],
    }));
    await supabase.from('subjects').upsert(subjectsToUpsert, { onConflict: 'id' });
  }

  // 5. Assignments
  if (Array.isArray(payload.assignments) && payload.assignments.length > 0) {
    const assignmentsToUpsert = payload.assignments.map((a: any) => ({
      id: a.id,
      school_id: a.schoolId,
      teacher_id: a.teacherId,
      teacher_name: a.teacherName || null,
      jabatan: a.jabatan || null,
      roles: a.roles || [],
      assigned_class_ids: a.assignedClassIds || [],
      urutan: a.urutan || 99,
    }));
    await supabase.from('assignments').upsert(assignmentsToUpsert, { onConflict: 'id' });
  }

  // 6. Journals
  if (Array.isArray(payload.journals) && payload.journals.length > 0) {
    const journalsToUpsert = payload.journals.map((j: any) => ({
      id: j.id,
      school_id: j.schoolId,
      class_id: j.classId,
      subject_id: j.subjectId || null,
      subject_name: j.subjectName || null,
      teacher_id: j.teacherId,
      teacher_name: j.teacherName,
      date: (j.date || '').split('T')[0],
      jam_ke: j.jamKe || 1,
      jam_masuk: j.jamMasuk || null,
      jam_keluar: j.jamKeluar || null,
      materi: j.materi,
      catatan: j.catatan || null,
      jenis_kegiatan: j.jenisKegiatan || 'KBM',
    }));
    await supabase.from('journals').upsert(journalsToUpsert, { onConflict: 'id' });
  }

  // 7. Attendances
  if (Array.isArray(payload.attendances) && payload.attendances.length > 0) {
    const attToUpsert = payload.attendances.map((a: any) => ({
      id: a.id,
      school_id: a.schoolId,
      class_id: a.classId || null,
      teacher_id: a.teacherId,
      teacher_name: a.teacherName,
      date: (a.date || '').split('T')[0],
      status: a.status || 'HADIR',
      role_used: a.roleUsed || null,
      jam_ke: a.jamKe || 1,
      jam_masuk: a.jamMasuk || null,
      jam_keluar: a.jamKeluar || null,
      nama_kegiatan: a.namaKegiatan || null,
      keterangan: a.keterangan || null,
    }));
    await supabase.from('attendances').upsert(attToUpsert, { onConflict: 'id' });
  }
}

/**
 * Mengambil jumlah baris masing-masing tabel relasional di Supabase
 */
export async function fetchTableStatsFromSupabase(): Promise<{
  schools: number;
  users: number;
  classes: number;
  subjects: number;
  assignments: number;
  journals: number;
  attendances: number;
}> {
  const stats = {
    schools: 0,
    users: 0,
    classes: 0,
    subjects: 0,
    assignments: 0,
    journals: 0,
    attendances: 0,
  };

  try {
    const tables: (keyof typeof stats)[] = [
      'schools',
      'users',
      'classes',
      'subjects',
      'assignments',
      'journals',
      'attendances',
    ];
    await Promise.all(
      tables.map(async (t) => {
        try {
          const { count } = await supabase
            .from(t)
            .select('*', { count: 'exact', head: true });
          if (typeof count === 'number') {
            stats[t] = count;
          }
        } catch {}
      })
    );
  } catch {}

  return stats;
}

/**
 * Mengambil seluruh data relasional lengkap (schools, users, classes, subjects, assignments, journals, attendances)
 * langsung dari tabel-tabel Supabase
 */
export async function fetchFullRelationalDataFromSupabase(): Promise<{
  schools: any[];
  users: any[];
  classes: any[];
  subjects: any[];
  assignments: any[];
  journals: any[];
  attendances: any[];
} | null> {
  try {
    const [schoolsRes, usersRes, classesRes, subjectsRes, assignmentsRes, journalsRes, attendancesRes] = await Promise.all([
      supabase.from('schools').select('*'),
      supabase.from('users').select('*'),
      supabase.from('classes').select('*'),
      supabase.from('subjects').select('*'),
      supabase.from('assignments').select('*'),
      supabase.from('journals').select('*'),
      supabase.from('attendances').select('*'),
    ]);

    if (schoolsRes.data && schoolsRes.data.length > 0) {
      const schools = schoolsRes.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        jenjang: s.jenjang,
        npsn: s.npsn || null,
        akreditasi: s.akreditasi || null,
        alamat: s.alamat || null,
        telepon: s.telepon || null,
        email: s.email || null,
        kepalaSekolah: s.kepala_sekolah || null,
        nipKepalaSekolah: s.nip_kepala_sekolah || null,
        wakaKurikulum: s.waka_kurikulum || null,
        nipWakaKurikulum: s.nip_waka_kurikulum || null,
        tahunAjaranAktif: s.tahun_ajaran_aktif || null,
        semesterAktif: s.semester_aktif || null,
        logoUrl: s.logo_url || null,
        signatureConfig: s.signature_config || null,
        latitude: s.latitude || null,
        longitude: s.longitude || null,
        enableGeofencing: s.enable_geofencing || false,
        geofencingRadius: s.geofencing_radius || 50,
        lockAttendanceTodayOnly: s.lock_attendance_today_only || false,
      }));

      const users = (usersRes.data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        password: u.password,
        name: u.name,
        email: u.email || null,
        phone: u.phone || null,
        nip: u.nip || null,
        role: u.role,
        schoolId: u.school_id || null,
        assignedSchoolIds: u.assigned_school_ids || [],
        photoUrl: u.photo_url || null,
        statusAktif: u.status_aktif || 'AKTIF',
        pesanKhusus: u.pesan_khusus || null,
        lastOnline: u.last_online || null,
      }));

      const classes = (classesRes.data || []).map((c: any) => ({
        id: c.id,
        schoolId: c.school_id,
        name: c.name,
        tingkat: c.tingkat || 1,
        waliKelasId: c.wali_kelas_id || null,
      }));

      const subjects = (subjectsRes.data || []).map((s: any) => ({
        id: s.id,
        schoolId: s.school_id,
        name: s.name,
        kode: s.kode || null,
        teacherId: s.teacher_id || null,
        classIds: s.class_ids || [],
      }));

      const assignments = (assignmentsRes.data || []).map((a: any) => ({
        id: a.id,
        schoolId: a.school_id,
        teacherId: a.teacher_id,
        teacherName: a.teacher_name || null,
        jabatan: a.jabatan || null,
        roles: a.roles || [],
        assignedClassIds: a.assigned_class_ids || [],
        urutan: a.urutan || 99,
      }));

      const journals = (journalsRes.data || []).map((j: any) => ({
        id: j.id,
        schoolId: j.school_id,
        classId: j.class_id,
        subjectId: j.subject_id || null,
        subjectName: j.subject_name || null,
        teacherId: j.teacher_id,
        teacherName: j.teacher_name,
        date: j.date,
        jamKe: j.jam_ke || 1,
        jamMasuk: j.jam_masuk || null,
        jamKeluar: j.jam_keluar || null,
        materi: j.materi,
        catatan: j.catatan || null,
        jenisKegiatan: j.jenis_kegiatan || 'KBM',
      }));

      const attendances = (attendancesRes.data || []).map((a: any) => ({
        id: a.id,
        schoolId: a.school_id,
        classId: a.class_id || null,
        teacherId: a.teacher_id,
        teacherName: a.teacher_name,
        date: a.date,
        status: a.status || 'HADIR',
        roleUsed: a.role_used || null,
        jamKe: a.jam_ke || 1,
        jamMasuk: a.jam_masuk || null,
        jamKeluar: a.jam_keluar || null,
        namaKegiatan: a.nama_kegiatan || null,
        keterangan: a.keterangan || null,
      }));

      return {
        schools,
        users,
        classes,
        subjects,
        assignments,
        journals,
        attendances,
      };
    }
  } catch (err) {
    console.warn('fetchFullRelationalDataFromSupabase error:', err);
  }
  return null;
}


/**
 * Menyimpan satu rekaman presensi langsung ke tabel attendances Supabase
 */
export async function upsertAttendanceToSupabase(entry: any): Promise<boolean> {
  if (!entry || !entry.id) return false;
  try {
    const record = {
      id: entry.id,
      school_id: entry.schoolId,
      class_id: entry.classId || null,
      teacher_id: entry.teacherId,
      teacher_name: entry.teacherName,
      date: (entry.date || '').split('T')[0],
      status: entry.status || 'HADIR',
      role_used: entry.roleUsed || null,
      jam_ke: entry.jamKe || 1,
      jam_masuk: entry.jamMasuk || null,
      jam_keluar: entry.jamKeluar || null,
      nama_kegiatan: entry.namaKegiatan || null,
      keterangan: entry.keterangan || null,
    };
    const { error } = await supabase.from('attendances').upsert(record, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Menghapus satu rekaman presensi dari tabel attendances Supabase
 */
export async function deleteAttendanceFromSupabase(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const { error } = await supabase.from('attendances').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Menyimpan satu rekaman jurnal langsung ke tabel journals Supabase
 */
export async function upsertJournalToSupabase(entry: any): Promise<boolean> {
  if (!entry || !entry.id) return false;
  try {
    const record = {
      id: entry.id,
      school_id: entry.schoolId,
      class_id: entry.classId,
      subject_id: entry.subjectId || null,
      subject_name: entry.subjectName || null,
      teacher_id: entry.teacherId,
      teacher_name: entry.teacherName,
      date: (entry.date || '').split('T')[0],
      jam_ke: entry.jamKe || 1,
      jam_masuk: entry.jamMasuk || null,
      jam_keluar: entry.jamKeluar || null,
      materi: entry.materi,
      catatan: entry.catatan || null,
      jenis_kegiatan: entry.jenisKegiatan || 'KBM',
    };
    const { error } = await supabase.from('journals').upsert(record, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Menghapus satu rekaman jurnal dari tabel journals Supabase
 */
export async function deleteJournalFromSupabase(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const { error } = await supabase.from('journals').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Skrip SQL Supabase lengkap untuk disalin oleh pengguna ke SQL Editor Supabase
 */
export const SUPABASE_SETUP_SQL = `-- 1. TABEL UTAMA PENYIMPANAN DATA DOKUMEN & SINKRONISASI CEPAT (app_data)
CREATE TABLE IF NOT EXISTS public.app_data (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aktifkan Row Level Security (RLS) pada app_data
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- Buat Policy akses penuh untuk pengguna publik / anon dan terautentikasi
DROP POLICY IF EXISTS "Anon full access to app_data" ON public.app_data;
CREATE POLICY "Anon full access to app_data"
  ON public.app_data
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access to app_data" ON public.app_data;
CREATE POLICY "Authenticated full access to app_data"
  ON public.app_data
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert record baris 'main' jika belum ada
INSERT INTO public.app_data (id, payload, updated_at)
VALUES ('main', '{}'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. TABEL-TABEL RELASIONAL TERSTRUKTUR
CREATE TABLE IF NOT EXISTS public.schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  jenjang TEXT NOT NULL,
  npsn TEXT,
  akreditasi TEXT,
  alamat TEXT,
  telepon TEXT,
  email TEXT,
  kepala_sekolah TEXT,
  nip_kepala_sekolah TEXT,
  waka_kurikulum TEXT,
  nip_waka_kurikulum TEXT,
  tahun_ajaran_aktif TEXT,
  semester_aktif TEXT,
  logo_url TEXT,
  signature_config JSONB,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  enable_geofencing BOOLEAN DEFAULT FALSE,
  geofencing_radius INT DEFAULT 50,
  lock_attendance_today_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to schools" ON public.schools;
CREATE POLICY "Anon full access to schools" ON public.schools FOR ALL TO anon USING (true) WITH CHECK (true);

-- Jalankan ini jika tabel schools sudah ada:
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS enable_geofencing BOOLEAN DEFAULT FALSE;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS geofencing_radius INT DEFAULT 50;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS lock_attendance_today_only BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nip TEXT,
  role TEXT NOT NULL,
  school_id TEXT,
  assigned_school_ids TEXT[],
  photo_url TEXT,
  status_aktif TEXT DEFAULT 'AKTIF',
  pesan_khusus TEXT,
  last_online TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to users" ON public.users;
CREATE POLICY "Anon full access to users" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tingkat INT DEFAULT 1,
  wali_kelas_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to classes" ON public.classes;
CREATE POLICY "Anon full access to classes" ON public.classes FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kode TEXT,
  teacher_id TEXT,
  class_ids TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to subjects" ON public.subjects;
CREATE POLICY "Anon full access to subjects" ON public.subjects FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT,
  jabatan TEXT,
  roles TEXT[],
  assigned_class_ids TEXT[],
  urutan INT DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to assignments" ON public.assignments;
CREATE POLICY "Anon full access to assignments" ON public.assignments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.journals (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  subject_id TEXT,
  subject_name TEXT,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  date DATE NOT NULL,
  jam_ke INT DEFAULT 1,
  jam_masuk TEXT,
  jam_keluar TEXT,
  materi TEXT NOT NULL,
  catatan TEXT,
  jenis_kegiatan TEXT DEFAULT 'KBM',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to journals" ON public.journals;
CREATE POLICY "Anon full access to journals" ON public.journals FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.attendances (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  class_id TEXT,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'HADIR',
  role_used TEXT,
  jam_ke INT DEFAULT 1,
  jam_masuk TEXT,
  jam_keluar TEXT,
  nama_kegiatan TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to attendances" ON public.attendances;
CREATE POLICY "Anon full access to attendances" ON public.attendances FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  user_name TEXT,
  school_id TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.reset_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to reset_requests" ON public.reset_requests;
CREATE POLICY "Anon full access to reset_requests" ON public.reset_requests FOR ALL TO anon USING (true) WITH CHECK (true);
`;
