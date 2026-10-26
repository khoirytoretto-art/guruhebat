import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { StorageService } from '../utils/storage';
import { verifyPassword, hashPassword } from '../utils/crypto';
import {
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  LogIn,
  Building2,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { RequestResetPasswordModal } from './common/RequestResetPasswordModal';
import { AnimatedLoginAvatar } from './common/AnimatedLoginAvatar';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [foundation, setFoundation] = useState(StorageService.getFoundation());

  useEffect(() => {
    const updateLocalState = () => {
      setFoundation(StorageService.getFoundation());
    };
    updateLocalState();
    const unsub = StorageService.subscribe(updateLocalState);
    return () => unsub();
  }, []);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const cleanInput = identifier.trim().toLowerCase();
      const currentUsers = StorageService.getUsers();
      const found = currentUsers.find(
        (u) =>
          u.username.toLowerCase() === cleanInput ||
          (u.email && u.email.toLowerCase() === cleanInput)
      );

      if (!found) {
        setErrorMsg('Username atau email tidak terdaftar. Periksa kembali data login Anda.');
        setIsLoading(false);
        return;
      }

      // Strong cryptographic password verification
      const isPasswordValid = await verifyPassword(
        password,
        found.password,
        found.passwordHash,
        found.salt
      );

      if (!isPasswordValid) {
        setErrorMsg('Kata sandi salah. Silakan coba lagi atau ajukan permohonan reset ke Yayasan.');
        setIsLoading(false);
        return;
      }

      // If user only had plain-text password, seamlessly upgrade to salted PBKDF2 hash
      if (!found.passwordHash || !found.salt) {
        const { hash, salt } = await hashPassword(password);
        found.passwordHash = hash;
        found.salt = salt;
        StorageService.updateUser(found);
      }

      StorageService.setCurrentUser(found);
      setIsLoading(false);
      onLoginSuccess(found);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Terjadi kendala saat memverifikasi kredensial. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 font-sans">
      {/* Animated Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-700" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden">
          {/* Header Visual */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
            <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-lg">
              {foundation.logoAppUrl ? (
                <img
                  src={foundation.logoAppUrl}
                  alt="Logo Aplikasi"
                  className="w-12 h-12 object-contain rounded-xl"
                />
              ) : (
                <GraduationCap className="w-10 h-10 text-emerald-300" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
              <span>Asisten</span>
              <span className="text-emerald-300">Guru</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/70 border border-emerald-500/40 rounded-full text-[11px] font-bold text-emerald-200 mt-2">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate max-w-[280px]">{foundation.name}</span>
            </div>
            <p className="text-[11px] text-teal-200/80 mt-1.5 font-medium">
              Satu Aplikasi Yayasan &bull; Diniyah, TK, PAUD, SD, SMP, SMA, SMK
            </p>
          </div>

          {/* Form Area */}
          <div className="p-6 sm:p-7 pt-4">
            <div className="mb-4">
              <AnimatedLoginAvatar isTypingPassword={isTypingPassword} />
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Username atau Email Akun
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onFocus={() => setIsTypingPassword(false)}
                    placeholder="Masukkan username atau email..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsTypingPassword(true)}
                    onBlur={() => setIsTypingPassword(false)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full pl-10 pr-11 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Enkripsi PBKDF2</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3 text-amber-600" />
                    <span>Lupa kata sandi? Minta reset</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Masuk ke Akun</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-1.5">
              <div className="text-[11px] text-slate-500 font-medium">
                &copy; 2026 AsistenGuru &bull; Yayasan Walisongo Rumbai Jaya
              </div>
            </div>
          </div>
        </div>
      </div>

      <RequestResetPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={() => {}}
      />
    </div>
  );
};
