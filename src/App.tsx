import React, { useState, useEffect } from 'react';
import { User, School } from './types';
import { StorageService } from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { GreetingBanner } from './components/GreetingBanner';
import { QuoteBanner } from './components/QuoteBanner';
import { AdminYayasanDashboard } from './components/yayasan/AdminYayasanDashboard';
import { AdminSekolahDashboard } from './components/sekolah/AdminSekolahDashboard';
import { KepalaSekolahDashboard } from './components/kepsek/KepalaSekolahDashboard';
import { GuruDashboard } from './components/guru/GuruDashboard';
import { AccountSettingsModal } from './components/common/AccountSettingsModal';
import { MobileEWalletView } from './components/common/MobileEWalletView';
import { MobileBottomBar } from './components/common/MobileBottomBar';
import { SuspendedUserView } from './components/common/SuspendedUserView';
import { ChatAdminModal } from './components/common/ChatAdminModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [currentSchool, setCurrentSchool] = useState<School | null>(() => {
    const user = StorageService.getCurrentUser();
    if (!user || user.role === 'ADMIN_YAYASAN') return null;
    const storedSchoolId = typeof window !== 'undefined' ? localStorage.getItem('asistenguru_current_school_id') : null;
    if (storedSchoolId) {
      const sch = StorageService.getSchoolById(storedSchoolId);
      if (sch) return sch;
    }
    if (user.schoolId) {
      return StorageService.getSchoolById(user.schoolId) || null;
    }
    const schools = StorageService.getSchools();
    return schools.length > 0 ? schools[0] : null;
  });
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('asistenguru_active_tab');
      if (saved) return saved;
    }
    const user = StorageService.getCurrentUser();
    if (!user) return '';
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (isMobile) return 'BERANDA';
    if (user.role === 'ADMIN_YAYASAN') return 'SEKOLAH';
    if (user.role === 'ADMIN_SEKOLAH') return 'CETAK_REKAP';
    if (user.role === 'KEPALA_SEKOLAH') return 'ABSEN_KEPSEK';
    return 'INPUT_TUGAS';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined' && tab) {
      try {
        localStorage.setItem('asistenguru_active_tab', tab);
      } catch {}
    }
  };

  const handleSetCurrentSchool = (sch: School | null) => {
    setCurrentSchool(sch);
    if (typeof window !== 'undefined') {
      try {
        if (sch?.id) {
          localStorage.setItem('asistenguru_current_school_id', sch.id);
        } else {
          localStorage.removeItem('asistenguru_current_school_id');
        }
      } catch {}
    }
  };

  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [showChatAdminModal, setShowChatAdminModal] = useState(false);
  const [key, setKey] = useState(0);

  // Initialize data from server and continuous background sync
  useEffect(() => {
    StorageService.init().then(() => {
      setKey((prev) => prev + 1);
    });

    const unsubscribe = StorageService.subscribe(() => {
      setKey((prev) => prev + 1);
    });

    // Background sync real-time ultra-cepat setiap 3.5 detik (dengan ETag 304, zero overhead)
    const syncInterval = setInterval(() => {
      StorageService.syncFromServer();
    }, 3500);

    // Sinkronisasi otomatis saat browser / tab kembali aktif (dengan debouncing)
    let focusDebounce: any = null;
    const handleFocus = () => {
      if (focusDebounce) clearTimeout(focusDebounce);
      focusDebounce = setTimeout(() => {
        StorageService.syncFromServer();
      }, 300);
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
      if (focusDebounce) clearTimeout(focusDebounce);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Online Heartbeat Tracker (Kirim sinyal online ke server setiap 20 detik & saat ada interaksi)
  useEffect(() => {
    if (currentUser?.id) {
      StorageService.recordUserOnline(currentUser.id);
      const interval = setInterval(() => {
        StorageService.recordUserOnline(currentUser.id);
      }, 20000);

      let lastActivityPing = Date.now();
      const handleActivity = () => {
        const now = Date.now();
        if (now - lastActivityPing > 15000) {
          lastActivityPing = now;
          StorageService.recordUserOnline(currentUser.id);
        }
      };

      window.addEventListener('click', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      window.addEventListener('keydown', handleActivity);

      return () => {
        clearInterval(interval);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
        window.removeEventListener('keydown', handleActivity);
      };
    }
  }, [currentUser?.id]);

  // Update user and current school on key change (menjaga pilihan sekolah aktif agar tidak ter-reset otomatis)
  useEffect(() => {
    const user = StorageService.getCurrentUser();
    setCurrentUser(user);

    if (user) {
      if (!activeTab) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (isMobile) {
          setActiveTab('BERANDA');
        } else if (user.role === 'ADMIN_YAYASAN') {
          setActiveTab('SEKOLAH');
        } else if (user.role === 'ADMIN_SEKOLAH') {
          setActiveTab('CETAK_REKAP');
        } else if (user.role === 'KEPALA_SEKOLAH') {
          setActiveTab('ABSEN_KEPSEK');
        } else {
          setActiveTab('INPUT_TUGAS');
        }
      }

      if (user.role === 'ADMIN_YAYASAN') {
        handleSetCurrentSchool(null);
      } else if (user.role === 'GURU') {
        // HANYA sekolah yang ditugaskan kepada guru ini oleh Admin Yayasan / Admin Sekolah
        const teacherAssignments = StorageService.getAssignments().filter((a) => a.teacherId === user.id);
        const asgSchoolIds = teacherAssignments.map((a) => a.schoolId).filter(Boolean);
        let assignedIds: string[] = [];
        if (Array.isArray(user.assignedSchoolIds) && user.assignedSchoolIds.length > 0) {
          assignedIds = user.assignedSchoolIds;
        } else if (asgSchoolIds.length > 0) {
          assignedIds = Array.from(new Set(asgSchoolIds));
        } else if (user.schoolId) {
          assignedIds = [user.schoolId];
        }

        if (assignedIds.length > 0) {
          setCurrentSchool((prev) => {
            if (prev && assignedIds.includes(prev.id)) {
              return StorageService.getSchoolById(prev.id) || prev;
            }
            return StorageService.getSchoolById(assignedIds[0]) || null;
          });
        } else {
          setCurrentSchool(null);
        }
      } else if (user.role === 'KEPALA_SEKOLAH') {
        // HANYA sekolah tempat kepala sekolah ini ditugaskan
        const targetId = user.schoolId || (user.assignedSchoolIds && user.assignedSchoolIds.length > 0 ? user.assignedSchoolIds[0] : null);
        setCurrentSchool((prev) => {
          if (targetId) {
            const sch = StorageService.getSchoolById(targetId);
            return sch || prev;
          }
          if (prev) {
            const updated = StorageService.getSchoolById(prev.id);
            if (updated) return updated;
          }
          const allSchools = StorageService.getSchools();
          const matched = allSchools.find((s) => s.kepalaSekolah && s.kepalaSekolah.trim().toLowerCase() === user.name.trim().toLowerCase());
          return matched || (allSchools.length > 0 ? allSchools[0] : null);
        });
      } else {
        setCurrentSchool((prev) => {
          if (prev) {
            const updated = StorageService.getSchoolById(prev.id);
            if (updated) return updated;
          }
          if (user.schoolId) {
            return StorageService.getSchoolById(user.schoolId) || null;
          }
          if (user.assignedSchoolIds && user.assignedSchoolIds.length > 0) {
            return StorageService.getSchoolById(user.assignedSchoolIds[0]) || null;
          }
          const schools = StorageService.getSchools();
          return schools.length > 0 ? schools[0] : null;
        });
      }
    }
  }, [key]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (isMobile) {
      setActiveTab('BERANDA');
    } else if (user.role === 'ADMIN_YAYASAN') {
      setActiveTab('SEKOLAH');
    } else if (user.role === 'ADMIN_SEKOLAH') {
      setActiveTab('CETAK_REKAP');
    } else if (user.role === 'KEPALA_SEKOLAH') {
      setActiveTab('ABSEN_KEPSEK');
    } else {
      setActiveTab('INPUT_TUGAS');
    }

    if (user.role === 'ADMIN_YAYASAN') {
      setCurrentSchool(null);
    } else if (user.role === 'GURU') {
      // HANYA sekolah yang ditugaskan kepada guru ini
      const teacherAssignments = StorageService.getAssignments().filter((a) => a.teacherId === user.id);
      const asgSchoolIds = teacherAssignments.map((a) => a.schoolId).filter(Boolean);
      let assignedIds: string[] = [];
      if (Array.isArray(user.assignedSchoolIds) && user.assignedSchoolIds.length > 0) {
        assignedIds = user.assignedSchoolIds;
      } else if (asgSchoolIds.length > 0) {
        assignedIds = Array.from(new Set(asgSchoolIds));
      } else if (user.schoolId) {
        assignedIds = [user.schoolId];
      }

      if (assignedIds.length > 0) {
        const sch = StorageService.getSchoolById(assignedIds[0]);
        setCurrentSchool(sch || null);
      } else {
        setCurrentSchool(null);
      }
    } else if (user.role === 'KEPALA_SEKOLAH') {
      // HANYA sekolah tempat kepala sekolah ini ditugaskan
      const targetId = user.schoolId || (user.assignedSchoolIds && user.assignedSchoolIds.length > 0 ? user.assignedSchoolIds[0] : null);
      if (targetId) {
        const sch = StorageService.getSchoolById(targetId);
        setCurrentSchool(sch || null);
      } else {
        const allSchools = StorageService.getSchools();
        const matched = allSchools.find((s) => s.kepalaSekolah && s.kepalaSekolah.trim().toLowerCase() === user.name.trim().toLowerCase());
        setCurrentSchool(matched || (allSchools.length > 0 ? allSchools[0] : null));
      }
    } else if (user.schoolId) {
      const sch = StorageService.getSchoolById(user.schoolId);
      if (sch) setCurrentSchool(sch);
    } else if (user.assignedSchoolIds && user.assignedSchoolIds.length > 0) {
      const sch = StorageService.getSchoolById(user.assignedSchoolIds[0]);
      if (sch) setCurrentSchool(sch);
    } else {
      const schools = StorageService.getSchools();
      if (schools.length > 0) setCurrentSchool(schools[0]);
    }
    setKey((prev) => prev + 1);
  };

  const handleLogout = () => {
    StorageService.setCurrentUser(null);
    setCurrentUser(null);
  };

  const handleSwitchToSchoolAdmin = (schoolId: string) => {
    const sch = StorageService.getSchoolById(schoolId);
    if (sch) setCurrentSchool(sch);
    setActiveTab('SEKOLAH');
  };

  const handleSwitchToTeacher = () => {
    setActiveTab('GURU');
  };

  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.statusAktif === 'NONAKTIF') {
    return (
      <SuspendedUserView
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans antialiased">
      {/* Sidebar on the Left */}
      <Sidebar
        currentUser={currentUser}
        currentSchool={currentSchool}
        activeTab={activeTab}
        onTabSelect={(tab) => setActiveTab(tab)}
        onLogout={handleLogout}
        onOpenAccountSettings={() => setShowAccountSettingsModal(true)}
        onOpenChatAdmin={() => setShowChatAdminModal(true)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-h-screen">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          {activeTab === 'BERANDA' && (
            <>
              <GreetingBanner
                currentUser={currentUser}
                currentSchool={currentSchool}
              />
              <QuoteBanner
                canEdit={currentUser.role === 'ADMIN_YAYASAN'}
                onEditRequested={() => setActiveTab('KUTIPAN_BRANDING')}
              />
            </>
          )}

          {activeTab === 'BERANDA' && (
            <MobileEWalletView
              currentUser={currentUser}
              currentSchool={currentSchool}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenAccountSettings={() => setShowAccountSettingsModal(true)}
              onOpenChatAdmin={() => setShowChatAdminModal(true)}
            />
          )}

          {activeTab !== 'BERANDA' && currentUser.role === 'ADMIN_YAYASAN' && (
            <AdminYayasanDashboard
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab)}
              onDataChanged={() => setKey((k) => k + 1)}
              onSwitchToSchoolAdmin={handleSwitchToSchoolAdmin}
              onSwitchToTeacher={handleSwitchToTeacher}
              currentUser={currentUser}
              onUserUpdated={(updatedUser) => {
                setCurrentUser(updatedUser);
                setKey((k) => k + 1);
              }}
            />
          )}

          {activeTab !== 'BERANDA' && currentUser.role === 'ADMIN_SEKOLAH' && currentSchool && (
            <AdminSekolahDashboard
              currentSchool={currentSchool}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab)}
              onSchoolUpdated={() => setKey((k) => k + 1)}
            />
          )}

          {activeTab !== 'BERANDA' && currentUser.role === 'KEPALA_SEKOLAH' && currentSchool && (
            activeTab === 'INPUT_TUGAS' || activeTab === 'RIWAYAT_CETAK' ? (
              <GuruDashboard
                currentUser={currentUser}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab)}
                onDataChanged={() => setKey((k) => k + 1)}
              />
            ) : (
              <KepalaSekolahDashboard
                currentUser={currentUser}
                currentSchool={currentSchool}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab)}
                onDataChanged={() => setKey((k) => k + 1)}
                onSchoolChange={(sch) => setCurrentSchool(sch)}
              />
            )
          )}

          {activeTab !== 'BERANDA' && currentUser.role === 'GURU' && (
            <GuruDashboard
              currentUser={currentUser}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab)}
              onDataChanged={() => setKey((k) => k + 1)}
            />
          )}
        </main>

        <footer className="bg-white/80 border-t border-slate-200 py-3.5 px-6 text-center text-xs text-slate-500 no-print mt-auto pb-16 lg:pb-3.5">
          <p>
            &copy; 2026 AsistenGuru &bull; Yayasan Walisongo Rumbai Jaya
          </p>
        </footer>
      </div>

      <MobileBottomBar
        currentUser={currentUser}
        activeTab={activeTab}
        onTabSelect={(tab) => setActiveTab(tab)}
        onOpenAccountSettings={() => setShowAccountSettingsModal(true)}
      />

      <AccountSettingsModal
        isOpen={showAccountSettingsModal}
        currentUser={currentUser}
        onClose={() => setShowAccountSettingsModal(false)}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          setKey((k) => k + 1);
        }}
      />

      <ChatAdminModal
        isOpen={showChatAdminModal}
        onClose={() => setShowChatAdminModal(false)}
      />
    </div>
  );
}
