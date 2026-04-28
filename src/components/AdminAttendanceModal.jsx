import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { Users, Plus, UserPlus, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'Presente', label: '✅ Presente', color: 'border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10' },
  { value: 'Falta Justificada', label: '🟡 Falta Justificada', color: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  { value: 'Ausente', label: '❌ Não Vai', color: 'border-zinc-400 text-zinc-500 bg-zinc-100 dark:bg-zinc-800' },
];

export const AdminAttendanceModal = ({ isOpen, onClose, event, onSuccess }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [guests, setGuests] = useState([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [guestsLoading, setGuestsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !event?.id) return;
    const load = async () => {
      setLoading(true);
      const [{ data: profiles }, { data: attendances }, { data: eventData }] = await Promise.all([
        supabase.from('profiles').select('id, name, email, avatar_url').order('name'),
        supabase.from('attendances').select('*').eq('event_id', event.id),
        supabase.from('events').select('guests').eq('id', event.id).single(),
      ]);
      const attMap = Object.fromEntries((attendances || []).map(a => [a.user_id, a]));
      setMembers((profiles || []).map(p => ({
        ...p,
        displayName: p.name || p.email?.split('@')[0],
        status: attMap[p.id]?.status || null,
        justificativa: attMap[p.id]?.justificativa || null,
      })));
      setGuests(Array.isArray(eventData?.guests) ? eventData.guests : []);
      setLoading(false);
    };
    load();
  }, [isOpen, event?.id]);

  const saveGuests = async (updatedGuests) => {
    setGuestsLoading(true);
    try {
      const { error } = await supabase.from('events').update({ guests: updatedGuests }).eq('id', event.id);
      if (error) throw error;
      setGuests(updatedGuests);
      onSuccess?.();
    } catch (err) {
      alert('Erro ao salvar convidados: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setGuestsLoading(false);
    }
  };

  const handleAddGuest = async () => {
    const name = newGuestName.trim();
    if (!name) return;
    const updated = [...guests, name];
    setNewGuestName('');
    await saveGuests(updated);
  };

  const handleRemoveGuest = async (idx) => {
    const updated = guests.filter((_, i) => i !== idx);
    await saveGuests(updated);
  };

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
      <div className="space-y-4">
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

        {/* Convidados */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-zinc-400" />
            <p className="text-sm font-bold text-zinc-900 dark:text-white">Convidados ({guests.length})</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
              placeholder="Nome do convidado..."
              className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#2842B5]"
            />
            <button
              onClick={handleAddGuest}
              disabled={guestsLoading || !newGuestName.trim()}
              className="px-3 py-2 bg-[#2842B5] hover:bg-[#3452c5] disabled:opacity-50 text-white rounded-lg font-bold text-sm"
            >
              <Plus size={16} />
            </button>
          </div>
          {guests.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {guests.map((guest, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <span className="text-sm text-zinc-900 dark:text-white">{guest}</span>
                  <button
                    onClick={() => handleRemoveGuest(idx)}
                    disabled={guestsLoading}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
