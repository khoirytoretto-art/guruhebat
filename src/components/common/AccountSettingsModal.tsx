import React, { useState, useRef } from 'react';
import { User } from '../../types';
import { StorageService } from '../../utils/storage';
import { KeyRound, User as UserIcon, Lock, Eye, EyeOff, X, Check, AlertCircle, Camera, Trash2, Upload, ShieldCheck } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface AccountSettingsModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onUserUpdated,
}) => {
  const [newName, setNewName] = useState(currentUser.name || '');
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [newEmail, setNewEmail] = useState(currentUser.email || '');
  const [newPhone, setNewPhone] = useState(currentUser.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>(currentUser.photoUrl || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmPhotoDelete, setShowConfirmPhotoDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format file harus berupa gambar (JPG, PNG, atau WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 200, 200);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setNewPhotoUrl(compressedDataUrl);
          setErrorMsg('');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setShowConfirmPhotoDelete(true);
  };

  const confirmDeletePhoto = () => {
    setNewPhotoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setErrorMsg('Nama tidak boleh kosong.');
      return;
    }

    const trimmedUsername = newUsername.trim().toLowerCase();
    if (!trimmedUsername) {
      setErrorMsg('Username tidak boleh kosong.');
      return;
    }
    if (trimmedUsername.length < 3) {
      setErrorMsg('Username minimal harus 3 karakter.');
      return;
    }
    if (/\s/.test(trimmedUsername)) {
      setErrorMsg('Username tidak boleh mengandung spasi.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMsg('Demi keamanan terenkripsi, kata sandi baru minimal harus 6 karakter.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.');
        return;
      }
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const result = StorageService.updateUserCredentials(
        currentUser.id,
        trimmedUsername,
        newPassword || undefined,
        trimmedName,
        newEmail.trim(),
        newPhone.trim(),
        newPhotoUrl
      );

      setIsSubmitting(false);
      if (!result.success) {
        setErrorMsg(result.message);
        return;
      }

      setSuccessMsg(result.message);
      if (result.updatedUser) {
        onUserUpdated(result.updatedUser);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform scale-100 transition-all max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-emerald-300 border border-white/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Pengaturan Profil & Keamanan</h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Ubah foto profil, username, dan kata sandi mandiri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Snapshot with Photo Upload */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/70 flex items-center justify-between gap-3.5 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative group shrink-0">
              {newPhotoUrl ? (
                <img
                  src={newPhotoUrl}
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white font-extrabold flex items-center justify-center text-xl shadow-md border-2 border-emerald-600">
                  {currentUser.name.charAt(0)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition cursor-pointer"
                title="Ganti Foto Profil"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <h4 className="font-bold text-slate-900 truncate">{currentUser.name}</h4>
              <p className="text-slate-500 font-medium truncate">
                {currentUser.email || `@${currentUser.username}`} &bull; NIP: {currentUser.nip || '-'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>{newPhotoUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
                </button>
                {newPhotoUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-[11px] font-medium text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Security Indicator */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-[11px]">
                <strong className="block">Perlindungan Kriptografi Aktif</strong>
                <span className="text-emerald-700">Kata sandi baru otomatis dienkripsi dengan PBKDF2-SHA256 salted hash.</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                {currentUser.role === 'ADMIN_YAYASAN'
                  ? 'Nama Administrator Yayasan *'
                  : 'Nama Lengkap Pengguna *'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama lengkap..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                Username Baru *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-mono font-bold">
                  @
                </div>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username akun Anda..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Email Resmi (Opsional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nama@domain.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  No. WhatsApp / HP (Opsional)
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-800">
                  Kata Sandi Baru (Opsional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? 'Sembunyikan' : 'Lihat Sandi'}</span>
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                />
              </div>
            </div>

            {newPassword.length > 0 && (
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Konfirmasi Kata Sandi Baru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru..."
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Menyimpan & Enkripsi...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmPhotoDelete}
        title="Hapus Foto Profil?"
        message="Foto profil yang terpasang akan dihapus dari akun Anda."
        confirmText="Ya, Hapus Foto"
        type="danger"
        onConfirm={confirmDeletePhoto}
        onClose={() => setShowConfirmPhotoDelete(false)}
      />
    </div>
  );
};
