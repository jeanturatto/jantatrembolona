import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { MapPin } from 'lucide-react';

export const EditEventModal = ({ isOpen, onClose, onSuccess, event, isResponsibleOnly = false }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [selectedResponsibles, setSelectedResponsibles] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Map integration removed by user request

  useEffect(() => {
    if (isOpen && event) {
      setName(event.rawName || 'Janta das Quintas');
      // date is stored as ISO, convert to YYYY-MM-DD for input[type=date]
      setDate(event.rawDate ? event.rawDate.substring(0, 10) : '');
      setLocation(event.rawLocation || '');
      setSelectedResponsibles(event.responsibles || []);

      const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('name');
        if (data) setUsers(data);
      };
      fetchUsers();
    }
  }, [isOpen, event]);

  const toggleResponsible = (userId) => {
    if (isResponsibleOnly) return;
    setSelectedResponsibles(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          name,
          date,
          location: location || null,
          responsibles: selectedResponsibles,
        })
        .eq('id', event.id);

      if (error) throw error;
      
      // Ensure specific responsibles are confirmed in attendances
      if (selectedResponsibles.length > 0) {
        const attendancesToUpsert = selectedResponsibles.map(uid => ({
            event_id: event.id,
            user_id: uid,
            status: 'Presente'
        }));
        await supabase.from('attendances').upsert(attendancesToUpsert, { onConflict: 'event_id,user_id' });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      alert('Erro ao editar janta: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Janta">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-400">Nome da Janta</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-400">Data {isResponsibleOnly && "(Apenas Admin)"}</label>
            <input
              type="date"
              required
              disabled={isResponsibleOnly}
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`w-full p-3 bg-zinc-50 dark:bg-zinc-800 border ${isResponsibleOnly ? 'border-zinc-100 dark:border-zinc-800 opacity-60 cursor-not-allowed text-zinc-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white'} rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-white`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-400">Local (Opcional)</label>
            <input
              type="text"
              value={location}
              placeholder="Ex: Salão de Festas ou endereço"
              onChange={e => setLocation(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        {!isResponsibleOnly && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-400">Cozinheiros (Responsáveis)</label>
            <div className="max-h-48 overflow-y-auto space-y-2 p-1 border border-zinc-100 dark:border-zinc-800 rounded-xl">
              {users.map(u => {
                const uName = u.name || u.email.split('@')[0];
                const uAvatar = u.avatar_url;
                const isSelected = selectedResponsibles.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleResponsible(u.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      isSelected ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600' : 'border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center font-bold text-zinc-500 overflow-hidden shrink-0 text-xs">
                      {uAvatar ? (
                        <img src={uAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (uName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm font-bold truncate text-zinc-900 dark:text-white capitalize">{uName}</p>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black' : 'border-zinc-300 dark:border-zinc-600'
                    }`}>
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-70 transition-transform active:scale-[0.98]">
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
