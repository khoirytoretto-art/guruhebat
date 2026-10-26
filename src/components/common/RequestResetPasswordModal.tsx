import React, { useState } from 'react';
import { StorageService } from '../../utils/storage';
import { PasswordResetRequest } from '../../types';
import { KeyRound, X, Send, CheckCircle2, User as UserIcon, AlertCircle } from 'lucide-react';

interface RequestResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestResetPasswordModal: React.FC<RequestResetPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedUsername, setSelectedUsername] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const users = StorageService.getUsers();
  const schools = StorageService.getSchools();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const targetUsername = (selectedUsername || customUsername).trim().toLowerCase();
    if (!targetUsername) {
      setErrorMessage('Pilih atau masukkan username akun Anda.');
      return;
    }

    const targetUser = users.find((u) => u.username.toLowerCase() === targetUsername);
    if (!targetUser) {
      setErrorMessage(`Akun dengan username "@${targetUsername}" tidak ditemukan.`);
      return;
    }

    let schoolName = 'Yayasan Pusat';
    if (targetUser.schoolId) {
      const sch = schools.find((s) => s.id === targetUser.schoolId);
      if (sch) schoolName = sch.name;
    } else if (targetUser.assignedSchoolIds && targetUser.assignedSchoolIds.length > 0) {
      const sch = schools.find((s) => s.id === targetUser.assignedSchoolIds![0]);
      if (sch) schoolName = sch.name;
    }

    const newRequest: PasswordResetRequest = {
      id: `req-${Date.now()}`,
      userId: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      role: targetUser.role,
      schoolName: schoolName,
      notes: notes.trim() || 'Pengguna mengajukan permohonan reset kata sandi.',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    StorageService.addResetRequest(newRequest);
    setIsSuccess(true);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform scale-100 transition-all"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-rose-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-amber-200 border border-white/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Minta Reset Kata Sandi</h3>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Kirim permohonan ke Administrator Yayasan
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

        {isSuccess ? (
          <div className="p-7 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Permintaan Terkirim!</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Permohonan reset kata sandi Anda telah diterima oleh <strong>Admin Yayasan</strong>.
                Admin Yayasan akan memproses dan mereset kata sandi akun Anda secara aman.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-slate-700 leading-relaxed text-[11px]">
              Lupa kata sandi akun Anda? Pilih akun Anda di bawah ini untuk mengirimkan permintaan pemulihan langsung ke sistem Administrator Yayasan.
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                Pilih Akun Anda
              </label>
              <select
                value={selectedUsername}
                onChange={(e) => {
                  setSelectedUsername(e.target.value);
                  if (e.target.value) setCustomUsername('');
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium"
              >
                <option value="">-- Pilih dari daftar akun terdaftar --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.name} (@{u.username}) &bull; {u.role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                Atau Ketik Username Manual
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={customUsername}
                  onChange={(e) => {
                    setCustomUsername(e.target.value);
                    if (e.target.value) setSelectedUsername('');
                  }}
                  placeholder="Contoh: guru.ahmad / admin.sd"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                Catatan (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Terakhir ganti kemarin dan lupa password baru..."
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs resize-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Permintaan</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
