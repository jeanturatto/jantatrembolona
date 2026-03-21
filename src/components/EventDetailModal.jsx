import React, { useEffect, useState } from 'react';
import { MapPin, Calendar, Users, Utensils } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

export const EventDetailModal = ({ isOpen, onClose, event }) => {
  const [responsaveis, setResponsaveis] = useState([]);

  useEffect(() => {
    if (!isOpen || !event?.responsibles?.length) {
      setResponsaveis([]);
      return;
    }
    const fetchResponsaveis = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', event.responsibles);
      if (data) setResponsaveis(data);
    };
    fetchResponsaveis();
  }, [isOpen, event]);

  if (!event) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event.name || 'Detalhes da Janta'}>
      <div className="space-y-5">

        {/* Status badge */}
        <span className={`inline-block text-[10px] px-3 py-1 rounded-full font-bold uppercase ${
          event.status === 'Aberto' ? 'bg-green-100 text-green-700 dark:bg-green-500/20' :
          event.status === 'Finalizado' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800' :
          'bg-zinc-100 text-zinc-400'
        }`}>
          {event.status}
        </span>

        {/* Info rows */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <Calendar size={16} className="text-zinc-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Data</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{event.dateFormatted}</p>
            </div>
          </div>

          {event.location && (
            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
              <MapPin size={16} className="text-zinc-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Local</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{event.location}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <Users size={16} className="text-zinc-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Confirmados</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">{event.attendees} presentes</p>
            </div>
          </div>
        </div>

        {/* Responsáveis */}
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2 flex items-center gap-1">
            <Utensils size={11} /> Cozinheiros (Responsáveis)
          </p>
          {responsaveis.length > 0 ? (
            <div className="space-y-2">
              {responsaveis.map(r => {
                const nome = r.name || r.email?.split('@')[0] || 'Usuário';
                return (
                  <div key={r.id} className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-600 dark:text-zinc-300 overflow-hidden shrink-0">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt={nome} className="w-full h-full object-cover" />
                      ) : nome.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{nome}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">Nenhum responsável definido.</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
};
