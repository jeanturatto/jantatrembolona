import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, MapPin } from 'lucide-react';

export const CreateEventModal = ({ isOpen, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('Janta das Quintas');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [selectedResponsibles, setSelectedResponsibles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch all users to populate the responsibles list
      const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('name');
        if (data) setUsers(data);
      };
      fetchUsers();
    } else {
      // Reset form
      setName('Janta das Quintas');
      setDate('');
      setLocation('');
      setSearchTerm('');
      setSelectedResponsibles([]);
    }
  }, [isOpen]);

  // Map integration removed by user request

  const toggleResponsible = (userId) => {
    setSelectedResponsibles(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedResponsibles.length === 0) {
      alert('Selecione pelo menos 1 responsável (cozinheiro) para a janta.');
      return;
    }
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('events')
        .insert([{ 
          name: name,
          date: date, 
          location: location || null,
          responsibles: selectedResponsibles,
          status: 'Aberto',
          created_by: user.id
        }]).select();
        
      if (error) throw error;
      
      // Auto-confirm responsibles
      if (data && data.length > 0) {
        const eventId = data[0].id;
        const attendancesToInsert = selectedResponsibles.map(uid => ({
            event_id: eventId,
            user_id: uid,
            status: 'Presente'
        }));
        await supabase.from('attendances').insert(attendancesToInsert);
      }
      
      onSuccess?.();
      onClose();
      navigate('/jantas');
    } catch (error) {
       console.error("Error creating event", error);
       alert("Erro ao criar janta: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Janta">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-400">Nome da Janta</label>
          <input 
            type="text" 
            required 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white" 
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-400">Data</label>
            <input 
              type="date" 
              required 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white" 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-400">Local (Opcional)</label>
            <input 
              type="text" 
              value={location}
              placeholder="Ex: Salão de Festas ou endereço"
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white" 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-400">Cozinheiros (Responsáveis)</label>
          <input 
            type="text" 
            placeholder="Buscar membro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-xs font-medium text-zinc-900 dark:text-white"
          />
          <div className="max-h-48 overflow-y-auto space-y-2 p-1 border border-zinc-100 dark:border-zinc-800 rounded-xl">
            {users.filter(u => {
              const uName = u.name || u.email.split('@')[0];
              return uName.toLowerCase().includes(searchTerm.toLowerCase());
            }).map(u => {
              const uName = u.name || u.email.split('@')[0];
              const uAvatar = u.avatar_url;
              const isSelected = selectedResponsibles.includes(u.id);
              return (
                <div 
                  key={u.id}
                  onClick={() => toggleResponsible(u.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center font-bold text-zinc-500 overflow-hidden shrink-0 text-xs">
                    {uAvatar ? (
                      <img src={uAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (uName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-zinc-900 dark:text-white capitalize">{uName}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black' : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {isSelected && <span className="text-xs">✓</span>}
                  </div>
                </div>
              );
            })}
            {users.length === 0 && <p className="text-[11px] text-zinc-500 text-center italic py-2">Nenhum membro carregado</p>}
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-70 transition-transform active:scale-[0.98]">
            {isLoading ? 'Criando...' : 'Criar Janta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
