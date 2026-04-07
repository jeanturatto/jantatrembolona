import React, { useEffect, useState } from 'react';
import { MapPin, Calendar, Users, Utensils, CheckCircle2, XCircle, AlertCircle, Lock, Edit3 } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Props:
 *   event         - formatted event object (with id, name, dateFormatted, location, status, attendees, responsibles, userStatus, rawDate)
 *   isOpen        - bool
 *   onClose       - fn
 *   onAttendance  - fn(eventId, status) — called when user picks Presente / Ausente
 *   onJustificativa - fn(eventId) — called when user picks Falta Justificada
 *   actionLoading - bool
 *   pastDeadline  - bool
 */
export const EventDetailModal = ({
  isOpen,
  onClose,
  event,
  onAttendance,
  onJustificativa,
  actionLoading,
  pastDeadline,
  onEditClick,
}) => {
  const { user } = useAuth();
  const [responsaveis, setResponsaveis] = useState([]);

  const isUserResponsible = event?.responsibles?.includes(user?.id);

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

  const isOpen_ = event.status === 'Aberto';
  const userStatus = event.userStatus;

  const btnBase = 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-[0.97]';

  // Helpers para estilo dos botões de presença
  const getBtnStyle = (thisStatus) => {
    if (!userStatus) {
      // Nenhum status: todos ativos
      if (thisStatus === 'Presente')       return 'border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20';
      if (thisStatus === 'Falta Justificada') return 'border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20';
      return 'border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800';
    }
    if (userStatus === thisStatus) {
      // Este é o selecionado: destaque forte
      if (thisStatus === 'Presente')       return 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200 dark:shadow-green-900/30';
      if (thisStatus === 'Falta Justificada') return 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-200 dark:shadow-amber-900/30';
      return 'bg-zinc-500 border-zinc-500 text-white';
    }
    // Outro: apagado e sem função
    return 'border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 opacity-40 cursor-not-allowed';
  };

  const isBtnDisabled = (thisStatus) => !!actionLoading || (!!userStatus && userStatus !== thisStatus);

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
                        <img src={r.avatar_url} alt={nome || ''} className="w-full h-full object-cover" />
                      ) : (nome || 'U').charAt(0).toUpperCase()}
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

        {/* Attendance buttons — only for open events with handler prop */}
        {isOpen_ && onAttendance && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
            <p className="text-[10px] font-bold text-zinc-400 uppercase">Sua confirmação</p>
            {pastDeadline ? (
              <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <Lock size={14} className="text-zinc-400 shrink-0" />
                <p className="text-xs text-zinc-500">Prazo encerrado às 16h do dia anterior.</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  disabled={isBtnDisabled('Presente')}
                  onClick={() => { onAttendance(event.id, 'Presente'); onClose(); }}
                  className={`${btnBase} ${getBtnStyle('Presente')}`}
                >
                  <CheckCircle2 size={14} /> Presente
                </button>
                <button
                  disabled={isBtnDisabled('Falta Justificada')}
                  onClick={() => { onJustificativa?.(event.id); onClose(); }}
                  className={`${btnBase} ${getBtnStyle('Falta Justificada')}`}
                >
                  <AlertCircle size={14} /> Justificada
                </button>
                <button
                  disabled={isBtnDisabled('Ausente')}
                  onClick={() => { onAttendance(event.id, 'Ausente'); onClose(); }}
                  className={`${btnBase} ${getBtnStyle('Ausente')}`}
                >
                  <XCircle size={14} /> Não Vou
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ações do Modal Footer */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {isOpen_ && isUserResponsible && onEditClick && (
            <button
              onClick={() => { onEditClick(event); onClose(); }}
              className="flex-1 p-3 border-2 border-blue-200 dark:border-blue-900/50 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 size={16} /> Editar Informações
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
