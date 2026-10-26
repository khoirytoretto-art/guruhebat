import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://xgrhsebsrhwmcnpjizhx.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncmhzZWJzcmh3bWNucGppemh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2Nzk5NDAsImV4cCI6MjEwODI1NTk0MH0.3icsxBUmzhl4YGoIlgkIfeGDsyQsRrMzVR9LycvogbM';

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let isSupabaseTableReady = false;

async function checkSupabaseStatus() {
  try {
    const { data, error } = await supabaseServer
      .from('app_data')
      .select('id, updated_at')
      .limit(1);

    if (!error) {
      isSupabaseTableReady = true;
      return {
        configured: true,
        connected: true,
        tableReady: true,
        message: 'Supabase cloud terhubung dan tabel app_data siap.',
      };
    }

    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      isSupabaseTableReady = false;
      return {
        configured: true,
        connected: true,
        tableReady: false,
        message: 'Terhubung ke Supabase, namun tabel `app_data` belum dibuat di SQL Editor.',
      };
    }

    return {
      configured: true,
      connected: false,
      tableReady: false,
      message: error.message,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      tableReady: false,
      message: err?.message || 'Connection error',
    };
  }
}

async function syncToSupabaseCloud(data: any) {
  if (!data || typeof data !== 'object') return false;

  try {
    const { error } = await supabaseServer.from('app_data').upsert(
      {
        id: 'main',
        payload: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (!error) {
      isSupabaseTableReady = true;
    }
  } catch (err) {
    console.warn('[Supabase Server] app_data sync error:', err);
  }

  // Sinkronkan seluruh tabel relasional terstruktur ke Supabase
  try {
    if (Array.isArray(data.schools) && data.schools.length > 0) {
      const schoolsToUpsert = data.schools.map((s: any) => ({
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
      await supabaseServer.from('schools').upsert(schoolsToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      const usersToUpsert = data.users.map((u: any) => ({
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
      await supabaseServer.from('users').upsert(usersToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(data.classes) && data.classes.length > 0) {
      const classesToUpsert = data.classes.map((c: any) => ({
        id: c.id,
        school_id: c.schoolId,
        name: c.name,
        tingkat: c.tingkat || 1,
        wali_kelas_id: c.waliKelasId || null,
      }));
      await supabaseServer.from('classes').upsert(classesToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(data.subjects) && data.subjects.length > 0) {
      const subjectsToUpsert = data.subjects.map((s: any) => ({
        id: s.id,
        school_id: s.schoolId,
        name: s.name,
        kode: s.kode || null,
        teacher_id: s.teacherId || null,
        class_ids: s.classIds || [],
      }));
      await supabaseServer.from('subjects').upsert(subjectsToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(data.assignments) && data.assignments.length > 0) {
      const assignmentsToUpsert = data.assignments.map((a: any) => ({
        id: a.id,
        school_id: a.schoolId,
        teacher_id: a.teacherId,
        teacher_name: a.teacherName || null,
        jabatan: a.jabatan || null,
        roles: a.roles || [],
        assigned_class_ids: a.assignedClassIds || [],
        urutan: a.urutan || 99,
      }));
      await supabaseServer.from('assignments').upsert(assignmentsToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(data.journals) && data.journals.length > 0) {
      const journalsToUpsert = data.journals.map((j: any) => ({
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
      await supabaseServer.from('journals').upsert(journalsToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(data.attendances) && data.attendances.length > 0) {
      const attToUpsert = data.attendances.map((a: any) => ({
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
      await supabaseServer.from('attendances').upsert(attToUpsert, { onConflict: 'id' });
    }

    console.log('[Supabase Server] Seluruh tabel relasional berhasil disinkronkan ke cloud!');
    return true;
  } catch (err) {
    console.warn('[Supabase Server] Relational sync error:', err);
    return false;
  }
}

async function syncFromSupabaseCloud() {
  try {
    const { data, error } = await supabaseServer
      .from('app_data')
      .select('payload')
      .eq('id', 'main')
      .maybeSingle();

    if (!error && data?.payload && Object.keys(data.payload).length > 0) {
      console.log('[Supabase Server] Snapshot data dipulihkan dari Supabase cloud!');
      return data.payload;
    }
  } catch (err) {
    console.warn('[Supabase Server] Gagal load dari cloud:', err);
  }
  return null;
}

const CLASS_ID_MAPPINGS: Record<string, string> = {
  // SD IT mappings
  'class-1791863472104': 'class-1792254260221', // Kelas 1 -> 1
  'class-1791863490831': 'class-1792254265056', // Kelas 2 -> 2
  // SMP IT mappings
  'class-1791863974635': 'class-1792255708602', // VII A -> VII-A
  'class-1791863987740': 'class-1792255716293', // VII B -> VII-B
  'class-1791864003058': 'class-1792255716293', // VII B -> VII-B
  'class-1791864006775': 'class-1792255742330', // VIII A -> VIII-A
  'class-1791864016698': 'class-1792255742330', // VIII A -> VIII-A
  'class-1791864016245': 'class-1792255751594', // VIII B -> VIII-B
  'class-1791864030610': 'class-1792255751594', // VIII B -> VIII-B
  'class-1791864030121': 'class-1792255763208', // IX A -> IX-A
  'class-1791864041762': 'class-1792255763208', // IX A -> IX-A
  'class-1791864037531': 'class-1792255772326', // IX B -> IX-B
  'class-1791864052329': 'class-1792255772326', // IX B -> IX-B
  // SMA IT mappings
  'class-1791864084404': 'class-1792257653360', // X -> X
};

const SCHOOL_ID_MAPPINGS: Record<string, string> = {
  'school-1791863112941': 'school-1792252027826', // Old SD -> New SD
  'school-1791863155621': 'school-1792252068779', // Old SMP -> New SMP
  'school-1791863224916': 'school-1792252179195', // Old SMA -> New SMA
};

function canonicalizeSchoolId(schoolId?: string): string {
  if (!schoolId) return '';
  return SCHOOL_ID_MAPPINGS[schoolId] || schoolId;
}

function canonicalizeClassId(schoolId?: string, classId?: string): string {
  if (!classId) return '';
  if (classId === 'persekolah') return 'persekolah';
  if (CLASS_ID_MAPPINGS[classId]) return CLASS_ID_MAPPINGS[classId];
  
  const effSchoolId = canonicalizeSchoolId(schoolId);
  if (effSchoolId === 'school-1792252068779' && classId === 'class-1792254260221') {
    return 'class-1792255708602'; // SMP VII-A
  }
  if (effSchoolId === 'school-1792252179195' && classId !== 'persekolah') {
    return 'class-1792257653360'; // SMA Kelas X
  }
  return classId;
}


async function loadAllFromSupabaseTables() {
  try {
    const [schoolsRes, usersRes, classesRes, subjectsRes, assignmentsRes, journalsRes, attendancesRes] = await Promise.all([
      supabaseServer.from('schools').select('*'),
      supabaseServer.from('users').select('*'),
      supabaseServer.from('classes').select('*'),
      supabaseServer.from('subjects').select('*'),
      supabaseServer.from('assignments').select('*'),
      supabaseServer.from('journals').select('*'),
      supabaseServer.from('attendances').select('*'),
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
        schoolId: canonicalizeSchoolId(u.school_id) || null,
        assignedSchoolIds: u.assigned_school_ids || [],
        photoUrl: u.photo_url || null,
        statusAktif: u.status_aktif || 'AKTIF',
        pesanKhusus: u.pesan_khusus || null,
        lastOnline: u.last_online || null,
      }));

      const classes = (classesRes.data || []).map((c: any) => ({
        id: c.id,
        schoolId: canonicalizeSchoolId(c.school_id),
        name: c.name,
        tingkat: c.tingkat || 1,
        waliKelasId: c.wali_kelas_id || null,
      }));

      const subjects = (subjectsRes.data || []).map((s: any) => ({
        id: s.id,
        schoolId: canonicalizeSchoolId(s.school_id),
        name: s.name,
        teacherId: s.teacher_id || null,
        classIds: s.class_ids || [],
      }));

      const assignments = (assignmentsRes.data || []).map((a: any) => ({
        id: a.id,
        schoolId: canonicalizeSchoolId(a.school_id),
        teacherId: a.teacher_id,
        teacherName: a.teacher_name || null,
        jabatan: a.jabatan || null,
        roles: a.roles || [],
        assignedClassIds: a.assigned_class_ids || [],
        urutan: a.urutan || 99,
      }));

      const journals = (journalsRes.data || []).map((j: any) => ({
        id: j.id,
        schoolId: canonicalizeSchoolId(j.school_id),
        classId: canonicalizeClassId(j.school_id, j.class_id),
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
        schoolId: canonicalizeSchoolId(a.school_id),
        classId: canonicalizeClassId(a.school_id, a.class_id),
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
    console.warn('[Supabase Server] Gagal load dari tabel relasional:', err);
  }
  return null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const val = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  if (process.env.PORT) {
    const val = parseInt(process.env.PORT, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 3000;
}

function getHost(): string {
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1] && !process.argv[hostArgIndex + 1].startsWith('-')) {
    return process.argv[hostArgIndex + 1];
  }
  return process.env.HOST || '0.0.0.0';
}

const PORT = getPort();
const HOST = getHost();
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'app-data.json');

// Canonical Foundation Seed Data
const INITIAL_DATA = {
  foundation: {
    name: 'Yayasan Walisongo Rumbai Jaya',
    tagline: 'Mencerdaskan Generasi Berakhlak Qurani, Mandiri, dan Unggul',
    ketuaYayasan: 'Drs. H. M. Rasyid Al-Banjari, M.Si',
    alamat: 'Jl. Rumbai No. 45, Kompleks Pendidikan Yayasan Walisongo, Riau',
    telepon: '(0761) 883921 / 0811-7000-111',
    email: 'pphmrumbaijaya@gmail.com',
    logoYayasanUrl: '',
    logoAppUrl: '',
    kutipanLucu: 'Mendidik itu seni menahan tawa saat murid salah jawab dengan ekspresi paling serius, dan seni tersenyum saat akhir bulan saldo tetap syahdu!',
    kutipanAuthor: 'Pengurus Yayasan Pusat',
  },
  schools: [],
  users: [
    {
      id: 'user-yayasan',
      username: 'yayasan',
      password: '123',
      name: 'Admin Yayasan Walisongo Rumbai Jaya',
      email: 'pphmrumbaijaya@gmail.com',
      phone: '0811-7000-111',
      role: 'ADMIN_YAYASAN',
      statusAktif: 'AKTIF',
    },
  ],
  classes: [],
  subjects: [],
  assignments: [],
  journals: [],
  attendances: [],
  resetRequests: [],
  adminChatConfig: {
    whatsappNumber: '08117000111',
    chatPromptText: 'Ada kendala atau perlu konsultasi teknis? Hubungi admin yayasan untuk bantuan sistem.',
    waTemplateMessage: 'Halo Admin Yayasan, saya memerlukan bantuan teknis aplikasi AsistenGuru.',
  },
  broadcastMessage: {
    judulPesan: 'Pemberitahuan Resmi Dari Admin Pusat Yayasan',
    pesanPusat: 'Mohon maaf, akun Anda sedang dinonaktifkan sementara oleh Admin Pusat Yayasan. Untuk konfirmasi atau pertanyaan lebih lanjut, silakan hubungi admin yayasan melalui WhatsApp.',
    updatedAt: new Date().toISOString(),
  },
};

const PURGED_DUMMY_IDS = new Set([
  'school-paud',
  'school-1791651063697',
  'school-1791651125928',
  'school-1791651181721',
  'school-sd',
  'school-smp',
  'school-tk',
  'class-sd-1a',
  'class-sd-1b',
  'class-sd-2a',
  'class-sd-3a',
  'class-smp-7a',
  'class-smp-8a',
  'class-tk-a',
  'class-tk-b',
  'class-paud-1',
  'user-admin-diniyah',
  'att-koku-1791647273261',
  'att-1',
  'jnl-1',
  'jnl-2',
]);

const BACKUP_FILE = path.resolve(DATA_DIR, 'app-data.backup.json');

// Helper to write files atomically to prevent file corruption
function safeWriteFileSync(filePath: string, content: string) {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// Ensure data folder and file exists with data sanitization & fallback recovery
function loadStoredData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let raw = '';
    if (fs.existsSync(DATA_FILE)) {
      try {
        raw = fs.readFileSync(DATA_FILE, 'utf-8');
      } catch (err) {
        console.warn('Failed to read primary DATA_FILE, attempting backup...', err);
      }
    }

    if (!raw && fs.existsSync(BACKUP_FILE)) {
      try {
        raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
        console.log('Recovered data successfully from BACKUP_FILE');
      } catch (err) {
        console.error('Failed to read BACKUP_FILE:', err);
      }
    }

    if (raw && raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);

      const baseFoundation = { ...INITIAL_DATA.foundation, ...(parsed.foundation || {}) };

      const deletedIds = new Set<string>(Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []);

      const savedSchools: any[] = (Array.isArray(parsed.schools) && parsed.schools.length > 0 ? parsed.schools : [...INITIAL_DATA.schools])
        .filter((s: any) => s && s.id && !PURGED_DUMMY_IDS.has(s.id) && !deletedIds.has(s.id));

      const sanitizedSchools = savedSchools.map((s) => ({
        ...s,
        foundationName: baseFoundation.name,
      }));

      const savedUsers: any[] = (Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...INITIAL_DATA.users])
        .filter((u: any) => u && u.id && !PURGED_DUMMY_IDS.has(u.id) && !deletedIds.has(u.id));

      // Keep all classes, subjects, assignments, journals, attendances safe
      const savedClasses: any[] = (Array.isArray(parsed.classes) ? parsed.classes : [...INITIAL_DATA.classes])
        .filter((c: any) => c && c.id && !PURGED_DUMMY_IDS.has(c.id) && !deletedIds.has(c.id));

      const savedSubjects: any[] = (Array.isArray(parsed.subjects) ? parsed.subjects : [...INITIAL_DATA.subjects])
        .filter((s: any) => s && s.id && !PURGED_DUMMY_IDS.has(s.id) && !deletedIds.has(s.id));

      const savedAssignments: any[] = (Array.isArray(parsed.assignments) ? parsed.assignments : [...INITIAL_DATA.assignments])
        .filter((a: any) => a && a.id && !PURGED_DUMMY_IDS.has(a.id) && !deletedIds.has(a.id));

      const savedJournals: any[] = (Array.isArray(parsed.journals) ? parsed.journals : [])
        .filter((j: any) => j && j.id && !PURGED_DUMMY_IDS.has(j.id) && !deletedIds.has(j.id))
        .map((j: any) => ({ ...j, classId: canonicalizeClassId(j.schoolId, j.classId) }));

      const savedAttendances: any[] = (Array.isArray(parsed.attendances) ? parsed.attendances : [])
        .filter((a: any) => a && a.id && !PURGED_DUMMY_IDS.has(a.id) && !deletedIds.has(a.id))
        .map((a: any) => ({ ...a, classId: canonicalizeClassId(a.schoolId, a.classId) }));

      const mergedData = {
        ...INITIAL_DATA,
        ...parsed,
        deletedIds: Array.from(deletedIds),
        foundation: baseFoundation,
        schools: sanitizedSchools,
        users: savedUsers,
        classes: savedClasses,
        subjects: savedSubjects,
        assignments: savedAssignments,
        journals: savedJournals,
        attendances: savedAttendances,
        resetRequests: Array.isArray(parsed.resetRequests) ? parsed.resetRequests : [],
      };

      try {
        safeWriteFileSync(DATA_FILE, JSON.stringify(mergedData, null, 2));
      } catch {}
      return mergedData;
    } else {
      safeWriteFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
      safeWriteFileSync(BACKUP_FILE, JSON.stringify(INITIAL_DATA, null, 2));
      return { ...INITIAL_DATA, deletedIds: [] };
    }
  } catch (err) {
    console.error('Error in loadStoredData, preserving existing files and using fallback:', err);
    return { ...INITIAL_DATA, deletedIds: [] };
  }
}

let dataRevision = Date.now();
let lastModifiedTime = Date.now();

function touchDataRevision() {
  dataRevision = Date.now();
  lastModifiedTime = Date.now();
}

function saveStoredData(data: any, updateRevision = true) {
  if (updateRevision) {
    touchDataRevision();
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(data, null, 2);
    // Write primary file atomically
    safeWriteFileSync(DATA_FILE, serialized);
    // Maintain secondary persistent safety backup atomically
    safeWriteFileSync(BACKUP_FILE, serialized);
    // Asynchronous background sync to Supabase cloud
    syncToSupabaseCloud(data).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error writing data file:', err);
    return false;
  }
}

let saveTimeout: any = null;
function saveStoredDataDebounced(updateRevision = false) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveStoredData(appData, updateRevision);
  }, 300);
}

// Smart collection merger by ID so concurrent users NEVER lose data, while respecting tombstones & purged items
function mergeCollection<T extends { id?: string }>(existingList: T[] = [], incomingList: T[] = [], deletedSet?: Set<string>): T[] {
  const map = new Map<string, T>();
  (existingList || []).forEach((item) => {
    if (item && item.id && !PURGED_DUMMY_IDS.has(item.id) && (!deletedSet || !deletedSet.has(item.id))) {
      map.set(item.id, item);
    }
  });
  (incomingList || []).forEach((item) => {
    if (item && item.id && !PURGED_DUMMY_IDS.has(item.id) && (!deletedSet || !deletedSet.has(item.id))) {
      const prev = map.get(item.id);
      map.set(item.id, prev ? { ...prev, ...item } : item);
    }
  });
  return Array.from(map.values());
}

// Smart merger khusus data Users (menjaga lastOnline terbaru dan status aktif, menghormati ID terhapus)
function mergeUsers(existingList: any[] = [], incomingList: any[] = [], deletedSet?: Set<string>): any[] {
  const map = new Map<string, any>();
  (existingList || []).forEach((u) => {
    if (u && u.id && !PURGED_DUMMY_IDS.has(u.id) && (!deletedSet || !deletedSet.has(u.id))) {
      map.set(u.id, u);
    }
  });

  (incomingList || []).forEach((u) => {
    if (u && u.id && !PURGED_DUMMY_IDS.has(u.id) && (!deletedSet || !deletedSet.has(u.id))) {
      const prev = map.get(u.id);
      if (!prev) {
        map.set(u.id, u);
      } else {
        // Ambil waktu lastOnline yang paling baru
        let bestLastOnline = prev.lastOnline;
        if (u.lastOnline) {
          if (!bestLastOnline || new Date(u.lastOnline).getTime() > new Date(bestLastOnline).getTime()) {
            bestLastOnline = u.lastOnline;
          }
        }
        map.set(u.id, {
          ...prev,
          ...u,
          lastOnline: bestLastOnline,
          password: u.password || prev.password,
          passwordHash: u.passwordHash || prev.passwordHash,
          salt: u.salt || prev.salt,
        });
      }
    }
  });
  return Array.from(map.values());
}

function normalizeDateString(dateStr?: string): { year: number; month: number; day: number; formatted: string } | null {
  if (!dateStr) return null;
  const clean = dateStr.split('T')[0].trim().replace(/\//g, '-');
  const rawParts = clean.split('-').map((p) => parseInt(p.trim(), 10));
  if (rawParts.length !== 3 || rawParts.some(isNaN)) return null;

  let y: number, m: number, d: number;
  if (rawParts[0] > 1000) {
    y = rawParts[0];
    m = rawParts[1];
    d = rawParts[2];
  } else if (rawParts[2] > 1000) {
    d = rawParts[0];
    m = rawParts[1];
    y = rawParts[2];
  } else {
    y = rawParts[0];
    m = rawParts[1];
    d = rawParts[2];
  }

  const formatted = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { year: y, month: m, day: d, formatted };
}

// Smart merger khusus data Attendances: dijamin tidak ada data presensi yang hilang
function mergeAttendances(existingList: any[] = [], incomingList: any[] = [], deletedSet?: Set<string>): any[] {
  const map = new Map<string, any>();
  const all = [...(existingList || []), ...(incomingList || [])];
  all.forEach((item) => {
    if (!item || !item.id || PURGED_DUMMY_IDS.has(item.id) || (deletedSet && deletedSet.has(item.id))) return;
    const dateInfo = normalizeDateString(item.date);
    const normDate = dateInfo ? dateInfo.formatted : (item.date || '').split('T')[0].trim();
    const itemWithNorm = {
      ...item,
      date: normDate,
      schoolId: canonicalizeSchoolId(item.schoolId),
      classId: canonicalizeClassId(item.schoolId, item.classId),
    };
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, itemWithNorm);
    } else {
      const prevTime = prev.updatedAt || prev.createdAt ? new Date(prev.updatedAt || prev.createdAt).getTime() : 0;
      const currTime = item.updatedAt || item.createdAt ? new Date(item.updatedAt || item.createdAt).getTime() : 0;
      if (currTime >= prevTime) {
        map.set(item.id, { ...prev, ...itemWithNorm });
      }
    }
  });
  return Array.from(map.values());
}

// Smart merger khusus data Jurnal Pembelajaran: setiap sesi jurnal dijamin tersimpan permanen
function mergeJournals(existingList: any[] = [], incomingList: any[] = [], deletedSet?: Set<string>): any[] {
  const map = new Map<string, any>();
  const all = [...(existingList || []), ...(incomingList || [])];
  all.forEach((item) => {
    if (!item || !item.id || PURGED_DUMMY_IDS.has(item.id) || (deletedSet && deletedSet.has(item.id))) return;
    const dateInfo = normalizeDateString(item.date);
    const normDate = dateInfo ? dateInfo.formatted : (item.date || '').split('T')[0].trim();
    const itemWithNorm = {
      ...item,
      date: normDate,
      schoolId: canonicalizeSchoolId(item.schoolId),
      classId: canonicalizeClassId(item.schoolId, item.classId),
    };
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, itemWithNorm);
    } else {
      const prevTime = prev.updatedAt || prev.createdAt ? new Date(prev.updatedAt || prev.createdAt).getTime() : 0;
      const currTime = item.updatedAt || item.createdAt ? new Date(item.updatedAt || item.createdAt).getTime() : 0;
      if (currTime >= prevTime) {
        map.set(item.id, { ...prev, ...itemWithNorm });
      }
    }
  });
  return Array.from(map.values());
}

// Smart merger khusus data Assignments: satu guru hanya punya satu penugasan unik per sekolah
function mergeAssignments(existingList: any[] = [], incomingList: any[] = [], deletedSet?: Set<string>): any[] {
  const map = new Map<string, any>();
  const all = [...(existingList || []), ...(incomingList || [])];
  all.forEach((item) => {
    if (!item || !item.id || PURGED_DUMMY_IDS.has(item.id) || (deletedSet && deletedSet.has(item.id))) return;
    const logicalKey = `${item.schoolId}_${item.teacherId}`;
    const prev = map.get(logicalKey);
    if (!prev) {
      map.set(logicalKey, item);
    } else {
      const mergedRoles = Array.from(new Set([...(prev.roles || []), ...(item.roles || [])]));
      const mergedClassIds = Array.from(new Set([...(prev.assignedClassIds || []), ...(item.assignedClassIds || [])]));
      map.set(logicalKey, {
        ...prev,
        ...item,
        roles: mergedRoles,
        assignedClassIds: mergedClassIds,
      });
    }
  });
  return Array.from(map.values());
}

let appData = loadStoredData();
// In-memory heartbeat tracker untuk status live online realtime
const activeUserHeartbeats = new Map<string, number>();

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  console.log(`[AsistenGuru Server] Memulai server dalam mode: ${isProd ? 'PRODUKSI' : 'PENGEMBANGAN'}`);
  console.log(`[AsistenGuru Server] Konfigurasi: PORT=${PORT}, HOST=${HOST}, NODE_ENV=${process.env.NODE_ENV}`);

  const app = express();

  // Middleware for JSON parsing with ample size for logos & avatars
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // Health Check routes for Cloud Run & AI Studio Control Plane Probes
  app.get(['/health', '/_health', '/api/health', '/__aistudio_internal_control_plane/dev/status'], (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // --- API ROUTES ---
  // 1. Get entire unified single foundation data (Optimized with ETag / 304 Not Modified)
  app.get('/api/data', (req, res) => {
    const clientEtag = req.headers['if-none-match'];
    const currentEtag = `"${dataRevision}"`;
    if (clientEtag && clientEtag === currentEtag) {
      return res.status(304).end();
    }
    res.setHeader('ETag', currentEtag);
    res.setHeader('X-Data-Revision', String(dataRevision));
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.json({
      ...appData,
      _revision: dataRevision,
      _lastModified: lastModifiedTime,
    });
  });

  // 1b. Lightweight version check endpoint
  app.get('/api/data/version', (_req, res) => {
    res.json({
      revision: dataRevision,
      lastModified: lastModifiedTime,
      totalUsers: appData.users?.length || 0,
      totalSchools: appData.schools?.length || 0,
      totalJournals: appData.journals?.length || 0,
      totalAttendances: appData.attendances?.length || 0,
    });
  });

  // 2. Smart Sync dataset (menggabungkan data, menghormati data terhapus, anti duplikasi)
  app.post('/api/data', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      const body = req.body;
      const currentDeleted = new Set<string>([
        ...PURGED_DUMMY_IDS,
        ...(appData.deletedIds || []),
        ...(Array.isArray(body.deletedIds) ? body.deletedIds : []),
      ]);
      appData.deletedIds = Array.from(currentDeleted);

      appData = {
        ...appData,
        deletedIds: Array.from(currentDeleted),
        // Foundation, Chat Config, and Broadcast are PROTECTED - only updateable via dedicated endpoints
        foundation: appData.foundation, 
        adminChatConfig: appData.adminChatConfig,
        broadcastMessage: appData.broadcastMessage,
        // Other collections are merged normally
        schools: Array.isArray(body.schools) ? mergeCollection(appData.schools, body.schools, currentDeleted) : appData.schools,
        users: Array.isArray(body.users) ? mergeUsers(appData.users, body.users, currentDeleted) : appData.users,
        classes: Array.isArray(body.classes) ? mergeCollection(appData.classes, body.classes, currentDeleted) : appData.classes,
        subjects: Array.isArray(body.subjects) ? mergeCollection(appData.subjects, body.subjects, currentDeleted) : appData.subjects,
        assignments: Array.isArray(body.assignments) ? mergeAssignments(appData.assignments, body.assignments, currentDeleted) : appData.assignments,
        journals: Array.isArray(body.journals) ? mergeJournals(appData.journals, body.journals, currentDeleted) : appData.journals,
        attendances: Array.isArray(body.attendances) ? mergeAttendances(appData.attendances, body.attendances, currentDeleted) : appData.attendances,
        resetRequests: Array.isArray(body.resetRequests) ? mergeCollection(appData.resetRequests, body.resetRequests, currentDeleted) : appData.resetRequests,
      };
      saveStoredData(appData, true);
      res.setHeader('X-Data-Revision', String(dataRevision));
      return res.json({ success: true, revision: dataRevision, message: 'Data berhasil disinkronkan & digabungkan ke server pusat' });
    }
    res.status(400).json({ success: false, message: 'Data tidak valid' });
  });

  // 2a. Endpoint khusus simpan jurnal langsung (instan, terjamin aman & anti duplikasi)
  app.post('/api/journals', (req, res) => {
    const rawIncoming = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
    if (rawIncoming.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data jurnal' });

    // Sanitasi schoolId agar selalu tepat sesuai kelas
    const classes = appData.classes || [];
    const incoming = rawIncoming.map((j: any) => {
      if (j.classId && j.classId !== 'persekolah') {
        const cls = classes.find((c: any) => c.id === j.classId);
        if (cls && cls.schoolId && cls.schoolId !== j.schoolId) {
          return { ...j, schoolId: cls.schoolId };
        }
      }
      return j;
    });

    appData.journals = mergeJournals(appData.journals || [], incoming);
    saveStoredData(appData, true);

    // Sync langsung ke tabel journals di Supabase cloud
    try {
      const journalsToUpsert = incoming.map((j: any) => ({
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
      Promise.resolve(supabaseServer.from('journals').upsert(journalsToUpsert, { onConflict: 'id' })).catch(() => {});
    } catch {}

    return res.json({ success: true, count: appData.journals.length, message: 'Jurnal berhasil disimpan permanen di server pusat & Supabase' });
  });

  app.get('/api/journals', (_req, res) => {
    res.json(appData.journals || []);
  });

  // 2b. Endpoint khusus simpan presensi langsung (instan, terjamin aman & anti duplikasi)
  app.post('/api/attendances', (req, res) => {
    const rawIncoming = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
    if (rawIncoming.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data presensi' });

    // Sanitasi schoolId agar selalu tepat sesuai kelas
    const classes = appData.classes || [];
    const incoming = rawIncoming.map((a: any) => {
      if (a.classId && a.classId !== 'persekolah') {
        const cls = classes.find((c: any) => c.id === a.classId);
        if (cls && cls.schoolId && cls.schoolId !== a.schoolId) {
          return { ...a, schoolId: cls.schoolId };
        }
      }
      return a;
    });

    appData.attendances = mergeAttendances(appData.attendances || [], incoming);
    saveStoredData(appData, true);

    // Sync langsung ke tabel attendances di Supabase cloud
    try {
      const attToUpsert = incoming.map((a: any) => ({
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
      Promise.resolve(supabaseServer.from('attendances').upsert(attToUpsert, { onConflict: 'id' })).catch(() => {});
    } catch {}

    return res.json({ success: true, count: appData.attendances.length, message: 'Presensi berhasil disimpan permanen di server pusat & Supabase' });
  });

  app.get('/api/attendances', (_req, res) => {
    res.json(appData.attendances || []);
  });

  // 2c. Endpoint Heartbeat Online Realtime
  app.post('/api/heartbeat', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'User ID diperlukan' });

    const now = new Date();
    activeUserHeartbeats.set(userId, now.getTime());

    if (Array.isArray(appData.users)) {
      const user = appData.users.find((u: any) => u.id === userId);
      if (user) {
        user.lastOnline = now.toISOString();
      }
    }
    saveStoredDataDebounced(false);
    return res.json({ success: true, userId, lastOnline: now.toISOString() });
  });

  // 2d. Status Live Online Pengguna
  app.get('/api/users/online', (_req, res) => {
    const now = Date.now();
    const activeIds: string[] = [];
    activeUserHeartbeats.forEach((timestamp, uid) => {
      // Dianggap online jika mengirim heartbeat dalam 3 menit terakhir (180,000 ms)
      if (now - timestamp < 180000) {
        activeIds.push(uid);
      }
    });

    const onlineStatuses = (appData.users || []).map((u: any) => {
      const lastActiveTime = activeUserHeartbeats.get(u.id);
      const isOnline = lastActiveTime
        ? (now - lastActiveTime < 180000)
        : (u.lastOnline ? (now - new Date(u.lastOnline).getTime() < 180000) : false);

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        lastOnline: lastActiveTime ? new Date(lastActiveTime).toISOString() : u.lastOnline,
        isOnline,
      };
    });

    return res.json({ success: true, users: onlineStatuses, activeCount: activeIds.length });
  });

  // 2d-2. Update User Status
  app.put('/api/users/:id/status', async (req, res) => {
    const { id } = req.params;
    const { statusAktif, pesanKhusus } = req.body;
    if (Array.isArray(appData.users)) {
      const idx = appData.users.findIndex((u: any) => u.id === id);
      if (idx >= 0) {
        appData.users[idx] = {
          ...appData.users[idx],
          ...(statusAktif ? { statusAktif } : {}),
          ...(pesanKhusus !== undefined ? { pesanKhusus } : {}),
        };
        saveStoredData(appData, true);

        const u = appData.users[idx];
        try {
          await supabaseServer.from('users').upsert({
            id: u.id,
            username: u.username,
            password: u.password || '123',
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
          }, { onConflict: 'id' });
        } catch (sbErr) {
          console.warn('[Supabase User Status Update Error]:', sbErr);
        }

        return res.json({ success: true, user: appData.users[idx] });
      }
    }
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  });

  // 2e. Full restore backup
  app.post('/api/backup/restore', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      appData = {
        ...INITIAL_DATA,
        ...req.body,
      };
      saveStoredData(appData);
      return res.json({ success: true, message: 'Data cadangan berhasil dipulihkan di server pusat' });
    }
    res.status(400).json({ success: false, message: 'Data cadangan tidak valid' });
  });

  // 2f. Dedicated Reset All Data endpoint
  app.post('/api/data/reset-all', async (_req, res) => {
    try {
      appData = {
        ...INITIAL_DATA,
        deletedIds: [],
      };
      touchDataRevision();
      saveStoredData(appData, true);

      // Truncate / delete all rows in Supabase tables
      try {
        await supabaseServer.from('attendances').delete().neq('id', '');
        await supabaseServer.from('journals').delete().neq('id', '');
        await supabaseServer.from('assignments').delete().neq('id', '');
        await supabaseServer.from('classes').delete().neq('id', '');
        await supabaseServer.from('subjects').delete().neq('id', '');
        await supabaseServer.from('reset_requests').delete().neq('id', '');
        await supabaseServer.from('users').delete().neq('id', 'user-yayasan');
        await supabaseServer.from('schools').delete().neq('id', '');
        await supabaseServer.from('app_data').upsert({ id: 'main', payload: appData, updated_at: new Date().toISOString() });
      } catch (sbErr) {
        console.warn('[Supabase Reset Error]:', sbErr);
      }

      return res.json({ success: true, message: 'Seluruh data berhasil di-reset ke kondisi awal (bersih) siap input baru.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Gagal reset data' });
    }
  });

  // 3. Foundation specific routes
  app.get('/api/foundation', (_req, res) => {
    res.json(appData.foundation);
  });

  app.put('/api/foundation', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      appData.foundation = { ...appData.foundation, ...req.body };
      // Sinkronkan nama yayasan ke seluruh sekolah
      if (appData.foundation.name && Array.isArray(appData.schools)) {
        appData.schools = appData.schools.map((s: any) => ({
          ...s,
          foundationName: appData.foundation.name,
        }));
      }
      saveStoredData(appData, true);
      return res.json({ success: true, foundation: appData.foundation });
    }
    res.status(400).json({ success: false, message: 'Data profil yayasan tidak valid' });
  });

  // Dedicated config update endpoint
  app.post('/api/config', (req, res) => {
    const { adminChatConfig, broadcastMessage } = req.body || {};
    let changed = false;
    if (adminChatConfig) {
      appData.adminChatConfig = { ...appData.adminChatConfig, ...adminChatConfig };
      changed = true;
    }
    if (broadcastMessage) {
      appData.broadcastMessage = { ...appData.broadcastMessage, ...broadcastMessage };
      changed = true;
    }
    if (changed) {
      saveStoredData(appData, true);
    }
    res.json({ success: true, adminChatConfig: appData.adminChatConfig, broadcastMessage: appData.broadcastMessage });
  });

  // 4. Schools routes
  app.get('/api/schools', (_req, res) => {
    res.json(appData.schools);
  });

  app.put('/api/schools', (req, res) => {
    if (Array.isArray(req.body)) {
      appData.schools = req.body;
      saveStoredData(appData);
      return res.json({ success: true, schools: appData.schools });
    }
    res.status(400).json({ success: false, message: 'Data sekolah harus berupa array' });
  });

  app.delete('/api/schools/:id', (req, res) => {
    const schoolId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), schoolId]));
    appData.schools = (appData.schools || []).filter((s: any) => s.id !== schoolId);
    appData.assignments = (appData.assignments || []).filter((a: any) => a.schoolId !== schoolId);
    appData.classes = (appData.classes || []).filter((c: any) => c.schoolId !== schoolId);
    appData.subjects = (appData.subjects || []).filter((sub: any) => sub.schoolId !== schoolId);
    appData.journals = (appData.journals || []).filter((j: any) => j.schoolId !== schoolId);
    appData.attendances = (appData.attendances || []).filter((att: any) => att.schoolId !== schoolId);
    appData.users = (appData.users || []).map((u: any) => ({
      ...u,
      assignedSchoolIds: (u.assignedSchoolIds || []).filter((id: string) => id !== schoolId),
      schoolId: u.schoolId === schoolId ? undefined : u.schoolId,
    }));
    saveStoredData(appData);
    return res.json({ success: true, message: `Sekolah ${schoolId} berhasil dihapus permanen` });
  });

  // 5. Users routes
  app.get('/api/users', (_req, res) => {
    res.json(appData.users);
  });

  app.put('/api/users', (req, res) => {
    if (Array.isArray(req.body)) {
      appData.users = req.body;
      saveStoredData(appData);
      return res.json({ success: true, users: appData.users });
    }
    res.status(400).json({ success: false, message: 'Data pengguna harus berupa array' });
  });

  app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), userId]));
    appData.users = (appData.users || []).filter((u: any) => u.id !== userId);
    appData.assignments = (appData.assignments || []).filter((a: any) => a.teacherId !== userId);
    appData.subjects = (appData.subjects || []).filter((s: any) => s.teacherId !== userId);
    appData.journals = (appData.journals || []).filter((j: any) => j.teacherId !== userId);
    appData.attendances = (appData.attendances || []).filter((a: any) => a.teacherId !== userId);
    appData.classes = (appData.classes || []).map((c: any) => c.waliKelasId === userId ? { ...c, waliKelasId: undefined } : c);
    saveStoredData(appData);
    return res.json({ success: true, message: `Pengguna ${userId} berhasil dihapus permanen` });
  });

  // 5b. Classes, Subjects, Assignments, Journals, Attendances delete routes
  app.delete('/api/classes/:id', (req, res) => {
    const classId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), classId]));
    appData.classes = (appData.classes || []).filter((c: any) => c.id !== classId);
    appData.journals = (appData.journals || []).filter((j: any) => j.classId !== classId);
    appData.attendances = (appData.attendances || []).filter((a: any) => a.classId !== classId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Kelas ${classId} berhasil dihapus` });
  });

  app.delete('/api/subjects/:id', (req, res) => {
    const subjId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), subjId]));
    appData.subjects = (appData.subjects || []).filter((s: any) => s.id !== subjId);
    appData.journals = (appData.journals || []).filter((j: any) => j.subjectId !== subjId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Mapel ${subjId} berhasil dihapus` });
  });

  app.delete('/api/assignments/:id', (req, res) => {
    const asgId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), asgId]));
    appData.assignments = (appData.assignments || []).filter((a: any) => a.id !== asgId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Penugasan ${asgId} berhasil dihapus` });
  });

  app.delete('/api/journals/:id', (req, res) => {
    const jId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), jId]));
    appData.journals = (appData.journals || []).filter((j: any) => j.id !== jId);
    saveStoredData(appData);
    Promise.resolve(supabaseServer.from('journals').delete().eq('id', jId)).catch(() => {});
    return res.json({ success: true, message: `Jurnal ${jId} berhasil dihapus` });
  });

  app.delete('/api/attendances/:id', (req, res) => {
    const attId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), attId]));
    appData.attendances = (appData.attendances || []).filter((a: any) => a.id !== attId);
    saveStoredData(appData);
    Promise.resolve(supabaseServer.from('attendances').delete().eq('id', attId)).catch(() => {});
    return res.json({ success: true, message: `Presensi ${attId} berhasil dihapus` });
  });

  // 6. Reset password request routes
  app.get('/api/reset-requests', (_req, res) => {
    res.json(appData.resetRequests || []);
  });

  app.post('/api/reset-requests', (req, res) => {
    if (req.body && req.body.username) {
      if (!Array.isArray(appData.resetRequests)) {
        appData.resetRequests = [];
      }
      const newReq = {
        id: req.body.id || `req-reset-${Date.now()}`,
        ...req.body,
        createdAt: req.body.createdAt || new Date().toISOString(),
      };
      appData.resetRequests.unshift(newReq);
      saveStoredData(appData);
      return res.json({ success: true, request: newReq });
    }
    res.status(400).json({ success: false, message: 'Data permohonan reset tidak valid' });
  });

  app.delete('/api/reset-requests/:id', (req, res) => {
    const reqId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), reqId]));
    appData.resetRequests = (appData.resetRequests || []).filter((r: any) => r.id !== reqId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Permohonan reset ${reqId} berhasil dihapus` });
  });

  // 7. Reset server database to initial state
  app.post('/api/reset-database', (_req, res) => {
    appData = JSON.parse(JSON.stringify(INITIAL_DATA));
    saveStoredData(appData);
    res.json({ success: true, message: 'Database yayasan berhasil direset ke standar awal' });
  });

  // 8. Supabase Cloud Database Integration Routes
  app.get('/api/supabase/status', async (_req, res) => {
    const status = await checkSupabaseStatus();
    const stats: Record<string, number> = {
      schools: 0,
      users: 0,
      classes: 0,
      subjects: 0,
      assignments: 0,
      journals: 0,
      attendances: 0,
      app_data: 0,
    };

    if (status.connected) {
      const tables = ['schools', 'users', 'classes', 'subjects', 'assignments', 'journals', 'attendances', 'app_data'];
      await Promise.all(
        tables.map(async (t) => {
          try {
            const { count } = await supabaseServer.from(t).select('*', { count: 'exact', head: true });
            stats[t] = typeof count === 'number' ? count : 0;
          } catch {
            stats[t] = 0;
          }
        })
      );
    }

    res.json({
      ...status,
      url: SUPABASE_URL,
      projectRef: 'xgrhsebsrhwmcnpjizhx',
      hasAnonKey: !!SUPABASE_ANON_KEY,
      stats,
    });
  });

  app.post('/api/supabase/sync', async (req, res) => {
    const { direction } = req.body || { direction: 'push' };
    if (direction === 'pull') {
      const cloudData = await syncFromSupabaseCloud();
      if (cloudData && typeof cloudData === 'object') {
        appData = {
          ...INITIAL_DATA,
          ...cloudData,
        };
        saveStoredData(appData, true);
        return res.json({
          success: true,
          message: 'Berhasil menarik snapshot database dari Supabase Cloud!',
          schoolsCount: appData.schools?.length || 0,
          usersCount: appData.users?.length || 0,
          journalsCount: appData.journals?.length || 0,
          attendancesCount: appData.attendances?.length || 0,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Gagal menarik data dari Supabase. Pastikan tabel app_data sudah dibuat di SQL Editor.',
        });
      }
    } else {
      const success = await syncToSupabaseCloud(appData);
      return res.json({
        success,
        message: success
          ? 'Seluruh data aplikasi berhasil disinkronkan ke Supabase Cloud!'
          : 'Gagal mengunggah ke Supabase. Pastikan tabel app_data sudah dibuat di SQL Editor Supabase.',
      });
    }
  });

  app.get('/api/supabase/sql', (_req, res) => {
    try {
      const sqlFile = path.resolve(__dirname, 'supabase_schema.sql');
      if (fs.existsSync(sqlFile)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(fs.readFileSync(sqlFile, 'utf-8'));
      }
    } catch {}
    res.status(404).send('-- Skrip SQL tidak ditemukan');
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.error(`[AsistenGuru Server] Folder dist TIDAK DITEMUKAN di ${distPath}. Pastikan build sudah dijalankan.`);
      app.get('*', (_req, res) => {
        res.status(500).send('Aplikasi belum di-build. Silakan hubungi admin.');
      });
    }
  }

  const server = app.listen(Number(PORT), HOST, () => {
    console.log(`[AsistenGuru Server] Server berjalan lancar di http://${HOST}:${PORT}`);
    // Hydrate data from Supabase Cloud asynchronously in background after server is listening
    (async () => {
      try {
        const [tableData, cloudSnapshot] = await Promise.all([
          loadAllFromSupabaseTables(),
          syncFromSupabaseCloud(),
        ]);

        const delSet = new Set<string>(appData.deletedIds || []);

        if (cloudSnapshot && typeof cloudSnapshot === 'object') {
          appData.foundation = { ...appData.foundation, ...(cloudSnapshot.foundation || {}) };
          appData.adminChatConfig = cloudSnapshot.adminChatConfig || appData.adminChatConfig;
          appData.broadcastMessage = cloudSnapshot.broadcastMessage || appData.broadcastMessage;
          
          if (Array.isArray(cloudSnapshot.resetRequests)) {
            appData.resetRequests = mergeCollection(appData.resetRequests, cloudSnapshot.resetRequests, delSet);
          }
        }

        if (tableData && Array.isArray(tableData.schools) && tableData.schools.length > 0) {
          appData = {
            ...appData,
            schools: mergeCollection(appData.schools, tableData.schools, delSet),
            users: mergeUsers(appData.users, tableData.users, delSet),
            classes: mergeCollection(appData.classes, tableData.classes, delSet),
            subjects: mergeCollection(appData.subjects, tableData.subjects, delSet),
            assignments: mergeAssignments(appData.assignments, tableData.assignments, delSet),
            journals: mergeJournals(appData.journals, tableData.journals, delSet),
            attendances: mergeAttendances(appData.attendances, tableData.attendances, delSet),
          };
          console.log(`[Supabase Server Background Sync] Hydrated successfully from relational tables: ${appData.schools.length} schools, ${appData.users.length} users.`);
        } else if (cloudSnapshot && Array.isArray(cloudSnapshot.schools) && cloudSnapshot.schools.length > 0) {
          appData = {
            ...appData,
            schools: mergeCollection(appData.schools, cloudSnapshot.schools, delSet),
            users: mergeUsers(appData.users, cloudSnapshot.users, delSet),
            classes: mergeCollection(appData.classes, cloudSnapshot.classes, delSet),
            subjects: mergeCollection(appData.subjects, cloudSnapshot.subjects, delSet),
            assignments: mergeAssignments(appData.assignments, cloudSnapshot.assignments, delSet),
            journals: mergeJournals(appData.journals, cloudSnapshot.journals, delSet),
            attendances: mergeAttendances(appData.attendances, cloudSnapshot.attendances, delSet),
          };
          console.log(`[Supabase Server Background Sync] Hydrated from app_data snapshot: ${appData.schools.length} schools.`);
        }

        saveStoredData(appData, false);
      } catch (err) {
        console.warn('[Supabase Server Background Sync] Hydration error:', err);
      }
    })();
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[AsistenGuru Server] Port ${PORT} sudah digunakan. Coba matikan proses lain atau gunakan port berbeda.`);
    } else {
      console.error('[AsistenGuru Server] Server runtime error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('[AsistenGuru Server] Fatal error starting server:', err);
  process.exit(1);
});
