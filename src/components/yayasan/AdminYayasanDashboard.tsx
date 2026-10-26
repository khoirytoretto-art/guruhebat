import React, { useState, useEffect } from 'react';
import {
  School,
  User,
  JenjangSekolah,
  Akreditasi,
  FoundationInfo,
  PasswordResetRequest,
  AdminChatConfig,
  BroadcastMessage,
} from '../../types';
import { StorageService } from '../../utils/storage';
import { compressImageToDataUrl } from '../../utils/imageCompressor';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  School as SchoolIcon,
  Users,
  GraduationCap,
  Plus,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle,
  Building2,
  Smile,
  Upload,
  Search,
  Camera,
  Save,
  Bell,
  Check,
  UserCheck,
  X,
  Activity,
  MessageSquare,
  Database,
  Download,
  Phone,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Lock,
  Cloud,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  checkSupabaseHealth,
  saveAppDataToSupabase,
  fetchTableStatsFromSupabase,
  SUPABASE_CONFIG,
  SUPABASE_SETUP_SQL,
  SupabaseHealthStatus,
} from '../../utils/supabase';
import { getCurrentLocation } from '../../utils/location';
import { MapPin } from 'lucide-react';

interface AdminYayasanDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onDataChanged: () => void;
  onSwitchToSchoolAdmin: (schoolId: string) => void;
  onSwitchToTeacher: (teacherId: string) => void;
  currentUser?: User | null;
  onUserUpdated?: (user: User) => void;
}

