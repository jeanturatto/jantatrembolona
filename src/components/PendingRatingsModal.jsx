import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

const LABELS = ['', 'Fraco', 'Regular', 'Bom', 'Muito bom!', 'Incrível!'];

export const PendingRatingsModal = ({ isOpen, onClose, onAllRated, user }) => {
  const [pendingEvents, setPendingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchPendingRatings();
    }
  }, [isOpen, user?.id]);

  const fetchPendingRatings = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();

      const userCreatedAt = userProfile?.created_at;

      // Get all ratings with stars > 0 (only rated ones)
      const { data: ratings } = await supabase
        .from('ratings')
        .select('event_id, stars')
        .eq('user_id', user.id)
        .gt('stars', 0);

      const ratedIds = new Set((ratings || []).map(r => r.event_id));

      const { data: events } = await supabase
        .from('events')
        .select('*, attendances(user_id, status)')
        .eq('status', 'Finalizado')
        .lte('date', today)
        .order('date', { ascending: false });

      const pending = (events || [])
        .filter(j => !userCreatedAt || new Date(j.date) >= new Date(userCreatedAt))
        .map(j => {
          const userAtt = j.attendances?.find(a => a.user_id === user.id);
          return { ...j, userStatus: userAtt?.status };
        })
        .filter(j => j.userStatus === 'Presente' || j.userStatus === 'Ausente')
        .filter(j => !ratedIds.has(j.id));

      setPendingEvents(pending);
      setCurrentIndex(0);
      setStars(0);
      setHovered(0);
      setComment('');
    } catch (err) {
      console.error('Error fetching pending ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentEvent = pendingEvents[currentIndex];
  const active = hovered || stars;

  const handleSkip = () => {
    const isLast = currentIndex >= pendingEvents.length - 1;
    
    // Apenas pula para o próximo evento (sem salvar nada) para reaparecer depois
    if (isLast) {
      onAllRated?.();
      onClose();
    } else {
      setCurrentIndex(prev => prev + 1);
      setStars(0);
      setHovered(0);
      setComment('');
    }
  };

  const handleSubmit = async () => {
    if (stars === 0 || submitting || !currentEvent) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('ratings').insert(
        { event_id: currentEvent.id, user_id: user.id, stars, comment: comment.trim() }
      );
      if (error) {
        alert('Erro ao enviar avaliação: ' + error.message);
        throw error;
      }

      const isLast = currentIndex >= pendingEvents.length - 1;
      if (isLast) {
        onAllRated?.();
        onClose();
      } else {
        setCurrentIndex(prev => prev + 1);
        setStars(0);
        setHovered(0);
        setComment('');
      }
    } catch (err) {
      alert('Erro ao enviar avaliação: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={undefined}
      title="Avalie as Jantas"
      maxWidthClass="sm:max-w-md"
    >
      <div className="space-y-5">
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Faltam {pendingEvents.length} avaliação{pendingEvents.length !== 1 ? 'ões' : ''}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
            Avalie todas as jantas para continuar
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-zinc-400 text-sm">Carregando...</div>
        ) : currentEvent ? (
          <>
            <div className="px-4 py-3 bg-[#28B5]/[0.06] dark:bg-[#28B5]/10 border border-[#28B5]/15 rounded-xl">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white capitalize">
                {currentEvent.name || 'Janta das Quintas'}
              </p>
              <p className="text-xs text-zinc-400 dark:text-[#5a5a80] capitalize mt-0.5">
                {new Date(currentEvent.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div className="flex gap-2 mt-1.5">
                {pendingEvents.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === currentIndex
                        ? 'bg-[#28B5]'
                        : i < currentIndex
                          ? 'bg-green-400'
                          : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-[#5a5a80] mb-3">
                Sua avaliação
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setStars(n)}
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      size={36}
                      strokeWidth={1.5}
                      className={`transition-colors duration-100 ${
                        n <= active
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-zinc-200 dark:text-[#2a2a40] fill-transparent'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className={`text-sm font-medium mt-2 min-h-[20px] transition-opacity ${
                stars > 0 ? 'opacity-100' : 'opacity-0'
              } text-zinc-600 dark:text-[#B8ABCF]`}>
                {LABELS[stars]}
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-[#5a5a80] block mb-1.5">
                Comentário (opcional)
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder='"A melhor carne do ano!"'
                maxLength={150}
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none bg-zinc-50 dark:bg-white/[0.05] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/[0.09] placeholder:text-zinc-300 dark:placeholder:text-white/20 focus:border-[#28B5]/60 focus:ring-2 focus:ring-[#28B5]/20"
              />
              <p className="text-[10px] text-zinc-300 dark:text-[#3a3a50] mt-1 text-right">{comment.length}/150</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                disabled={submitting}
                className="flex-1 py-3 border border-zinc-200 dark:border-white/[0.09] text-zinc-500 dark:text-zinc-400 rounded-xl font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                Ignorar dessa vez
              </button>
              <button
                onClick={handleSubmit}
                disabled={stars === 0 || submitting}
                className="flex-1 py-3 bg-[#28B5] hover:bg-[#3452c5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    {currentIndex >= pendingEvents.length - 1 ? 'Finalizar' : 'Próxima Avaliação'}
                    <Star size={15} />
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-zinc-500 dark:text-[#5a5a80] text-sm">Nenhuma avaliação pendente.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};