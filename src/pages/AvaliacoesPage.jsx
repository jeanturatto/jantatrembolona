import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, MessageSquare, Calendar, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const LABELS = ['', 'Fraco 😬', 'Regular 😐', 'Bom 👍', 'Muito bom! 😄', 'Incrível! 🏆'];

const StarDisplay = ({ value, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        size={size}
        className={n <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 dark:text-zinc-700 fill-transparent'}
      />
    ))}
  </div>
);

export default function AvaliacoesPage() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAvaliacoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          location,
          ratings (
            id,
            stars,
            comment,
            created_at,
            user_id
          )
        `)
        .eq('status', 'Finalizado')
        .order('date', { ascending: false });

      if (error) throw error;

      // Coleta todos os user_ids únicos das avaliações
      const allUserIds = [...new Set(
        (data || []).flatMap(e => (e.ratings || []).map(r => r.user_id)).filter(Boolean)
      )];

      // Busca nomes e avatares em batch
      let profileMap = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', allUserIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      }

      const formatted = (data || [])
        .filter(e => e.ratings?.length > 0)
        .map(e => {
          const avg = e.ratings.reduce((sum, r) => sum + r.stars, 0) / e.ratings.length;
          return {
            ...e,
            avgStars: avg,
            totalRatings: e.ratings.length,
            // Enriquece cada rating com o perfil do avaliador
            ratings: e.ratings.map(r => ({
              ...r,
              reviewerName: profileMap[r.user_id]?.name || 'Usuário',
              reviewerAvatar: profileMap[r.user_id]?.avatar_url || null,
              reviewerInitial: (profileMap[r.user_id]?.name || 'U').charAt(0).toUpperCase(),
            })),
            dateFormatted: new Date(e.date).toLocaleDateString('pt-BR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            }),
          };
        })
        .sort((a, b) => b.avgStars - a.avgStars || b.totalRatings - a.totalRatings);

      setEvents(formatted);
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAvaliacoes(); }, [fetchAvaliacoes]);

  const handleDeleteRating = async (ratingId, eventId) => {
    if (!confirm('Remover esta avaliação? Esta ação não pode ser desfeita.')) return;
    setDeletingId(ratingId);
    try {
      const { error } = await supabase.from('ratings').delete().eq('id', ratingId);
      if (error) throw error;
      // Atualiza localmente para não recarregar tudo
      setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e;
        const newRatings = e.ratings.filter(r => r.id !== ratingId);
        if (newRatings.length === 0) return null;
        const avg = newRatings.reduce((s, r) => s + r.stars, 0) / newRatings.length;
        return { ...e, ratings: newRatings, avgStars: avg, totalRatings: newRatings.length };
      }).filter(Boolean));
    } catch (err) {
      alert('Erro ao remover avaliação: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const medals = ['🥇', '🥈', '🥉'];

  if (loading) return (
    <div className="p-8 text-center text-zinc-400 animate-pulse text-sm">Carregando avaliações...</div>
  );

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mt-2 mb-4">
        <div className="w-1.5 h-6 bg-zinc-900 dark:bg-white rounded-full" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Avaliações</h1>
      </div>

      {/* Legenda de estrelas */}
      <div className="flex flex-wrap gap-3">
        {[5,4,3,2,1].map(n => (
          <div key={n} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-700">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">{n}</span>
            <span className="text-[11px] text-zinc-400">{LABELS[n]}</span>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
          <Trophy size={32} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">Nenhuma avaliação registrada ainda.</p>
          <p className="text-xs text-zinc-400 mt-1">As avaliações aparecem após as jantas finalizadas.</p>
        </div>
      )}

      <div className="space-y-4">
        {events.map((event, idx) => {
          const isExpanded = expandedId === event.id;
          const medal = medals[idx];

          return (
            <Card key={event.id} className="overflow-hidden !p-0">
              {/* Header do card */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : event.id)}
                className="w-full text-left p-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {medal && (
                    <span className="text-2xl shrink-0">{medal}</span>
                  )}
                  {!medal && (
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Star size={16} className="text-amber-400 fill-amber-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-white capitalize truncate">{event.name || 'Janta'}</p>
                    <p className="text-xs text-zinc-400 capitalize mt-0.5 truncate">{event.dateFormatted}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <StarDisplay value={event.avgStars} />
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{event.avgStars.toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{event.totalRatings} {event.totalRatings === 1 ? 'avaliação' : 'avaliações'}</p>
                  </div>
                  {isExpanded
                    ? <ChevronUp size={16} className="text-zinc-400" />
                    : <ChevronDown size={16} className="text-zinc-400" />
                  }
                </div>
              </button>

              {/* Comentários expandidos */}
              {isExpanded && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {event.ratings
                    .slice()
                    .sort((a, b) => b.stars - a.stars)
                    .map(rating => (
                      <div key={rating.id} className="flex items-start gap-3 px-4 py-4">

                        {/* Avatar do avaliador */}
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-600 dark:text-zinc-200 shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-600">
                          {rating.reviewerAvatar
                            ? <img src={rating.reviewerAvatar} alt={rating.reviewerInitial} className="w-full h-full object-cover" />
                            : rating.reviewerInitial}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                              {rating.reviewerName}
                            </span>
                            <StarDisplay value={rating.stars} size={11} />
                            <span className="text-[10px] font-bold text-zinc-500">
                              {LABELS[rating.stars]}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              • {new Date(rating.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          {rating.comment ? (
                            <div className="flex items-start gap-1.5">
                              <MessageSquare size={11} className="text-zinc-300 dark:text-zinc-600 mt-0.5 shrink-0" />
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">"{rating.comment}"</p>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-300 dark:text-zinc-600 italic">Sem comentário</p>
                          )}
                        </div>

                        {/* Admin: remover avaliação */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteRating(rating.id, event.id)}
                            disabled={deletingId === rating.id}
                            className="shrink-0 p-1.5 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg disabled:opacity-50"
                            title="Remover avaliação"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}

                  {/* Distribuição de estrelas */}
                  <div className="px-5 py-4 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <p className="text-[10px] font-bold uppercase text-zinc-400 mb-3 tracking-wider">Distribuição</p>
                    <div className="space-y-1.5">
                      {[5, 4, 3, 2, 1].map(n => {
                        const count = event.ratings.filter(r => r.stars === n).length;
                        const pct = Math.round((count / event.totalRatings) * 100);
                        return (
                          <div key={n} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-400 w-3">{n}</span>
                            <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />
                            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-400 w-8 text-right">{count > 0 ? `${pct}%` : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