export const AdminYayasanDashboard: React.FC<AdminYayasanDashboardProps> = ({
  activeTab,
  onTabChange,
  onDataChanged,
  currentUser,
  onUserUpdated,
}) => {
  const [schools, setSchools] = useState<School[]>(StorageService.getSchools());
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());
  const [foundation, setFoundation] = useState<FoundationInfo>(StorageService.getFoundation());
  const [isEditingFoundation, setIsEditingFoundation] = useState(false);
  const [foundationFormData, setFoundationFormData] = useState<FoundationInfo>(StorageService.getFoundation());
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>(
    StorageService.getResetRequests()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [filterResetStatus, setFilterResetStatus] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('ALL');

  // State untuk Chat Admin WhatsApp & Pesan Manual Admin Pusat
  const [chatConfig, setChatConfig] = useState<AdminChatConfig>(
    StorageService.getAdminChatConfig()
  );
  const [broadcastMsg, setBroadcastMsg] = useState<BroadcastMessage>(
    StorageService.getBroadcastMessage()
  );

  // Backup file pending confirmation
  const [backupPendingData, setBackupPendingData] = useState<any | null>(null);
  const [backupPendingRawText, setBackupPendingRawText] = useState<string | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState<string>('');

  // Modal custom suspension message per user
  const [customSuspensionUser, setCustomSuspensionUser] = useState<User | null>(null);
  const [customSuspensionText, setCustomSuspensionText] = useState<string>('');

  const adminYayasanUser =
    users.find((u) => u.role === 'ADMIN_YAYASAN') ||
    currentUser ||
    StorageService.getCurrentUser() || {
      id: 'user-yayasan',
      username: 'yayasan',
      name: 'Admin Yayasan Walisongo Rumbai Jaya',
      email: 'pphmrumbaijaya@gmail.com',
      phone: '0811-7000-111',
      role: 'ADMIN_YAYASAN' as const,
    };

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, []);

  const [showAdminYayasanModal, setShowAdminYayasanModal] = useState(false);
  const [adminYayasanFormData, setAdminYayasanFormData] = useState({
    name: adminYayasanUser.name,
    username: adminYayasanUser.username,
    password: '',
    email: adminYayasanUser.email || '',
    phone: adminYayasanUser.phone || '',
    photoUrl: adminYayasanUser.photoUrl || '',
  });

  // Supabase Database Integration State
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseHealthStatus | null>(null);
  const [supabaseTableCounts, setSupabaseTableCounts] = useState<{
    schools: number;
    users: number;
    classes: number;
    subjects: number;
    assignments: number;
    journals: number;
    attendances: number;
  } | null>(null);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const checkSupabase = async (silent = false) => {
    setIsCheckingSupabase(true);
    try {
      const res = await checkSupabaseHealth();
      setSupabaseStatus(res);
      // Ambil statistik baris tabel dari server atau langsung dari Supabase
      try {
        const statsRes = await fetch('/api/supabase/status').then((r) => r.json());
        if (statsRes?.stats) {
          setSupabaseTableCounts(statsRes.stats);
        } else {
          const directStats = await fetchTableStatsFromSupabase();
          setSupabaseTableCounts(directStats);
        }
      } catch {
        const directStats = await fetchTableStatsFromSupabase();
        setSupabaseTableCounts(directStats);
      }

      if (!silent) {
        if (res.connected && res.tableReady) {
          showToast('Terhubung ke Supabase Cloud! Seluruh tabel aktif dan tersinkronisasi.');
        } else if (res.connected && !res.tableReady) {
          showToast('Terhubung ke Supabase, namun tabel app_data belum dibuat.');
        } else {
          showToast('Belum dapat terhubung ke Supabase: ' + res.message);
        }
      }
    } catch {
      if (!silent) showToast('Gagal memeriksa status Supabase');
    } finally {
      setIsCheckingSupabase(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'BACKUP_DATA') {
      checkSupabase(true);
    }
  }, [activeTab]);

  const handleCopySqlScript = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopiedSql(true);
      showToast('Skrip SQL Supabase berhasil disalin ke clipboard!');
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  const handleManualSupabaseSync = async () => {
    setIsCheckingSupabase(true);
    try {
      const fullSnapshot = {
        foundation: StorageService.getFoundation(),
        schools: StorageService.getSchools(),
        users: StorageService.getUsers(),
        classes: StorageService.getClasses(),
        subjects: StorageService.getSubjects(),
        assignments: StorageService.getAssignments(),
        journals: StorageService.getJournals(),
        attendances: StorageService.getAttendances(),
        resetRequests: StorageService.getResetRequests(),
        adminChatConfig: StorageService.getAdminChatConfig(),
        broadcastMessage: StorageService.getBroadcastMessage(),
        syncedAt: new Date().toISOString(),
      };

      const pushOk = await saveAppDataToSupabase(fullSnapshot);
      const serverRes = await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'push' }),
      }).then((r) => r.json()).catch(() => ({ success: false }));

      await checkSupabase(true);

      if (pushOk || serverRes?.success) {
        showToast('Sinkronisasi Sukses! Seluruh data (sekolah, guru, kelas, mapel, presensi, jurnal) telah masuk ke tabel Supabase.');
      } else {
        showToast('Gagal mengunggah data ke Supabase.');
      }
    } catch (err: any) {
      showToast(`Kendala sinkronisasi: ${err?.message || 'Error'}`);
    } finally {
      setIsCheckingSupabase(false);
    }
  };

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

  // Modal / Form States
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolFormData, setSchoolFormData] = useState<Partial<School>>({
    jenjang: 'SD',
    akreditasi: 'A (Unggul)',
    tahunAjaranAktif: '2025/2026',
    semesterAktif: 'Genap',
  });

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [teacherFormData, setTeacherFormData] = useState<{
    name: string;
    username: string;
    password?: string;
    email: string;
    phone: string;
    nip: string;
    photoUrl?: string;
    assignedSchoolIds: string[];
    isKepsek?: boolean;
    schoolId?: string;
  }>({
    name: '',
    username: '',
    password: '123',
    email: '',
    phone: '',
    nip: '',
    photoUrl: '',
    assignedSchoolIds: [],
    isKepsek: false,
    schoolId: '',
  });

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [adminFormData, setAdminFormData] = useState<{
    name: string;
    username: string;
    password?: string;
    email: string;
    phone: string;
    schoolId: string;
    nip: string;
  }>({
    name: '',
    username: '',
    password: '123',
    email: '',
    phone: '',
    schoolId: '',
    nip: '',
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshData = () => {
    setSchools(StorageService.getSchools());
    setUsers(StorageService.getUsers());
    const currentF = StorageService.getFoundation();
    setFoundation(currentF);
    setFoundationFormData(currentF);
    setResetRequests(StorageService.getResetRequests());
    setChatConfig(StorageService.getAdminChatConfig());
    setBroadcastMsg(StorageService.getBroadcastMessage());
    onDataChanged();
  };

  // Polling aktif status online server setiap 4 detik saat dashboard yayasan terbuka
  useEffect(() => {
    StorageService.fetchOnlineUsers().then(() => {
      setUsers(StorageService.getUsers());
    });

    const onlineInterval = setInterval(() => {
      StorageService.fetchOnlineUsers().then(() => {
        setUsers(StorageService.getUsers());
      });
    }, 4000);

    return () => clearInterval(onlineInterval);
  }, [activeTab]);

  const formatLastOnline = (lastOnline?: string) => {
    if (!lastOnline) return { text: 'Belum pernah aktif', isOnline: false };
    const diffMs = Date.now() - new Date(lastOnline).getTime();
    if (diffMs < 0) return { text: 'Online Sekarang', isOnline: true };
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 3) {
      if (diffSecs < 45) {
        return { text: 'Online Sekarang', isOnline: true };
      }
      return { text: `Online Sekarang (${diffMins} mnt lalu)`, isOnline: true };
    }
    if (diffMins < 60) {
      return { text: `${diffMins} menit lalu`, isOnline: false };
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return { text: `${diffHours} jam lalu`, isOnline: false };
    }
    return {
      text: new Date(lastOnline).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      isOnline: false,
    };
  };

  const handleToggleUserStatus = async (u: User, targetStatus?: 'AKTIF' | 'NONAKTIF') => {
    const newStatus = targetStatus || (u.statusAktif === 'NONAKTIF' ? 'AKTIF' : 'NONAKTIF');
    const isDeactivating = newStatus === 'NONAKTIF';
    if (isDeactivating) {
      setCustomSuspensionUser(u);
      setCustomSuspensionText(
        u.pesanKhusus ||
          broadcastMsg.pesanPusat ||
          'Akun Anda sedang dinonaktifkan sementara oleh Admin Pusat Yayasan.'
      );
    } else {
      setUsers((prevUsers) =>
        prevUsers.map((item) =>
          item.id === u.id ? { ...item, statusAktif: 'AKTIF' } : item
        )
      );
      await StorageService.toggleUserStatus(u.id, 'AKTIF');
      showToast(`Akun ${u.name} berhasil diaktifkan kembali!`);
      refreshData();
    }
  };

  const handleSaveCustomSuspension = async () => {
    if (!customSuspensionUser) return;
    const targetId = customSuspensionUser.id;
    const txt = customSuspensionText.trim();
    setUsers((prevUsers) =>
      prevUsers.map((item) =>
        item.id === targetId ? { ...item, statusAktif: 'NONAKTIF', pesanKhusus: txt } : item
      )
    );
    await StorageService.toggleUserStatus(
      targetId,
      'NONAKTIF',
      txt
    );
    showToast(`Akun ${customSuspensionUser.name} telah dinonaktifkan.`);
    setCustomSuspensionUser(null);
    refreshData();
  };

  // BACKUP & RESTORE ENKRIPSI KUAT (AES-256-GCM)
  const handleDownloadBackup = async (isEncrypted = false) => {
    if (isEncrypted) {
      const res = await StorageService.exportEncryptedBackup();
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Cadangan TERENKRIPSI KUAT (AES-256-GCM) berhasil diunduh!');
    } else {
      const data = StorageService.exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      a.href = url;
      a.download = `Backup_AsistenGuru_PPHMRumbaiJaya_${dateStr}_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('File cadangan data lengkap (.json) berhasil diunduh!');
    }
  };

  const handleSelectBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setBackupPendingRawText(text);
        const parsed = JSON.parse(text);

        if (parsed.format === 'ASISTENGURU_ENCRYPTED_BACKUP') {
          setBackupPendingData(parsed);
          showToast('File cadangan terenkripsi AES-256 terdeteksi. Silakan konfirmasi.');
        } else if (parsed && typeof parsed === 'object') {
          setBackupPendingData(parsed);
        } else {
          showToast('File tidak valid atau rusak.');
        }
      } catch (err: any) {
        showToast('Gagal membaca file JSON: format tidak sesuai.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestoreBackup = async () => {
    if (!backupPendingRawText && !backupPendingData) return;
    if (backupPendingRawText) {
      const res = await StorageService.restoreEncryptedBackup(backupPendingRawText, backupPassphrase || undefined);
      if (res.success) {
        showToast(res.message);
        setBackupPendingData(null);
        setBackupPendingRawText(null);
        refreshData();
      } else {
        showToast(res.message);
      }
    } else if (backupPendingData) {
      const res = StorageService.restoreBackupData(backupPendingData);
      if (res.success) {
        showToast('Data cadangan berhasil dipulihkan!');
        setBackupPendingData(null);
        refreshData();
      } else {
        showToast(res.message);
      }
    }
  };

  const handleConfirmResetAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Reset Total Semua Data',
      message:
        'Apakah Anda yakin ingin MENGHAPUS SEMUA DATA sistem (seluruh lembaga sekolah, akun guru/kepala sekolah, kelas, mapel, penugasan, presensi, dan jurnal)? Tindakan ini akan mengosongkan tabel di server dan cloud Supabase agar Anda dapat menginput ulang dari awal. Akun login Admin Yayasan (username: yayasan, password: 123) tetap dipertahankan.',
      confirmText: 'Ya, Reset Semua Data',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setIsCheckingSupabase(true);
        try {
          const res = await StorageService.resetAllDataToCleanState();
          await checkSupabase(true);
          refreshData();
          onDataChanged();
          showToast(res.message);
        } catch (err: any) {
          showToast('Gagal reset data: ' + (err?.message || 'Error'));
        } finally {
          setIsCheckingSupabase(false);
        }
      },
    });
  };

  // PESAN PUSAT & CHAT ADMIN
  const handleSavePesanDanChat = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveFoundationAndConfig(foundation, chatConfig, broadcastMsg);
    showToast('Pesan manual admin pusat & pengaturan WhatsApp berhasil disimpan!');
    refreshData();
  };

  // FOUNDATION PROFILE
  const handleStartEditFoundation = () => {
    setFoundationFormData({ ...foundation });
    setIsEditingFoundation(true);
  };

  const handleCancelEditFoundation = () => {
    setFoundationFormData({ ...foundation });
    setIsEditingFoundation(false);
  };

  const handleSaveFoundationProfile = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveFoundation(foundationFormData);
    setFoundation({ ...foundationFormData });
    setIsEditingFoundation(false);
    showToast('Profil Yayasan berhasil diperbarui!');
    refreshData();
  };

  const handleUploadFoundationLogoInProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 280, 280, 0.85);
        setFoundationFormData((prev) => ({
          ...prev,
          logoYayasanUrl: compressed,
        }));
        showToast('Logo yayasan berhasil dipilih & dikompres optimal!');
      } catch {
        showToast('Gagal memproses gambar logo yayasan');
      }
    }
  };

  // ADMIN YAYASAN PROFILE
  const handleOpenEditAdminYayasan = () => {
    const currentAdmin =
      users.find((u) => u.role === 'ADMIN_YAYASAN') ||
      currentUser ||
      StorageService.getCurrentUser() ||
      adminYayasanUser;
    setAdminYayasanFormData({
      name: currentAdmin?.name || '',
      username: currentAdmin?.username || '',
      password: '',
      email: currentAdmin?.email || '',
      phone: currentAdmin?.phone || '',
      photoUrl: currentAdmin?.photoUrl || '',
    });
    setShowAdminYayasanModal(true);
  };

  const handleSaveAdminYayasan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminYayasanFormData.name.trim()) {
      showToast('Nama Admin Yayasan tidak boleh kosong!');
      return;
    }
    if (!adminYayasanFormData.username.trim()) {
      showToast('Username tidak boleh kosong!');
      return;
    }
    const currentAdmin =
      users.find((u) => u.role === 'ADMIN_YAYASAN') ||
      currentUser ||
      StorageService.getCurrentUser() ||
      adminYayasanUser;

    const res = StorageService.updateUserCredentials(
      currentAdmin.id,
      adminYayasanFormData.username.trim(),
      adminYayasanFormData.password.trim() || undefined,
      adminYayasanFormData.name.trim(),
      adminYayasanFormData.email.trim(),
      adminYayasanFormData.phone.trim(),
      adminYayasanFormData.photoUrl
    );
    if (!res.success) {
      showToast(res.message);
      return;
    }
    if (res.updatedUser) {
      onUserUpdated?.(res.updatedUser);
    }
    setShowAdminYayasanModal(false);
    showToast('Nama dan profil Admin Yayasan berhasil diperbarui!');
    refreshData();
  };

  const handleUploadAdminYayasanPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 240, 240, 0.82);
        setAdminYayasanFormData((prev) => ({
          ...prev,
          photoUrl: compressed,
        }));
        showToast('Foto Admin Yayasan berhasil dipilih & dikompres!');
      } catch {
        showToast('Gagal memproses foto.');
      }
    }
  };

  // BRANDING & KUTIPAN
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveFoundation(foundation);
    showToast('Logo yayasan, logo aplikasi, dan kutipan berhasil disimpan!');
    refreshData();
  };

  const handleUploadLogoYayasan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 280, 280, 0.85);
        setFoundation({ ...foundation, logoYayasanUrl: compressed });
        showToast('Logo yayasan dipilih & dikompres! Klik Simpan Perubahan.');
      } catch {
        showToast('Gagal memproses gambar logo yayasan');
      }
    }
  };

  const handleUploadLogoApp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 280, 280, 0.85);
        setFoundation({ ...foundation, logoAppUrl: compressed });
        showToast('Logo aplikasi dipilih & dikompres! Klik Simpan Perubahan.');
      } catch {
        showToast('Gagal memproses gambar logo aplikasi');
      }
    }
  };

  // SCHOOL HANDLERS
  const handleOpenSchoolModal = (school?: School) => {
    if (school) {
      setEditingSchool(school);
      setSchoolFormData({
        ...school,
        lockAttendanceTodayOnly: school.lockAttendanceTodayOnly || false,
      });
    } else {
      setEditingSchool(null);
      setSchoolFormData({
        name: '',
        jenjang: 'SD',
        npsn: '',
        akreditasi: 'A (Unggul)',
        alamat: '',
        telepon: '',
        email: '',
        kepalaSekolah: '',
        nipKepalaSekolah: '',
        tahunAjaranAktif: '2025/2026',
        semesterAktif: 'Genap',
        logoUrl: '',
        foundationName: foundation.name,
        latitude: -6.200000,
        longitude: 106.816666,
        enableGeofencing: false,
        geofencingRadius: 50,
        lockAttendanceTodayOnly: false,
      });
    }
    setShowSchoolModal(true);
  };

  const handleSaveSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolFormData.name) return;
    if (editingSchool) {
      const updated: School = {
        ...editingSchool,
        ...(schoolFormData as School),
        lockAttendanceTodayOnly: schoolFormData.lockAttendanceTodayOnly || false,
      };
      StorageService.updateSchool(updated);
      showToast(`Sekolah "${updated.name}" berhasil diperbarui.`);
    } else {
      const newSchool: School = {
        id: `school-${Date.now()}`,
        name: schoolFormData.name || '',
        jenjang: (schoolFormData.jenjang as JenjangSekolah) || 'SD',
        npsn: schoolFormData.npsn || '10499999',
        akreditasi: (schoolFormData.akreditasi as Akreditasi) || 'B (Baik)',
        alamat: schoolFormData.alamat || 'Kompleks Yayasan',
        telepon: schoolFormData.telepon || '-',
        email: schoolFormData.email || '-',
        kepalaSekolah: schoolFormData.kepalaSekolah || 'Kepala Sekolah',
        nipKepalaSekolah: schoolFormData.nipKepalaSekolah || '',
        tahunAjaranAktif: schoolFormData.tahunAjaranAktif || '2025/2026',
        semesterAktif: (schoolFormData.semesterAktif as 'Ganjil' | 'Genap') || 'Genap',
        foundationName: foundation.name,
        logoUrl: schoolFormData.logoUrl || '',
        latitude: schoolFormData.latitude,
        longitude: schoolFormData.longitude,
        enableGeofencing: schoolFormData.enableGeofencing || false,
        geofencingRadius: schoolFormData.geofencingRadius || 50,
        lockAttendanceTodayOnly: schoolFormData.lockAttendanceTodayOnly || false,
      };
      StorageService.addSchool(newSchool);
      showToast(`Sekolah "${newSchool.name}" berhasil ditambahkan.`);
    }
    setShowSchoolModal(false);
    refreshData();
  };

  const handleDeleteSchool = (school: School) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Sekolah Naungan?',
      message: `Yakin ingin menghapus sekolah "${school.name}"? Seluruh kelas, guru terkait, dan data jurnal/absen akan dihapus secara permanen.`,
      confirmText: 'Ya, Hapus Sekolah',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteSchool(school.id);
        showToast(`Sekolah "${school.name}" telah berhasil dihapus.`);
        refreshData();
      },
    });
  };

  // TEACHER HANDLERS
  const handleOpenTeacherModal = (teacher?: User) => {
    if (teacher) {
      setEditingTeacher(teacher);
      const isKep = teacher.role === 'KEPALA_SEKOLAH';
      const initialSchoolId = teacher.schoolId || (teacher.assignedSchoolIds && teacher.assignedSchoolIds.length > 0 ? teacher.assignedSchoolIds[0] : (schools.length > 0 ? schools[0].id : ''));
      setTeacherFormData({
        name: teacher.name,
        username: teacher.username,
        email: teacher.email,
        phone: teacher.phone || '',
        nip: teacher.nip || '',
        photoUrl: teacher.photoUrl || '',
        assignedSchoolIds: teacher.assignedSchoolIds || (initialSchoolId ? [initialSchoolId] : []),
        isKepsek: isKep,
        schoolId: initialSchoolId,
      });
    } else {
      setEditingTeacher(null);
      setTeacherFormData({
        name: '',
        username: '',
        password: '123',
        email: '',
        phone: '',
        nip: '',
        photoUrl: '',
        assignedSchoolIds: schools.length > 0 ? [schools[0].id] : [],
        isKepsek: false,
        schoolId: schools.length > 0 ? schools[0].id : '',
      });
    }
    setShowTeacherModal(true);
  };

  const handleTeacherPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 240, 240, 0.82);
        setTeacherFormData({ ...teacherFormData, photoUrl: compressed });
        showToast('Foto guru berhasil dipilih & dikompres optimal!');
      } catch {
        showToast('Gagal memproses foto guru');
      }
    }
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.name || !teacherFormData.username) return;
    const roleToAssign = teacherFormData.isKepsek ? 'KEPALA_SEKOLAH' : 'GURU';

    let targetSchoolId = teacherFormData.schoolId;
    let targetAssignedSchoolIds = teacherFormData.assignedSchoolIds;

    if (teacherFormData.isKepsek) {
      targetSchoolId = teacherFormData.schoolId || (schools.length > 0 ? schools[0].id : '');
      const assignedSet = new Set(teacherFormData.assignedSchoolIds || []);
      if (targetSchoolId) assignedSet.add(targetSchoolId);
      targetAssignedSchoolIds = Array.from(assignedSet);
    } else {
      if (!targetSchoolId && targetAssignedSchoolIds.length > 0) {
        targetSchoolId = targetAssignedSchoolIds[0];
      }
    }

    if (editingTeacher) {
      const updated: User = {
        ...editingTeacher,
        name: teacherFormData.name,
        username: teacherFormData.username.trim().toLowerCase(),
        email: teacherFormData.email,
        phone: teacherFormData.phone,
        nip: teacherFormData.nip,
        photoUrl: teacherFormData.photoUrl,
        assignedSchoolIds: targetAssignedSchoolIds,
        role: roleToAssign,
        schoolId: targetSchoolId,
      };
      StorageService.updateUser(updated);

      // Sinkronkan nama Kepala Sekolah & NIP pada profil sekolah yang dipilih
      if (roleToAssign === 'KEPALA_SEKOLAH' && targetSchoolId) {
        const sch = StorageService.getSchoolById(targetSchoolId);
        if (sch) {
          StorageService.updateSchool({
            ...sch,
            kepalaSekolah: teacherFormData.name,
            nipKepalaSekolah: teacherFormData.nip || sch.nipKepalaSekolah,
          });
        }
      }

      showToast(`Data ${roleToAssign === 'KEPALA_SEKOLAH' ? 'Kepala Sekolah' : 'Guru'} "${updated.name}" berhasil diperbarui.`);
    } else {
      const newTeacher: User = {
        id: `user-${roleToAssign === 'KEPALA_SEKOLAH' ? 'kepsek' : 'guru'}-${Date.now()}`,
        name: teacherFormData.name,
        username: teacherFormData.username.trim().toLowerCase(),
        password: teacherFormData.password || '123',
        email: teacherFormData.email || `${teacherFormData.username}@rumbaijaya.sch.id`,
        phone: teacherFormData.phone,
        nip: teacherFormData.nip,
        photoUrl: teacherFormData.photoUrl,
        role: roleToAssign,
        assignedSchoolIds: targetAssignedSchoolIds,
        schoolId: targetSchoolId,
      };
      StorageService.addUser(newTeacher);

      // Sinkronkan nama Kepala Sekolah & NIP pada profil sekolah yang dipilih
      if (roleToAssign === 'KEPALA_SEKOLAH' && targetSchoolId) {
        const sch = StorageService.getSchoolById(targetSchoolId);
        if (sch) {
          StorageService.updateSchool({
            ...sch,
            kepalaSekolah: teacherFormData.name,
            nipKepalaSekolah: teacherFormData.nip || sch.nipKepalaSekolah,
          });
        }
      }

      showToast(`Akun ${roleToAssign === 'KEPALA_SEKOLAH' ? 'Kepala Sekolah' : 'Guru'} "${newTeacher.name}" berhasil ditambahkan.`);
    }
    setShowTeacherModal(false);
    refreshData();
  };

  const handleDeleteTeacher = (teacher: User) => {
    const isKep = teacher.role === 'KEPALA_SEKOLAH';
    setConfirmModal({
      isOpen: true,
      title: isKep ? 'Hapus Akun Kepala Sekolah?' : 'Hapus Akun Guru?',
      message: `Yakin ingin menghapus akun ${isKep ? 'Kepala Sekolah' : 'guru'} "${teacher.name}"? Akun dan seluruh data penugasan akan dihapus secara permanen.`,
      confirmText: isKep ? 'Ya, Hapus Kepala Sekolah' : 'Ya, Hapus Guru',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteUser(teacher.id);
        showToast(`Akun ${isKep ? 'Kepala Sekolah' : 'guru'} "${teacher.name}" berhasil dihapus.`);
        refreshData();
      },
    });
  };

  const handleResetPassword = (user: User) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Kata Sandi Akun?',
      message: `Reset kata sandi akun @${user.username} (${user.name}) kembali ke kata sandi standar "123"?`,
      confirmText: 'Reset ke "123"',
      type: 'warning',
      onConfirm: () => {
        StorageService.resetUserPassword(user.id, '123');
        showToast(`Kata sandi akun @${user.username} telah direset ke "123".`);
        refreshData();
      },
    });
  };

  // ADMIN SEKOLAH HANDLERS
  const handleOpenAdminModal = (admin?: User) => {
    if (admin) {
      setEditingAdmin(admin);
      setAdminFormData({
        name: admin.name,
        username: admin.username,
        email: admin.email,
        phone: admin.phone || '',
        schoolId: admin.schoolId || '',
        nip: admin.nip || '',
      });
    } else {
      setEditingAdmin(null);
      setAdminFormData({
        name: '',
        username: '',
        password: '123',
        email: '',
        phone: '',
        schoolId: schools.length > 0 ? schools[0].id : '',
        nip: '',
      });
    }
    setShowAdminModal(true);
  };

  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormData.name || !adminFormData.username || !adminFormData.schoolId) return;
    if (editingAdmin) {
      const updated: User = {
        ...editingAdmin,
        name: adminFormData.name,
        username: adminFormData.username.trim().toLowerCase(),
        email: adminFormData.email,
        phone: adminFormData.phone,
        schoolId: adminFormData.schoolId,
        nip: adminFormData.nip,
      };
      StorageService.updateUser(updated);
      showToast(`Akun admin sekolah "${updated.name}" berhasil disimpan.`);
    } else {
      const newAdmin: User = {
        id: `user-admin-${Date.now()}`,
        name: adminFormData.name,
        username: adminFormData.username.trim().toLowerCase(),
        password: adminFormData.password || '123',
        email: adminFormData.email || `${adminFormData.username}@rumbaijaya.sch.id`,
        phone: adminFormData.phone,
        schoolId: adminFormData.schoolId,
        nip: adminFormData.nip,
        role: 'ADMIN_SEKOLAH',
      };
      StorageService.addUser(newAdmin);
      showToast(`Akun admin sekolah "${newAdmin.name}" berhasil ditambahkan.`);
    }
    setShowAdminModal(false);
    refreshData();
  };

  const handleDeleteAdmin = (admin: User) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Akun Admin Sekolah?',
      message: `Yakin ingin menghapus akun admin sekolah "${admin.name}" (@${admin.username})?`,
      confirmText: 'Ya, Hapus Admin',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteUser(admin.id);
        showToast(`Akun admin "${admin.name}" telah dihapus.`);
        refreshData();
      },
    });
  };

  // PASSWORD RESET REQUEST HANDLERS
  const handleApproveReset = (req: PasswordResetRequest) => {
    setConfirmModal({
      isOpen: true,
      title: 'Setujui & Reset Kata Sandi?',
      message: `Kata sandi akun @${req.username} (${req.name || 'Pengguna'}) akan direset kembali ke standar bawaan "123".`,
      confirmText: 'Setujui & Reset ke "123"',
      type: 'warning',
      onConfirm: () => {
        StorageService.resolveResetRequest(req.id, '123');
        showToast(`Kata sandi akun @${req.username} berhasil direset ke "123"!`);
        refreshData();
      },
    });
  };

  const handleDeleteResetRequest = (req: PasswordResetRequest) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Permohonan Reset?',
      message: `Hapus catatan permohonan reset dari ${req.name || req.username}?`,
      confirmText: 'Hapus',
      type: 'danger',
      onConfirm: () => {
        StorageService.deleteResetRequest(req.id);
        showToast('Catatan permohonan reset kata sandi telah dihapus.');
        refreshData();
      },
    });
  };

  const pendingRequests = resetRequests.filter((r) => r.status === 'PENDING');
  const filteredResetRequests = resetRequests.filter((r) => {
    if (filterResetStatus === 'PENDING') return r.status === 'PENDING';
    if (filterResetStatus === 'RESOLVED') return r.status === 'RESOLVED';
    return true;
  });

  const teachers = users.filter((u) => u.role === 'GURU' || u.role === 'KEPALA_SEKOLAH');
  const schoolAdmins = users.filter((u) => u.role === 'ADMIN_SEKOLAH');

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-700 animate-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* PEMBERITAHUAN MENDESAK PERMINTAAN RESET KATA SANDI BARU */}
      {pendingRequests.length > 0 && activeTab !== 'PERMINTAAN_RESET' && (
        <div className="bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-orange-500/20 border-2 border-amber-400/90 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                  Pemberitahuan Baru
                </span>
                <span className="text-xs text-slate-600">&bull; Permohonan Akun</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-0.5">
                Ada {pendingRequests.length} Pengguna Mengajukan Reset Kata Sandi!
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Pengguna lupa kata sandi dan menunggu persetujuan Anda untuk reset ke "123".
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTabChange('PERMINTAAN_RESET')}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer shrink-0 self-start sm:self-auto transition"
          >
            <KeyRound className="w-4 h-4" />
            <span>Lihat & Reset Akun ({pendingRequests.length})</span>
          </button>
        </div>
      )}

      {/* TAB 1: SEKOLAH NAUNGAN YAYASAN */}
      {activeTab === 'SEKOLAH' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Lembaga / Sekolah di Bawah Naungan Yayasan
              </h2>
              <p className="text-xs text-slate-500">
                Kelola seluruh sekolah formal dan diniyah di bawah naungan yayasan.
              </p>
            </div>
            <button
              onClick={() => handleOpenSchoolModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Sekolah Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => {
              const assignedTeachers = teachers.filter((t) =>
                t.assignedSchoolIds?.includes(school.id)
              );
              return (
                <div
                  key={school.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        {school.logoUrl ? (
                          <img
                            src={school.logoUrl}
                            alt={school.name}
                            className="w-12 h-12 object-contain rounded-xl border border-slate-200 p-1 bg-white"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                            {school.jenjang}
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Jenjang {school.jenjang}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 leading-snug mt-1">
                            {school.name}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">NPSN:</span>
                        <span className="font-mono font-semibold text-slate-800">{school.npsn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Akreditasi:</span>
                        <span className="font-bold text-emerald-800">{school.akreditasi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kepala Sekolah:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">{school.kepalaSekolah}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Guru Ditugaskan:</span>
                        <span className="font-bold text-indigo-700">{assignedTeachers.length} Guru</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">ID: {school.id}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenSchoolModal(school)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
                        title="Edit Profil Sekolah"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSchool(school)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
                        title="Hapus Sekolah ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: AKUN ADMIN SEKOLAH */}
      {activeTab === 'ADMIN_SEKOLAH' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-3xl border border-emerald-800/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {adminYayasanUser.photoUrl ? (
                <img
                  src={adminYayasanUser.photoUrl}
                  alt={adminYayasanUser.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400/50 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/10 text-emerald-300 border border-white/20 flex items-center justify-center font-bold text-xl shadow-inner">
                  {adminYayasanUser.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    Akun Utama Yayasan
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    @{adminYayasanUser.username}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {adminYayasanUser.name}
                </h3>
                <p className="text-xs text-slate-300">
                  {adminYayasanUser.email || 'pphmrumbaijaya@gmail.com'} &bull; Telp: {adminYayasanUser.phone || '-'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenEditAdminYayasan}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Nama Admin Yayasan</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">Manajemen Akun Admin Sekolah</h2>
              <p className="text-xs text-slate-500">
                Atur akun administrator untuk tiap sekolah. Dilengkapi fitur reset kata sandi dan hapus.
              </p>
            </div>
            <button
              onClick={() => handleOpenAdminModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Admin Sekolah</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nama Administrator</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Sekolah yang Dikelola</th>
                    <th className="py-3 px-4">Kontak / NIP</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schoolAdmins.map((admin) => {
                    const school = schools.find((s) => s.id === admin.schoolId);
                    return (
                      <tr key={admin.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {admin.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-800 font-semibold">
                          @{admin.username}
                        </td>
                        <td className="py-3.5 px-4">
                          {school ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold text-[11px]">
                              <SchoolIcon className="w-3.5 h-3.5" />
                              {school.name}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-medium italic">Belum dihubungkan</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>{admin.phone || '-'}</div>
                          <div className="text-[10px] text-slate-400">NIP: {admin.nip || '-'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handleResetPassword(admin)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="Reset password ke 123"
                          >
                            <KeyRound className="w-3 h-3" /> Reset
                          </button>
                          <button
                            onClick={() => handleOpenAdminModal(admin)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Edit Akun Admin"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(admin)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Hapus Akun Admin"
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

      {/* TAB 3: DATA GURU YAYASAN & UPLOAD FOTO GURU */}
      {activeTab === 'GURU' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Data Guru Yayasan &amp; Unggah Foto Profil
              </h2>
              <p className="text-xs text-slate-500">
                Pendaftaran guru, upload foto guru agar tampil di profil akun, penempatan sekolah, dan manajemen akun.
              </p>
            </div>
            <button
              onClick={() => handleOpenTeacherModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Guru / Kepsek Baru</span>
            </button>
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama guru, NIP, atau username..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-2xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Foto</th>
                    <th className="py-3 px-4">Nama Lengkap &amp; NIP</th>
                    <th className="py-3 px-4">Username &amp; Peran</th>
                    <th className="py-3 px-4">Sekolah Penugasan</th>
                    <th className="py-3 px-4">Kontak</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers
                    .filter((t) =>
                      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      t.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (t.nip && t.nip.includes(searchQuery))
                    )
                    .map((teacher) => {
                      return (
                        <tr key={teacher.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-center">
                            {teacher.photoUrl ? (
                              <img
                                src={teacher.photoUrl}
                                alt={teacher.name}
                                className="w-9 h-9 rounded-xl object-cover mx-auto border border-slate-200"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs mx-auto border border-slate-200">
                                {teacher.name.charAt(0)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{teacher.name}</div>
                            <div className="text-[10px] text-slate-500">
                              NIP: {teacher.nip || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-semibold text-emerald-800">
                              @{teacher.username}
                            </div>
                            <span
                              className={`inline-block mt-0.5 text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                                teacher.role === 'KEPALA_SEKOLAH'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {teacher.role === 'KEPALA_SEKOLAH' ? 'Kepala Sekolah' : 'Guru'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {teacher.role === 'KEPALA_SEKOLAH' ? (
                                (() => {
                                  const targetSid = teacher.schoolId || (teacher.assignedSchoolIds && teacher.assignedSchoolIds.length > 0 ? teacher.assignedSchoolIds[0] : null);
                                  const sch = targetSid ? schools.find((s) => s.id === targetSid) : null;
                                  return sch ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                      <Building2 className="w-3 h-3 text-amber-700 shrink-0" />
                                      <span>{sch.name} ({sch.jenjang})</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 font-semibold italic">
                                      Belum dipilih sekolahnya
                                    </span>
                                  );
                                })()
                              ) : teacher.assignedSchoolIds && teacher.assignedSchoolIds.length > 0 ? (
                                teacher.assignedSchoolIds.map((sid) => {
                                  const sch = schools.find((s) => s.id === sid);
                                  return (
                                    <span
                                      key={sid}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                                    >
                                      {sch ? sch.name : sid}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  Belum ditempatkan
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {teacher.phone || '-'}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleResetPassword(teacher)}
                              className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                              title="Reset Password Akun ke 123"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenTeacherModal(teacher)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Edit Data Guru & Foto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTeacher(teacher)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Hapus Akun Guru ini"
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

      {/* TAB 4: LOGO YAYASAN, LOGO APLIKASI & KUTIPAN */}
      {activeTab === 'KUTIPAN_BRANDING' && (
        <form onSubmit={handleSaveBranding} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Smile className="w-5 h-5 text-amber-600" />
              Upload Logo Yayasan, Logo Aplikasi &amp; Kutipan Lucu
            </h2>
            <p className="text-xs text-slate-500">
              Atur logo resmi yayasan, logo aplikasi AsistenGuru, dan kutipan motivasi yang tampil di beranda seluruh pengguna.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800 text-sm">
                1. Logo Yayasan Resmi
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border border-slate-300 bg-white p-1.5 flex items-center justify-center shrink-0">
                  {foundation.logoYayasanUrl ? (
                    <img
                      src={foundation.logoYayasanUrl}
                      alt="Logo Yayasan"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">Tanpa Logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Yayasan</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogoYayasan}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Tampil pada kop surat resmi dan dokumen rekap lembaga.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800 text-sm">
                2. Logo Aplikasi AsistenGuru
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border border-slate-300 bg-white p-1.5 flex items-center justify-center shrink-0">
                  {foundation.logoAppUrl ? (
                    <img
                      src={foundation.logoAppUrl}
                      alt="Logo Aplikasi"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <GraduationCap className="w-10 h-10 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="px-3.5 py-2 bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Aplikasi</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogoApp}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Tampil pada halaman login, sidebar kiri, dan header aplikasi.
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-amber-50/60 border border-amber-200 p-5 rounded-2xl space-y-3">
              <div>
                <label className="block font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <Smile className="w-4 h-4 text-amber-600" />
                  <span>Kutipan Lucu &amp; Motivasi Harian (Manual Admin Yayasan):</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={foundation.kutipanLucu || ''}
                  onChange={(e) => setFoundation({ ...foundation, kutipanLucu: e.target.value })}
                  placeholder="Tulis kutipan lucu atau pesan motivasi di sini..."
                  className="w-full px-3.5 py-2.5 border border-amber-300 rounded-xl bg-white text-xs text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Atas Nama Pembuat / Penulis:
                </label>
                <input
                  type="text"
                  value={foundation.kutipanAuthor || ''}
                  onChange={(e) => setFoundation({ ...foundation, kutipanAuthor: e.target.value })}
                  placeholder="Ketua Yayasan / Pengurus Pusat"
                  className="w-full sm:w-80 px-3 py-2 border border-amber-300 rounded-xl bg-white text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" /> Simpan Perubahan Branding &amp; Kutipan
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: PROFIL YAYASAN */}
      {activeTab === 'RINGKASAN' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                {foundation.logoYayasanUrl ? (
                  <img
                    src={foundation.logoYayasanUrl}
                    alt="Logo Yayasan"
                    className="w-16 h-16 rounded-2xl object-contain border border-slate-200 p-1.5 bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-bold text-2xl shadow-inner">
                    YW
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Profil Resmi Yayasan
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {foundation.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {foundation.tagline}
                  </p>
                </div>
              </div>
              {!isEditingFoundation ? (
                <button
                  type="button"
                  onClick={handleStartEditFoundation}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer self-start sm:self-auto"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Profil Yayasan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelEditFoundation}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer self-start sm:self-auto"
                >
                  Batal Mengedit
                </button>
              )}
            </div>

            {isEditingFoundation ? (
              <form onSubmit={handleSaveFoundationProfile} className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  <div className="md:col-span-2 bg-slate-50 p-4.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-slate-300 bg-white p-1 flex items-center justify-center shrink-0">
                      {foundationFormData.logoYayasanUrl ? (
                        <img
                          src={foundationFormData.logoYayasanUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">Tanpa Logo</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="block font-bold text-slate-800 text-xs">
                        Logo Resmi Yayasan
                      </label>
                      <label className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Ganti / Unggah Logo Yayasan</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadFoundationLogoInProfile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Lengkap Yayasan *
                    </label>
                    <input
                      type="text"
                      required
                      value={foundationFormData.name}
                      onChange={(e) =>
                        setFoundationFormData({ ...foundationFormData, name: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Slogan / Visi Singkat Yayasan
                    </label>
                    <input
                      type="text"
                      value={foundationFormData.tagline}
                      onChange={(e) =>
                        setFoundationFormData({ ...foundationFormData, tagline: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Ketua Dewan Pengurus Yayasan *
                    </label>
                    <input
                      type="text"
                      required
                      value={foundationFormData.ketuaYayasan}
                      onChange={(e) =>
                        setFoundationFormData({ ...foundationFormData, ketuaYayasan: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nomor Telepon Yayasan
                    </label>
                    <input
                      type="text"
                      value={foundationFormData.telepon}
                      onChange={(e) =>
                        setFoundationFormData({ ...foundationFormData, telepon: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Email Resmi Yayasan
                    </label>
                    <input
                      type="email"
                      value={foundationFormData.email}
                      onChange={(e) =>
                        setFoundationFormData({ ...foundationFormData, email: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Alamat Lengkap Sekretariat Yayasan *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={foundationFormData.alamat}
                      onChange={(e) =>
                        setFoundationFormData({ ...foundationFormData, alamat: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCancelEditFoundation}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan Profil Yayasan</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs mt-6">
                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    <span>Informasi Legalitas &amp; Kontak</span>
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="font-bold text-slate-500 block text-[11px]">Ketua Dewan Pengurus Yayasan:</span>
                      <span className="text-slate-900 text-sm font-bold">{foundation.ketuaYayasan}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 block text-[11px]">Alamat Sekretariat:</span>
                      <span className="text-slate-800 font-medium">{foundation.alamat}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 block text-[11px]">Kontak / Telepon:</span>
                      <span className="text-slate-800 font-mono font-medium">{foundation.telepon}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 block text-[11px]">Email Resmi:</span>
                      <span className="text-slate-800 font-mono font-medium">{foundation.email}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                      <SchoolIcon className="w-4 h-4 text-emerald-700" />
                      <span>Lembaga di Bawah Naungan</span>
                    </h4>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {schools.length} Lembaga
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {schools.map((s, idx) => (
                      <li key={s.id} className="flex items-center justify-between py-2 border-b border-slate-200/70 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{s.name}</span>
                            <span className="text-[10px] text-slate-500">Jenjang: {s.jenjang} &bull; NPSN: {s.npsn}</span>
                          </div>
                        </div>
                        <span className="font-bold text-emerald-800 text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                          {s.akreditasi}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PERMINTAAN RESET KATA SANDI */}
      {activeTab === 'PERMINTAAN_RESET' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Permintaan Reset Kata Sandi
                </h2>
                {pendingRequests.length > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-rose-600 text-white animate-pulse">
                    {pendingRequests.length} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Pengguna yang lupa kata sandi mengirimkan permohonan ke sini. Klik "Setujui & Reset" untuk mereset ke standar <code>123</code>.
              </p>
            </div>

            <div className="flex rounded-xl border border-slate-300 overflow-hidden text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterResetStatus('ALL')}
                className={`px-3 py-2 font-bold cursor-pointer transition ${
                  filterResetStatus === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Semua ({resetRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterResetStatus('PENDING')}
                className={`px-3 py-2 font-bold cursor-pointer transition ${
                  filterResetStatus === 'PENDING'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Menunggu ({pendingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterResetStatus('RESOLVED')}
                className={`px-3 py-2 font-bold cursor-pointer transition ${
                  filterResetStatus === 'RESOLVED'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Selesai
              </button>
            </div>
          </div>

          {filteredResetRequests.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Tidak Ada Permintaan Reset</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Semua permohonan telah diproses atau belum ada pengguna yang meminta reset kata sandi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredResetRequests.map((req) => {
                const isPending = req.status === 'PENDING';
                const dateStr = new Date(req.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={req.id}
                    className={`rounded-3xl border p-5 shadow-xs transition space-y-4 flex flex-col justify-between ${
                      isPending
                        ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-400/30'
                        : 'bg-white border-slate-200 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isPending
                                ? 'bg-amber-200 text-amber-950 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isPending ? 'Menunggu Persetujuan' : 'Selesai Direset'}
                          </span>
                          <h3 className="font-bold text-slate-900 text-base mt-2">
                            {req.name || req.username}
                          </h3>
                          <div className="text-xs text-slate-500 font-mono">
                            @{req.username} &bull; Peran: <strong>{req.role || 'Pengguna'}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteResetRequest(req)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-white transition cursor-pointer"
                          title="Hapus riwayat permohonan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 p-3 rounded-2xl bg-white border border-slate-200/80 text-xs space-y-1">
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Lembaga / Sekolah:</span>
                          <span className="font-semibold text-slate-800">{req.schoolName || 'Yayasan'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Waktu Pengajuan:</span>
                          <span className="font-medium text-slate-700">{dateStr}</span>
                        </div>
                        {req.notes && (
                          <div className="pt-1.5 border-t border-slate-100 text-slate-700 italic">
                            "{req.notes}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/60">
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => handleApproveReset(req)}
                          className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Setujui &amp; Reset Sandi ke "123"</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Kata sandi telah direset ke bawaan ("123")</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: CADANGKAN & PULIHKAN DATA SISTEM DENGAN ENKRIPSI KUAT & SUPABASE CLOUD */}
      {activeTab === 'BACKUP_DATA' && (
        <div className="space-y-6">
          {/* KARTU INTEGRASI DATABASE CLOUD SUPABASE */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-emerald-500/30 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Database Cloud Supabase (PostgreSQL)
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Cloud DB
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-0.5">
                    Penyimpanan permanen cloud PostgreSQL mandiri terintegrasi langsung dengan API URL &amp; Anon Key yayasan.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                {supabaseStatus?.tableReady ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Tersambung &amp; Aktif</span>
                  </span>
                ) : supabaseStatus?.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Tersambung (Tabel Belum Dibuat)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold">
                    <span>{isCheckingSupabase ? 'Memeriksa...' : 'Siap Terhubung'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] text-emerald-300/80 font-semibold block">Supabase Project URL:</span>
                <span className="font-mono text-white text-[11px] break-all select-all block font-bold">
                  {SUPABASE_CONFIG.url}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] text-emerald-300/80 font-semibold block">Akses Keamanan:</span>
                <span className="text-white text-[11px] block font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Public Anon Key (RLS Enforced)</span>
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] text-emerald-300/80 font-semibold block">Sinkronisasi Otomatis:</span>
                <span className="text-emerald-200 text-[11px] block font-semibold">
                  Multi-Lapis (Browser &bull; Server &bull; Supabase)
                </span>
              </div>
            </div>

            {/* Live Table Rows in Supabase */}
            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-xs">Jumlah Data Tersimpan di Tabel Supabase (Live):</span>
                </div>
                <button
                  type="button"
                  onClick={() => checkSupabase(false)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingSupabase ? 'animate-spin' : ''}`} />
                  <span>Segarkan Jumlah</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Sekolah</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.schools ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">schools</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Pengguna / Guru</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.users ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">users</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Kelas</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.classes ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">classes</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Mata Pelajaran</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.subjects ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">subjects</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Penugasan Guru</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.assignments ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">assignments</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Jurnal Mengajar</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.journals ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">journals</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Presensi Guru</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {supabaseTableCounts?.attendances ?? (isCheckingSupabase ? '...' : 0)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">attendances</div>
                </div>
              </div>
            </div>

            {/* Notice / Instructions */}
            <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Panduan Cepat Aktivasi Tabel di Supabase (Hanya 1x Saja):</span>
                </h4>
                <a
                  href="https://supabase.com/dashboard/project/xgrhsebsrhwmcnpjizhx/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-300 hover:text-white underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka Supabase SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1 leading-relaxed">
                <li>Klik tombol <strong>"Salin Skrip SQL Supabase"</strong> di bawah ini.</li>
                <li>Buka dashboard Supabase pada menu <strong>SQL Editor</strong> &gt; klik <strong>+ New query</strong>.</li>
                <li>Tempel (Paste) skrip SQL dan klik <strong>Run</strong> (selesai dalam 2 detik).</li>
                <li>Kembali ke sini dan klik <strong>"Uji Koneksi &amp; Sinkronkan Sekarang"</strong>.</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopySqlScript}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-md ${
                  copiedSql
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? '✓ Berhasil Disalin!' : 'Salin Skrip SQL Supabase'}</span>
              </button>

              <button
                type="button"
                onClick={handleManualSupabaseSync}
                disabled={isCheckingSupabase}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingSupabase ? 'animate-spin' : ''}`} />
                <span>{isCheckingSupabase ? 'Memproses...' : 'Uji Koneksi & Sinkronkan Sekarang'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSqlViewer(!showSqlViewer)}
                className="px-3.5 py-2.5 bg-transparent hover:bg-white/5 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <span>{showSqlViewer ? 'Sembunyikan Kode SQL' : 'Lihat Skrip SQL Lengkap'}</span>
              </button>
            </div>

            {/* Collapsible SQL Viewer */}
            {showSqlViewer && (
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                  <span className="font-mono text-[11px]">supabase_schema.sql</span>
                  <button
                    type="button"
                    onClick={handleCopySqlScript}
                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Kode</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-64 p-2 bg-slate-900/60 rounded-xl leading-relaxed">
                  {SUPABASE_SETUP_SQL}
                </pre>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-700" />
                  Cadangkan &amp; Pulihkan Data Terenkripsi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sistem dilengkapi enkripsi kuat AES-256-GCM dan verifikasi checksum SHA-256 untuk proteksi cadangan.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-200 shrink-0 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>AES-256-GCM Aktif</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* CARD 1: UNDUH CADANGAN */}
              <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/30 rounded-2xl border border-emerald-200/80 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        1. Unduh Cadangan Data
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Tersedia opsi cadangan standar (.json) dan terenkripsi (.enc.json)
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/80 border border-emerald-100 text-xs space-y-2 mt-3">
                    <div className="flex justify-between text-slate-600">
                      <span>Lembaga / Sekolah Naungan:</span>
                      <strong className="text-slate-900">{schools.length} Lembaga</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Akun Pengguna:</span>
                      <strong className="text-slate-900">{users.length} Akun</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Jurnal Pembelajaran:</span>
                      <strong className="text-slate-900">{StorageService.getJournals().length} Data</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Riwayat Presensi Guru:</span>
                      <strong className="text-slate-900">{StorageService.getAttendances().length} Data</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(true)}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Unduh Cadangan Terenkripsi Kuat (AES-256)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(false)}
                    className="w-full py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Cadangan Standar (.json)</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: UNGGAH & PULIHKAN */}
              <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/30 rounded-2xl border border-amber-200/80 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        2. Unggah &amp; Pulihkan Cadangan
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Mendukung pemulihan file .json biasa dan file .enc.json terenkripsi
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/80 border border-amber-100 text-xs text-slate-600 leading-relaxed mt-3">
                    <p className="font-medium">
                      <strong>Perhatian:</strong> Mengunggah cadangan akan memulihkan data sistem ke titik cadangan tersebut secara aman dan tervalidasi.
                    </p>
                  </div>
                </div>

                <label className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-xs text-center">
                  <Upload className="w-4 h-4" />
                  <span>Pilih File Cadangan (.json / .enc.json)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleSelectBackupFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* CARD 3: DANGER ZONE - RESET SEMUA DATA SISTEM */}
            <div className="mt-6 bg-red-50/80 border border-red-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-red-950 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Reset Total Semua Data Sistem (Mulai Input dari Nol)</span>
                </h3>
                <p className="text-xs text-red-700/90 leading-relaxed max-w-2xl">
                  Fitur ini mengosongkan seluruh data lembaga sekolah, rombel kelas, mapel, penugasan guru, akun pengguna, jurnal, dan presensi baik di browser, server, maupun database Supabase. Akun login Admin Yayasan (username: <code className="bg-red-100 px-1 py-0.5 rounded text-red-900 font-bold">yayasan</code>, password: <code className="bg-red-100 px-1 py-0.5 rounded text-red-900 font-bold">123</code>) tetap dipertahankan agar Anda dapat langsung menginput ulang data dari awal.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirmResetAllData}
                disabled={isCheckingSupabase}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shrink-0 shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isCheckingSupabase ? 'Memproses...' : 'Reset Semua Data Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PESAN MANUAL ADMIN PUSAT & CHAT WHATSAPP */}
      {activeTab === 'PESAN_PUSAT' && (
        <form onSubmit={handleSavePesanDanChat} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                Pesan Manual Admin Pusat &amp; Layanan Chat WhatsApp
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola pesan pemberitahuan yang tampil saat akun dinonaktifkan, serta nomor WhatsApp layanan yayasan.
              </p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Pesan Pengumuman / Penonaktifan Akun</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Pesan ini otomatis tampil kepada pengguna yang akunnya dinonaktifkan.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Judul Pesan Resmi:
                </label>
                <input
                  type="text"
                  required
                  value={broadcastMsg.judulPesan || ''}
                  onChange={(e) => setBroadcastMsg({ ...broadcastMsg, judulPesan: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Isi Pesan Manual dari Admin Pusat:
                </label>
                <textarea
                  required
                  rows={4}
                  value={broadcastMsg.pesanPusat}
                  onChange={(e) => setBroadcastMsg({ ...broadcastMsg, pesanPusat: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white leading-relaxed"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Layanan Menu Chat Admin Yayasan</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ketika pengguna mengklik menu "Chat Admin", kontak dan template teks berikut yang digunakan.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor WhatsApp Admin Yayasan:
                </label>
                <input
                  type="text"
                  required
                  value={chatConfig.whatsappNumber}
                  onChange={(e) => setChatConfig({ ...chatConfig, whatsappNumber: e.target.value })}
                  placeholder="08117000111"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tulisan Teks Pengantar:
                </label>
                <textarea
                  required
                  rows={3}
                  value={chatConfig.chatPromptText}
                  onChange={(e) => setChatConfig({ ...chatConfig, chatPromptText: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white leading-relaxed"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Template Teks WhatsApp:
                </label>
                <input
                  type="text"
                  required
                  value={chatConfig.waTemplateMessage}
                  onChange={(e) => setChatConfig({ ...chatConfig, waTemplateMessage: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB: PANTAU PENGGUNA ONLINE & KELOLA AKUN */}
      {activeTab === 'STATUS_ONLINE' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Pantau Pengguna Online &amp; Status Akun
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin Yayasan dapat memantau pengguna online dan mengaktifkan/menonaktifkan akun pengguna.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    StorageService.fetchOnlineUsers().then(() => setUsers(StorageService.getUsers()));
                    showToast('Status live online pengguna berhasil diperbarui!');
                  }}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  title="Perbarui status online langsung dari server pusat"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Refresh Online</span>
                </button>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari pengguna..."
                    className="pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs w-48 sm:w-60"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Pengguna</span>
                <div className="text-lg font-black text-slate-900 mt-0.5">{users.length}</div>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-700 uppercase font-bold">Online Sekarang</span>
                <div className="text-lg font-black text-emerald-700 mt-0.5">
                  {users.filter((u) => formatLastOnline(u.lastOnline).isOnline).length}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] text-blue-700 uppercase font-bold">Akun Aktif</span>
                <div className="text-lg font-black text-blue-700 mt-0.5">
                  {users.filter((u) => u.statusAktif !== 'NONAKTIF').length}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] text-rose-700 uppercase font-bold">Dinonaktifkan</span>
                <div className="text-lg font-black text-rose-700 mt-0.5">
                  {users.filter((u) => u.statusAktif === 'NONAKTIF').length}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Pengguna</th>
                    <th className="py-3 px-4">Peran &amp; Lembaga</th>
                    <th className="py-3 px-4">Status Online</th>
                    <th className="py-3 px-4">Status Akun</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users
                    .filter(
                      (u) =>
                        !searchQuery ||
                        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        u.username.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((u) => {
                      const onlineInfo = formatLastOnline(u.lastOnline);
                      const isNonaktif = u.statusAktif === 'NONAKTIF';
                      const schoolObj = schools.find((s) => s.id === u.schoolId);
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {u.photoUrl ? (
                                <img
                                  src={u.photoUrl}
                                  alt={u.name}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 font-bold flex items-center justify-center">
                                  {u.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{u.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{u.role}</div>
                            <div className="text-[10px] text-slate-500">
                              {schoolObj?.name || 'Seluruh Yayasan'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {onlineInfo.isOnline ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                                <span>Online Sekarang</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-medium">
                                {onlineInfo.text}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isNonaktif ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                Nonaktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                Aktif
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {u.role !== 'ADMIN_YAYASAN' && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                  isNonaktif
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {isNonaktif ? 'Aktifkan Akun' : 'Nonaktifkan'}
                              </button>
                            )}
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

      {/* MODAL EDIT NAMA & PROFIL ADMIN YAYASAN */}
      {showAdminYayasanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white border border-white/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Edit Nama &amp; Profil Admin Yayasan
                  </h3>
                  <p className="text-xs text-emerald-200/90 mt-0.5">
                    Perbarui nama resmi dan kredensial pengelola
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminYayasanModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAdminYayasan} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-slate-300 bg-white p-0.5 overflow-hidden flex items-center justify-center shrink-0">
                  {adminYayasanFormData.photoUrl ? (
                    <img
                      src={adminYayasanFormData.photoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <span className="text-slate-400 font-bold text-sm">
                      {adminYayasanFormData.name ? adminYayasanFormData.name.charAt(0) : 'A'}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block font-bold text-slate-800 text-xs">
                    Foto Profil Admin Yayasan
                  </label>
                  <label className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadAdminYayasanPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Nama Lengkap Admin Yayasan *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={adminYayasanFormData.name}
                  onChange={(e) =>
                    setAdminYayasanFormData({ ...adminYayasanFormData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Username Akun Admin Yayasan *
                </label>
                <input
                  type="text"
                  required
                  value={adminYayasanFormData.username}
                  onChange={(e) =>
                    setAdminYayasanFormData({ ...adminYayasanFormData, username: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900 font-mono text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Resmi
                  </label>
                  <input
                    type="email"
                    value={adminYayasanFormData.email}
                    onChange={(e) =>
                      setAdminYayasanFormData({ ...adminYayasanFormData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Telepon / WA
                  </label>
                  <input
                    type="text"
                    value={adminYayasanFormData.phone}
                    onChange={(e) =>
                      setAdminYayasanFormData({ ...adminYayasanFormData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1">
                  Kata Sandi Baru (Opsional)
                </label>
                <input
                  type="text"
                  value={adminYayasanFormData.password}
                  onChange={(e) =>
                    setAdminYayasanFormData({ ...adminYayasanFormData, password: e.target.value })
                  }
                  placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdminYayasanModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PEMULIHAN CADANGAN DATA */}
      {backupPendingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5" />
                <h3 className="font-bold text-sm">Konfirmasi Pemulihan Cadangan Data</h3>
              </div>
              <button
                type="button"
                onClick={() => setBackupPendingData(null)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                File cadangan valid siap dipulihkan ke sistem:
              </p>
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Format Cadangan:</span>
                  <strong className="text-amber-900">
                    {backupPendingData.format === 'ASISTENGURU_ENCRYPTED_BACKUP'
                      ? 'Terenkripsi AES-256-GCM'
                      : 'File JSON Standar'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu Cadangan:</span>
                  <strong>
                    {backupPendingData.exportedAt
                      ? new Date(backupPendingData.exportedAt).toLocaleString('id-ID')
                      : 'Tersedia'}
                  </strong>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBackupPendingData(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestoreBackup}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Pulihkan Data Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NONAKTIFKAN AKUN DENGAN PESAN MANUAL */}
      {customSuspensionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-rose-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">Nonaktifkan Akun Pengguna</h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomSuspensionUser(null)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-sm">
                  {customSuspensionUser.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{customSuspensionUser.name}</h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    @{customSuspensionUser.username} &bull; {customSuspensionUser.role}
                  </span>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pesan Khusus untuk Akun Ini:
                </label>
                <textarea
                  rows={4}
                  value={customSuspensionText}
                  onChange={(e) => setCustomSuspensionText(e.target.value)}
                  placeholder="Tulis alasan atau pesan penonaktifan..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white leading-relaxed text-xs"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCustomSuspensionUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  onClick={handleSaveCustomSuspension}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Nonaktifkan Akun</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT GURU */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingTeacher ? 'Edit Data Guru & Foto Profil' : 'Tambah Akun Guru Yayasan'}
              </h3>
              <button
                onClick={() => setShowTeacherModal(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  {teacherFormData.photoUrl ? (
                    <img
                      src={teacherFormData.photoUrl}
                      alt="Foto Guru"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <span className="block font-bold text-slate-800">Foto Profil Guru:</span>
                  <label className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold text-[11px] cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Foto Guru</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTeacherPhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap &amp; Gelar</label>
                <input
                  type="text"
                  required
                  value={teacherFormData.name}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, name: e.target.value })}
                  placeholder="Contoh: Ustadz Ahmad Fauzi, S.Pd."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username Login</label>
                  <input
                    type="text"
                    required
                    value={teacherFormData.username}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, username: e.target.value })}
                    placeholder="guru.ahmad"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {!editingTeacher ? 'Password' : 'NIP / NUPTK'}
                  </label>
                  {!editingTeacher ? (
                    <input
                      type="text"
                      required
                      value={teacherFormData.password}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, password: e.target.value })}
                      placeholder="123"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  ) : (
                    <input
                      type="text"
                      value={teacherFormData.nip}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, nip: e.target.value })}
                      placeholder="19880115..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Telepon / WA</label>
                  <input
                    type="text"
                    value={teacherFormData.phone}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, phone: e.target.value })}
                    placeholder="0813-..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={teacherFormData.email}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, email: e.target.value })}
                    placeholder="guru@rumbaijaya.sch.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-amber-950">
                  <input
                    type="checkbox"
                    checked={teacherFormData.isKepsek}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const initialSchool = teacherFormData.schoolId || (teacherFormData.assignedSchoolIds.length > 0 ? teacherFormData.assignedSchoolIds[0] : (schools.length > 0 ? schools[0].id : ''));
                      setTeacherFormData({
                        ...teacherFormData,
                        isKepsek: checked,
                        schoolId: initialSchool,
                        assignedSchoolIds: checked ? (initialSchool ? [initialSchool] : []) : teacherFormData.assignedSchoolIds,
                      });
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Jadikan Akun Kepala Sekolah (Agar Bisa Absen Masuk &amp; Keluar)</span>
                </label>
              </div>

              {teacherFormData.isKepsek ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 p-4 rounded-2xl border-2 border-amber-300 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-700 shrink-0" />
                    <div>
                      <label className="block font-bold text-slate-900 text-sm">
                        Pilih Sekolah yang Dipimpin (Kepala Sekolah):
                      </label>
                      <p className="text-[11px] text-slate-600">
                        Pilih sekolah masing-masing dari sekolah yang sudah di-input agar tidak hanya satu sekolah.
                      </p>
                    </div>
                  </div>

                  {schools.length === 0 ? (
                    <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 font-semibold">
                      Belum ada sekolah yang di-input yayasan. Silakan tambahkan data sekolah terlebih dahulu pada tab "Kelola Sekolah".
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        required
                        value={teacherFormData.schoolId || (schools.length > 0 ? schools[0].id : '')}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const otherIds = teacherFormData.assignedSchoolIds.filter((id) => id !== teacherFormData.schoolId);
                          setTeacherFormData({
                            ...teacherFormData,
                            schoolId: sid,
                            assignedSchoolIds: sid ? Array.from(new Set([sid, ...otherIds])) : otherIds,
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border-2 border-amber-400 font-bold text-slate-800 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm cursor-pointer shadow-xs"
                      >
                        <option value="" disabled>-- Pilih Sekolah yang Sudah Di-Input --</option>
                        {schools.map((sch) => (
                          <option key={sch.id} value={sch.id}>
                            {sch.name} ({sch.jenjang})
                          </option>
                        ))}
                      </select>

                      {/* Kartu Informasi Sekolah Terpilih */}
                      {(() => {
                        const curSch = schools.find((s) => s.id === (teacherFormData.schoolId || (schools.length > 0 ? schools[0].id : '')));
                        if (!curSch) return null;
                        return (
                          <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-700 space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-amber-900 text-sm">{curSch.name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                Jenjang {curSch.jenjang}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              NPSN: <span className="font-mono text-slate-800 font-semibold">{curSch.npsn || '-'}</span> &bull; Alamat: {curSch.alamat || '-'}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-medium pt-0.5 border-t border-amber-100">
                              Data Kepala Sekolah saat ini: <strong>{curSch.kepalaSekolah || '(Belum diisi)'}</strong>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Penugasan Mengajar di Sekolah Lain (Bisa lebih dari satu) */}
                      <div className="bg-white/90 p-3.5 rounded-xl border border-amber-300 space-y-2 mt-2">
                        <label className="block font-bold text-slate-900 text-xs">
                          Penugasan Mengajar Tambahan di Sekolah Lain (Opsional - Bisa Lebih Dari Satu Sekolah):
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Centang jika Kepala Sekolah ini juga memiliki tugas mengajar atau membina di sekolah lain dalam naungan yayasan.
                        </p>
                        <div className="space-y-1.5 pt-1">
                          {schools.map((sch) => {
                            const isLeadSchool = sch.id === (teacherFormData.schoolId || (schools.length > 0 ? schools[0].id : ''));
                            const isChecked = isLeadSchool || teacherFormData.assignedSchoolIds.includes(sch.id);
                            return (
                              <label
                                key={sch.id}
                                className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition cursor-pointer text-xs ${
                                  isLeadSchool
                                    ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold'
                                    : isChecked
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isLeadSchool}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const nextIds = Array.from(new Set([...teacherFormData.assignedSchoolIds, sch.id]));
                                        setTeacherFormData({ ...teacherFormData, assignedSchoolIds: nextIds });
                                      } else {
                                        const nextIds = teacherFormData.assignedSchoolIds.filter((id) => id !== sch.id);
                                        setTeacherFormData({ ...teacherFormData, assignedSchoolIds: nextIds });
                                      }
                                    }}
                                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                  />
                                  <span>{sch.name} ({sch.jenjang})</span>
                                </div>
                                {isLeadSchool && (
                                  <span className="text-[10px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full font-bold shrink-0">
                                    Sekolah Utama (Kepsek)
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <label className="block font-bold text-slate-900 mb-1.5">
                    Tugas di Lembaga / Sekolah Mana:
                  </label>
                  <div className="space-y-1.5">
                    {schools.map((school) => {
                      const isChecked = teacherFormData.assignedSchoolIds.includes(school.id);
                      return (
                        <label
                          key={school.id}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer text-xs ${
                            isChecked
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const nextIds = [...teacherFormData.assignedSchoolIds, school.id];
                                setTeacherFormData({
                                  ...teacherFormData,
                                  assignedSchoolIds: nextIds,
                                  schoolId: teacherFormData.schoolId || school.id,
                                });
                              } else {
                                const nextIds = teacherFormData.assignedSchoolIds.filter((id) => id !== school.id);
                                setTeacherFormData({
                                  ...teacherFormData,
                                  assignedSchoolIds: nextIds,
                                  schoolId: nextIds.length > 0 ? nextIds[0] : '',
                                });
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                          <span>{school.name} ({school.jenjang})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                {editingTeacher ? (
                  <button
                    type="button"
                    onClick={() => {
                      const t = editingTeacher;
                      setShowTeacherModal(false);
                      handleDeleteTeacher(t);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{editingTeacher?.role === 'KEPALA_SEKOLAH' ? 'Hapus Kepala Sekolah' : 'Hapus Guru'}</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTeacherModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Simpan Akun Guru
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT SEKOLAH */}
      {showSchoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingSchool ? 'Edit Profil Sekolah' : 'Tambah Sekolah Naungan Yayasan'}
              </h3>
              <button
                onClick={() => setShowSchoolModal(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveSchool} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Lembaga / Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolFormData.name || ''}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, name: e.target.value })}
                    placeholder="Contoh: SD Islam Terpadu Al-Fatih"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenjang Pendidikan</label>
                  <select
                    value={schoolFormData.jenjang || 'SD'}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, jenjang: e.target.value as JenjangSekolah })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
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
                    value={schoolFormData.akreditasi || 'A (Unggul)'}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, akreditasi: e.target.value as Akreditasi })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    <option value="A (Unggul)">A (Unggul)</option>
                    <option value="B (Baik)">B (Baik)</option>
                    <option value="C (Cukup)">C (Cukup)</option>
                    <option value="Belum Terakreditasi">Belum Terakreditasi</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NPSN</label>
                  <input
                    type="text"
                    required
                    value={schoolFormData.npsn || ''}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, npsn: e.target.value })}
                    placeholder="Contoh: 10492811"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolFormData.kepalaSekolah || ''}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, kepalaSekolah: e.target.value })}
                    placeholder="Contoh: H. M. Syukri, S.Pd."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    value={schoolFormData.nipKepalaSekolah || ''}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, nipKepalaSekolah: e.target.value })}
                    placeholder="19750814 200003 1 004"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran Aktif</label>
                  <input
                    type="text"
                    value={schoolFormData.tahunAjaranAktif || '2025/2026'}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, tahunAjaranAktif: e.target.value })}
                    placeholder="2025/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Alamat Lembaga</label>
                  <input
                    type="text"
                    value={schoolFormData.alamat || ''}
                    onChange={(e) => setSchoolFormData({ ...schoolFormData, alamat: e.target.value })}
                    placeholder="Jl. Rumbai No..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                {/* FITUR KORDINAT & GEOFENCING ABSEN */}
                <div className="sm:col-span-2 bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-emerald-700" />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Radius Pembatasan Absen (Meter)</h4>
                        <p className="text-[10px] text-slate-600">Aktifkan agar guru hanya bisa absen dalam radius yang ditentukan dari lokasi sekolah.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={!!schoolFormData.enableGeofencing}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, enableGeofencing: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[10px]">Lintang (Lat)</label>
                      <input
                        type="number"
                        step="any"
                        value={schoolFormData.latitude || ''}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, latitude: parseFloat(e.target.value) })}
                        placeholder="-6.2000"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[10px]">Bujur (Lng)</label>
                      <input
                        type="number"
                        step="any"
                        value={schoolFormData.longitude || ''}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, longitude: parseFloat(e.target.value) })}
                        placeholder="106.8166"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[10px]">Radius (M)</label>
                      <input
                        type="number"
                        value={schoolFormData.geofencingRadius || 50}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, geofencingRadius: parseInt(e.target.value) })}
                        placeholder="50"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const pos = await getCurrentLocation();
                        setSchoolFormData({
                          ...schoolFormData,
                          latitude: pos.coords.latitude,
                          longitude: pos.coords.longitude
                        });
                        showToast("Kordinat saat ini berhasil diambil!");
                      } catch (err: any) {
                        showToast(err.message);
                      }
                    }}
                    className="w-full py-2 bg-white border border-emerald-300 text-emerald-800 text-[10px] font-bold rounded-xl hover:bg-emerald-50 transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Ambil Kordinat Lokasi Saat Ini (Admin)
                  </button>
                </div>

                {/* FITUR KUNCI TANGGAL ABSEN HARUS HARI INI */}
                <div className="sm:col-span-2 bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 flex items-center justify-between">
                  <div className="pr-3">
                    <h4 className="font-bold text-indigo-950 text-xs">Kunci Absen Hanya Hari Ini (Otomatis Tanggal Hari Ini)</h4>
                    <p className="text-[10px] text-indigo-700 mt-0.5">
                      Jika diaktifkan, Guru (Bidang Studi, Bantu, Diniyah, Kokurikuler, &amp; Ekstrakurikuler) hanya bisa absen pada tanggal hari ini dan tidak bisa memilih tanggal lain.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={!!schoolFormData.lockAttendanceTodayOnly}
                      onChange={(e) => setSchoolFormData({ ...schoolFormData, lockAttendanceTodayOnly: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                {editingSchool ? (
                  <button
                    type="button"
                    onClick={() => {
                      const sch = editingSchool;
                      setShowSchoolModal(false);
                      handleDeleteSchool(sch);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Sekolah</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSchoolModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Simpan Sekolah
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT ADMIN SEKOLAH */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingAdmin ? 'Edit Akun Admin Sekolah' : 'Tambah Akun Admin Sekolah'}
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveAdmin} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Sekolah yang Dikelola</label>
                <select
                  required
                  value={adminFormData.schoolId}
                  onChange={(e) => setAdminFormData({ ...adminFormData, schoolId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="">-- Pilih Sekolah Naungan --</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.jenjang})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Admin</label>
                <input
                  type="text"
                  required
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  placeholder="Contoh: Admin SD"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={adminFormData.username}
                    onChange={(e) => setAdminFormData({ ...adminFormData, username: e.target.value })}
                    placeholder="admin.sd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                {!editingAdmin && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Password</label>
                    <input
                      type="text"
                      required
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                      placeholder="123"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                {editingAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      const adm = editingAdmin;
                      setShowAdminModal(false);
                      handleDeleteAdmin(adm);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Admin</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Simpan Admin
                  </button>
                </div>
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
