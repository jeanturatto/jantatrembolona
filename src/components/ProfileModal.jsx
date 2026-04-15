import React, { useState, useEffect } from 'react';
import { Camera, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const ProfileModal = ({ isOpen, onClose, user, profile, onSave }) => {
  const { refreshProfile } = useAuth();
  const [phone, setPhone] = useState(profile?.telefone || '');
  const [name, setName] = useState(profile?.name || '');
  const [pix, setPix] = useState(profile?.pix || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [dataNascimento, setDataNascimento] = useState(profile?.data_nascimento || '');

  // Campos de senha — separados do perfil
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [stats, setStats] = useState({ presencas: 0, faltas: 0, perc: 0 });

  // Sync state when profile changes (e.g. after save)
  useEffect(() => {
    if (profile) {
      setPhone(profile.telefone || '');
      setName(profile.name || '');
      setPix(profile.pix || '');
      setAvatarUrl(profile.avatar_url || '');
      setDataNascimento(profile.data_nascimento || '');
    }
  }, [profile]);

  // Reset campos de senha ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaveError('');
      setSaveSuccess('');
    }
  }, [isOpen]);

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
      await supabase.auth.getSession();
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      setSaveError('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveError('');
    setSaveSuccess('');

    // Validações de senha
    const wantsChangePassword = newPassword.length > 0;
    if (wantsChangePassword) {
      if (!oldPassword) {
        setSaveError('Para alterar a senha, informe a senha atual.');
        return;
      }
      if (newPassword.length < 6) {
        setSaveError('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveError('A confirmação da nova senha não coincide.');
        return;
      }
      if (newPassword === oldPassword) {
        setSaveError('A nova senha não pode ser igual à senha atual.');
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Atualiza dados do perfil no banco
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          telefone: phone,
          name,
          pix,
          avatar_url: avatarUrl,
          data_nascimento: dataNascimento || null
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // 2. Se solicitou troca de senha, valida e altera
      if (wantsChangePassword) {
        // Reautentica para validar a senha atual
        await supabase.auth.refreshSession();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: oldPassword
        });

        if (signInError) {
          setSaveError('A senha atual está incorreta. Tente novamente.');
          setSaving(false);
          return;
        }

        // Altera a senha
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
      }

      // 3. Atualiza metadados do auth
      const { error: authError } = await supabase.auth.updateUser({
        data: { name, phone, pix }
      });
      if (authError) throw authError;

      // 4. Refresca o profile no contexto
      await refreshProfile(user.id);

      setSaveSuccess(wantsChangePassword ? 'Perfil e senha atualizados com sucesso!' : 'Perfil atualizado com sucesso!');

      // 5. Notifica parent e fecha após breve delay para o usuário ver o sucesso
      onSave?.({ phone, name, avatarUrl, pix, dataNascimento });
      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err) {
      console.error('ProfileModal save error:', err);
      setSaveError('Erro ao salvar: ' + (err?.message || JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed";
  const inputReadOnly = "w-full p-3 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-400 dark:text-zinc-500 cursor-not-allowed";
  const labelClass = "text-[10px] font-bold uppercase text-zinc-400";

  const passwordsMatch = !newPassword || !confirmPassword || newPassword === confirmPassword;
  const canSave = !uploading && !saving && passwordsMatch && (!newPassword || newPassword.length >= 6);

  return (
    <Modal isOpen={isOpen} onClose={saving ? undefined : onClose} title="Meu Perfil">
      <div className="space-y-5">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          <label className="relative group cursor-pointer shrink-0">
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading || saving} className="hidden" />
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

        {/* Feedback de erro/sucesso dentro do modal */}
        {saveError && (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{saveError}</p>
          </div>
        )}
        {saveSuccess && (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-xl">
            <CheckCircle size={16} className="text-green-500 shrink-0" />
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">{saveSuccess}</p>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} disabled={saving} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>E-mail</label>
            <input readOnly value={user?.email || ''} className={inputReadOnly} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" className={inputClass} disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>PIX</label>
              <input value={pix} onChange={e => setPix(e.target.value)} placeholder="Sua chave PIX" className={inputClass} disabled={saving} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Data de Nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={e => setDataNascimento(e.target.value)}
              className={inputClass}
              disabled={saving}
              style={{ colorScheme: 'light dark' }}
            />
            <p className="text-[10px] text-zinc-400">Usada para o calendário de aniversariantes do grupo.</p>
          </div>

          {/* Seção Alterar Senha */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={13} className="text-zinc-400" />
              <h5 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Alterar Senha</h5>
              <span className="text-[10px] text-zinc-400">(opcional)</span>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Nova Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setSaveError(''); }}
                placeholder="Mínimo de 6 caracteres"
                className={inputClass}
                disabled={saving}
              />
            </div>
            {newPassword && (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Senha Atual (obrigatória para confirmar)</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={e => { setOldPassword(e.target.value); setSaveError(''); }}
                    placeholder="Digite sua senha atual"
                    className={inputClass}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setSaveError(''); }}
                    placeholder="Repita a nova senha"
                    className={inputClass}
                    disabled={saving}
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-[10px] font-bold text-red-500 mt-1">As senhas não coincidem.</p>
                  )}
                </div>
              </>
            )}
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
            disabled={saving}
            className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            disabled={!canSave}
            onClick={handleSave}
            className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Salvando...
              </>
            ) : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
