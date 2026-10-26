-- ==============================================================================
-- SKRIP INISIALISASI DATABASE SUPABASE - ASISTENGURU
-- ==============================================================================
-- CARA PAKAI DI SUPABASE:
-- 1. Buka Supabase Dashboard: https://supabase.com/dashboard/project/xgrhsebsrhwmcnpjizhx
-- 2. Pilih menu "SQL Editor" di bilah sisi kiri
-- 3. Klik "+ New query"
-- 4. Tempel (Paste) seluruh isi skrip ini ke dalam editor
-- 5. Klik tombol "Run" (atau tekan Ctrl+Enter / Cmd+Enter)
-- 6. Selesai! Tabel database Supabase siap digunakan secara permanen.
-- ==============================================================================

-- 1. TABEL UTAMA PENYIMPANAN DATA DOKUMEN & SINKRONISASI CEPAT (app_data)
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


-- ==============================================================================
-- 2. TABEL-TABEL RELASIONAL TERSTRUKTUR (UNTUK QUERY & REKAP KHUSUS)
-- ==============================================================================

-- A. Tabel Sekolah
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

-- Jalankan ini jika tabel schools sudah ada:
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS enable_geofencing BOOLEAN DEFAULT FALSE;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS geofencing_radius INT DEFAULT 50;
-- ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS lock_attendance_today_only BOOLEAN DEFAULT FALSE;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon full access to schools" ON public.schools;
CREATE POLICY "Anon full access to schools" ON public.schools FOR ALL TO anon USING (true) WITH CHECK (true);

-- B. Tabel Pengguna (Users / Guru / Admin)
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

-- C. Tabel Kelas
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

-- D. Tabel Mata Pelajaran
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

-- E. Tabel Penugasan Guru
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

-- F. Tabel Jurnal Pembelajaran Guru (Per-Kelas)
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

-- G. Tabel Presensi / Absensi Guru
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

-- H. Tabel Permintaan Reset Password
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

-- Aktifkan Realtime Replication untuk sinkronisasi otomatis antar tab & perangkat
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_data;
  EXCEPTION WHEN OTHERS THEN
    -- abaikan jika tabel sudah terdaftar dalam publikasi realtime
    NULL;
  END;
END $$;
