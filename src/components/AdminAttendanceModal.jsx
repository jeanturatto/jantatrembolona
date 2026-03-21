import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

const STATUS_OPTIONS = [
  { value: 'Presente', label: '✅ Presente', color: 'border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10' },
  { value: 'Falta Justificada', label: '🟡 Falta Justificada', color: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  { value: 'Ausente', label: '❌ Não Vai', color: 'border-zinc-400 text-zinc-500 bg-zinc-100 dark:bg-zinc-800' },
];

export const AdminAttendanceModal = ({ isOpen, onClose, event, onSuccess }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!isOpen || !event?.id) return;
    const load = async () => {
      setLoading(true);
      const [{ data: profiles }, { data: attendances }] = await Promise.all([
        supabase.from('profiles').select('id, name, email, avatar_url').order('name'),
        supabase.from('attendances').select('*').eq('event_id', event.id),
      ]);
      const attMap = Object.fromEntries((attendances || []).map(a => [a.user_id, a]));
      setMembers((profiles || []).map(p => ({
        ...p,
        displayName: p.name || p.email?.split('@')[0],
        status: attMap[p.id]?.status || null,
        justificativa: attMap[p.id]?.justificativa || null,
      })));
      setLoading(false);
    };
    load();
  }, [isOpen, event?.id]);

  const handleSetStatus = async (userId, status) => {
    setSaving(userId);
    try {
      if (!status) {
        const { error } = await supabase.from('attendances').delete().match({ event_id: event.id, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendances').upsert(
          { event_id: event.id, user_id: userId, status },
          { onConflict: 'event_id,user_id' }
        );
        if (error) throw error;
      }
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, status } : m));
      onSuccess?.();
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Presenças">
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">Gerencie a presença de cada membro neste evento.</p>
        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-4 animate-pulse">Carregando membros...</p>
        ) : members.map(m => (
          <div key={m.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-zinc-500 overflow-hidden shrink-0">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.displayName || m.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{m.displayName}</p>
                {m.justificativa && <p className="text-[10px] text-amber-600 italic">Justif: {m.justificativa}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  disabled={saving === m.id}
                  onClick={() => handleSetStatus(m.id, m.status === opt.value ? null : opt.value)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    m.status === opt.value ? opt.color : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  {saving === m.id ? '...' : opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!loading && members.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhum membro encontrado.</p>
        )}
      </div>
    </Modal>
  );
};
