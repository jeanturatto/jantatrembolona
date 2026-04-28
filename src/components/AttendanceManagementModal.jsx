import React, { useState, useEffect } from 'react';
import { Users, Plus, Minus, CheckCircle, XCircle, AlertCircle, UserPlus, X } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const AttendanceManagementModal = ({ 
  isOpen, 
  onClose, 
  event, 
  onSuccess 
}) => {
  const { isAdmin } = useAuth();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedProfiles, setSelectedProfiles] = useState(new Set());
  const [guests, setGuests] = useState([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [guestsLoading, setGuestsLoading] = useState(false);

  // Busca participantes e todos os perfis ao abrir
  useEffect(() => {
    if (!isOpen || !event?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Busca participantes atuais
        const { data: attData } = await supabase
          .from('attendances')
          .select('user_id, status')
          .eq('event_id', event.id);

        const userIds = (attData || []).map(a => a.user_id);
        
        // Busca nomes dos participantes
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);
          
          const namesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p.name || 'Usuário']));
          setAttendees(userIds.map(id => ({
            id,
            name: namesMap[id] || 'Usuário',
            status: attData.find(a => a.user_id === id)?.status || 'Ausente'
          })));
        }

        // Busca todos os perfis para adicionar novos participantes
        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .neq('id', event.responsibles?.[0]); // Exclui responsável atual
        setAllProfiles(allProfilesData || []);

        // Marca perfis já participantes como selecionados
        const alreadySelected = new Set(userIds);
        setSelectedProfiles(alreadySelected);

      } catch (err) {
        console.error('AttendanceManagementModal: erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, event?.id]);

  // Sync guests from event prop
  useEffect(() => {
    if (isOpen && event?.guests !== undefined) {
      setGuests(Array.isArray(event.guests) ? event.guests : []);
      setNewGuestName('');
    }
  }, [isOpen, event?.id]);

  const handleAddParticipant = async (userId) => {
    try {
      // Adiciona participação como "Presente"
      const { error } = await supabase
        .from('attendances')
        .insert({
          event_id: event.id,
          user_id: userId,
          status: 'Presente'
        });

      if (error) throw error;

      // Atualiza estado local
      const profile = allProfiles.find(p => p.id === userId);
      if (profile) {
        setAttendees(prev => [...prev, {
          id: userId,
          name: profile.name || 'Usuário',
          status: 'Presente'
        }]);
        setSelectedProfiles(prev => new Set([...prev, userId]));
      }

      onSuccess?.();
    } catch (err) {
      console.error('Erro ao adicionar participante:', err);
      alert('Erro ao adicionar participante: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleRemoveParticipant = async (userId) => {
    try {
      // Remove participação
      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Atualiza estado local
      setAttendees(prev => prev.filter(att => att.id !== userId));
      setSelectedProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });

      onSuccess?.();
    } catch (err) {
      console.error('Erro ao remover participante:', err);
      alert('Erro ao remover participante: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleUpdateStatus = async (userId, newStatus) => {
    try {
      const { error } = await supabase
        .from('attendances')
        .update({ status: newStatus })
        .eq('event_id', event.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Atualiza estado local
      setAttendees(prev => prev.map(att => 
        att.id === userId ? { ...att, status: newStatus } : att
      ));

      onSuccess?.();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar status: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const saveGuests = async (updatedGuests) => {
    setGuestsLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ guests: updatedGuests })
        .eq('id', event.id);
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

  const filteredProfiles = allProfiles.filter(profile =>
    profile.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.id?.includes(searchTerm)
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Presente': return <CheckCircle size={14} className="text-green-500" />;
      case 'Falta Justificada': return <AlertCircle size={14} className="text-amber-500" />;
      default: return <XCircle size={14} className="text-red-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Presente': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400';
      case 'Falta Justificada': return 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400';
      default: return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400';
    }
  };

  if (!event || !isAdmin) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Presenças">
      {loading ? (
        <div className="py-10 text-center">
          <div className="w-8 h-8 border-4 border-zinc-200 dark:border-zinc-700 border-t-[#2842B5] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Carregando dados...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Participantes Atuais */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Participantes Atuais ({attendees.length})</h3>
            </div>
            
            {attendees.length > 0 ? (
              <div className="space-y-2">
                {attendees.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-600 dark:text-zinc-300">
                        {att.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{att.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(att.status)}`}>
                        {getStatusIcon(att.status)}
                        <span className="ml-1">{att.status}</span>
                      </span>
                      <button
                        onClick={() => handleRemoveParticipant(att.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remover participante"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Nenhum participante adicionado.</p>
            )}
          </div>

          {/* Adicionar Novos Participantes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Adicionar Participantes</h3>
            </div>
            
            <div className="space-y-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou ID..."
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#2842B5] dark:focus:border-white"
              />
              
              {filteredProfiles.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredProfiles.map((profile) => (
                    <div 
                      key={profile.id} 
                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-600 dark:text-zinc-300">
                          {profile.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{profile.name}</span>
                      </div>
                      <button
                        onClick={() => handleAddParticipant(profile.id)}
                        disabled={selectedProfiles.has(profile.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          selectedProfiles.has(profile.id)
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-not-allowed'
                            : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30'
                        }`}
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                searchTerm && (
                  <p className="text-sm text-zinc-400 italic">Nenhum perfil encontrado.</p>
                )
              )}
            </div>
          </div>

          {/* Convidados */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Convidados ({guests.length})</h3>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                placeholder="Nome do convidado..."
                className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#2842B5] dark:focus:border-white"
              />
              <button
                onClick={handleAddGuest}
                disabled={guestsLoading || !newGuestName.trim()}
                className="px-3 py-2 bg-[#2842B5] hover:bg-[#3452c5] disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all"
              >
                <Plus size={16} />
              </button>
            </div>

            {guests.length > 0 ? (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {guests.map((guest, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50"
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{guest}</span>
                    <button
                      onClick={() => handleRemoveGuest(idx)}
                      disabled={guestsLoading}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Remover convidado"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Nenhum convidado adicionado.</p>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={() => onSuccess?.()}
              className="flex-1 py-3 bg-[#2842B5] hover:bg-[#3452c5] text-white rounded-xl font-bold text-sm transition-all"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};