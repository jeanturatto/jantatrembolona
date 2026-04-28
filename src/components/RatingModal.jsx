import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

const LABELS = ['', 'Fraco 😬', 'Regular 😐', 'Bom 👍', 'Muito bom! 😄', 'Incrível! 🏆'];

export const RatingModal = ({ isOpen, onClose, event, onSubmit, loading, unclosable, userId }) => {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');

  if (!event) return null;

  const handleSkip = async () => {
    if (userId) {
      const skippedKey = `rating_skipped_${event.id}_${userId}`;
      localStorage.setItem(skippedKey, 'true');
      try {
        await supabase.from('ratings').insert({
          event_id: event.id,
          user_id: userId,
          stars: 0,
          comment: '',
          ignored_at: new Date().toISOString()
        });
      } catch (e) {}
    }
    setStars(0);
    setHovered(0);
    setComment('');
    onClose?.();
  };

  const handleSubmit = () => {
    if (stars === 0 || loading) return;
    onSubmit({ eventId: event.id, stars, comment: comment.trim() });
  };

  const active = hovered || stars;
  const eventDate = event.rawDate ? new Date(event.rawDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : (event.dateFormatted || event.date);

  return (
    <Modal isOpen={isOpen} onClose={unclosable ? undefined : handleClose} title="Avaliar Janta">
      <div className="space-y-5">

        {/* Event info */}
        <div className="px-4 py-3 bg-[#2842B5]/[0.06] dark:bg-[#2842B5]/10 border border-[#2842B5]/15 rounded-xl">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white capitalize">{event.name}</p>
          <p className="text-xs text-zinc-400 dark:text-[#5a5a80] capitalize mt-0.5">{event.dateFormatted || event.date}</p>
        </div>

        {/* Stars */}
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
          <p className={`text-sm font-medium mt-2 min-h-[20px] transition-opacity ${stars > 0 ? 'opacity-100' : 'opacity-0'} text-zinc-600 dark:text-[#B8ABCF]`}>
            {LABELS[stars]}
          </p>
        </div>

        {/* Comment */}
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
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none bg-zinc-50 dark:bg-white/[0.05] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/[0.09] placeholder:text-zinc-300 dark:placeholder:text-white/20 focus:border-[#2842B5]/60 focus:ring-2 focus:ring-[#2842B5]/20"
          />
          <p className="text-[10px] text-zinc-300 dark:text-[#3a3a50] mt-1 text-right">{comment.length}/150</p>
        </div>

        <p className="text-[11px] text-center text-zinc-400 dark:text-[#5a5a80] italic">
          Sua avaliação será enviada com seu perfil (como participante).
        </p>

        <div className="flex gap-3">
          {!unclosable && (
            <button
              onClick={handleSkip}
              className="flex-1 py-3 border border-zinc-200 dark:border-white/[0.09] text-zinc-500 dark:text-zinc-400 rounded-xl font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              Ignorar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={stars === 0 || loading}
            className="flex-1 py-3 bg-[#2842B5] hover:bg-[#3452c5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all"
          >
            {loading ? 'Enviando...' : 'Enviar Avaliação'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
