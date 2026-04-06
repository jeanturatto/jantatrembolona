import React, { useState, useEffect, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

export const ProfileModal = ({ isOpen, onClose, user, profile, onSave }) => {
  const [phone, setPhone] = useState(profile?.telefone || '');
  const [name, setName] = useState(profile?.name || '');
  const [pix, setPix] = useState(profile?.pix || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ presencas: 0, faltas: 0, perc: 0 });

  // Sync state when profile changes (e.g. after save)
  useEffect(() => {
    if (profile) {
      setPhone(profile.telefone || '');
      setName(profile.name || '');
      setPix(profile.pix || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  // Fetch real attendance stats when modal opens
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    const fetchStats = async () => {
      const { data } = await supabase
        .from('attendances')
        .select('status')
        .eq('user_id', user.id);
      if (data) {
        const presencas = data.filter(a => a.status === 'Presente').length;
        const faltas = data.filter(a => a.status !== 'Presente').length;
        const total = data.length;
        const perc = total > 0 ? Math.round((presencas / total) * 100) : 0;
        setStats({ presencas, faltas, perc });
      }
    };
    fetchStats();
  }, [isOpen, user?.id]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      alert('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Classes padronizadas com os demais modais
  const inputClass = "w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white";
  const inputReadOnly = "w-full p-3 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-400 dark:text-zinc-500 cursor-not-allowed";
  const labelClass = "text-[10px] font-bold uppercase text-zinc-400";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Meu Perfil">
      <div className="space-y-5">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          <label className="relative group cursor-pointer shrink-0">
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white uppercase overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                : (name?.charAt(0) || user?.email?.charAt(0) || 'U')
              }
            </div>
            <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
              {uploading ? <span className="text-[10px] font-bold">...</span> : <Camera size={20} />}
            </div>
          </label>
          <div>
            <h4 className="font-bold text-lg text-zinc-900 dark:text-white capitalize">{name || 'Usuário'}</h4>
            <span className="px-2 py-0.5 bg-zinc-900 text-white dark:bg-white dark:text-black text-[10px] font-bold rounded-full uppercase">
              {profile?.role || 'USER'}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>E-mail</label>
            <input readOnly value={user?.email || ''} className={inputReadOnly} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>PIX</label>
              <input value={pix} onChange={e => setPix(e.target.value)} placeholder="Sua chave PIX" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Real stats */}
        <div className="grid grid-cols-3 gap-2 py-4 border-y border-zinc-100 dark:border-zinc-800">
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{stats.presencas}</p>
            <p className={labelClass}>Presenças</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-red-500">{stats.faltas}</p>
            <p className={labelClass}>Faltas</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${stats.perc >= 70 ? 'text-green-600' : stats.perc >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{stats.perc}%</p>
            <p className={labelClass}>Partic.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={uploading}
            onClick={() => onSave?.({ phone, name, avatarUrl, pix })}
            className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {uploading ? 'Aguarde...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
