import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

const TABS = ['Dados', 'Justificativas'];

export const AdminUserModal = ({ isOpen, onClose, targetUser, onSuccess, initialTab }) => {
  const [tab, setTab] = useState('Dados');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pix, setPix] = useState('');
  const [role, setRole] = useState('USER');
  const [inadimplente, setInadimplente] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [justificativas, setJustificativas] = useState([]);
  const [loadingJust, setLoadingJust] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetUser) return;
    setName(targetUser.name || '');
    setPhone(targetUser.telefone || targetUser.phone || '');
    setPix(targetUser.pix || '');
    setRole(targetUser.role || 'USER');
    setInadimplente(targetUser.inadimplente || false);
    setNewPassword('');
    // Open at initialTab if provided
    setTab(initialTab === 'justificativas' ? 'Justificativas' : 'Dados');
  }, [isOpen, targetUser, initialTab]);

  // Load justificativas when tab opens
  useEffect(() => {
    if (tab !== 'Justificativas' || !targetUser?.id) return;
    const load = async () => {
      setLoadingJust(true);
      const { data } = await supabase
        .from('attendances')
        .select('justificativa, created_at, status')
        .eq('user_id', targetUser.id)
        .eq('status', 'Falta Justificada')
        .not('justificativa', 'is', null)
        .order('created_at', { ascending: false });
      setJustificativas(data || []);
      setLoadingJust(false);
    };
    load();
  }, [tab, targetUser?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update profiles table
      const { error: updateError } = await supabase.from('profiles').update({ name, telefone: phone, pix, role, inadimplente }).eq('id', targetUser.id);
      if (updateError) throw updateError;

      // If new password set, mark must_change_password and use send reset email
      if (newPassword && newPassword.length >= 6) {
        // Admin sets password via Supabase Auth admin API (requires service role - use reset email instead)
        const { error: passError } = await supabase.from('profiles').update({ must_change_password: true }).eq('id', targetUser.id);
        if (passError) throw passError;
        // Send password reset email as secure alternative
        await supabase.auth.resetPasswordForEmail(targetUser.email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        alert(`Perfil atualizado! Um email de redefinição de senha foi enviado para ${targetUser.email}.`);
      } else {
        alert('Perfil atualizado com sucesso!');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white";
  const labelClass = "text-[10px] font-bold uppercase text-zinc-400";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={name || 'Editar Usuário'}>
      {/* Tab bar */}
      <div className="flex gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-1 mb-5 -mt-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-xs font-bold whitespace-nowrap ${tab === t ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Dados' ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>PIX</label>
              <input value={pix} onChange={e => setPix(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="flex flex-col justify-between space-y-1">
              <label className={labelClass}>Status</label>
              <button
                type="button"
                onClick={() => setInadimplente(p => !p)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  inadimplente ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20' : 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20'
                }`}
              >
                {inadimplente ? 'INADIMPLENTE' : 'REGULAR'}
              </button>
            </div>
          </div>

          {/* Password Reset Section */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <label className={labelClass}>Redefinir Senha</label>
            <p className="text-[10px] text-zinc-400 mb-2">Deixe em branco para não alterar. Ao salvar com senha, um email de redefinição será enviado ao usuário.</p>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className={inputClass}
            />
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-[10px] text-red-500 mt-1">Senha muito curta</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (newPassword.length > 0 && newPassword.length < 6)}
              className="flex-1 p-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400 font-medium">Justificativas de falta registradas por este membro.</p>
          {loadingJust ? (
            <p className="text-sm text-zinc-400 text-center py-4 animate-pulse">Carregando...</p>
          ) : justificativas.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <p className="text-sm font-medium">Nenhuma justificativa registrada.</p>
            </div>
          ) : justificativas.map((j, i) => (
            <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
              <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">
                {new Date(j.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">"{j.justificativa}"</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};
