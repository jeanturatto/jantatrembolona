import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Users, Percent, AlertCircle, Utensils, Lock, Star, Cake, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { JustificativaModal } from '../components/JustificativaModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { EditEventModal } from '../components/EditEventModal';
import { RatingModal } from '../components/RatingModal';

// Regra: o prazo de confirmação encerra no DIA ANTERIOR à janta às 16:00 BRT.
const isEventPastDeadline = (eventDateStr) => {
  if (!eventDateStr) return false;
  const now = new Date();
  const brtOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const brt = new Date(utcMs + brtOffset * 60000);

  const eventDate = new Date(eventDateStr);
  const eventYear = eventDate.getUTCFullYear();
  const eventMonth = eventDate.getUTCMonth();
  const eventDay = eventDate.getUTCDate();

  // Prazo = dia anterior à janta às 16:00 BRT
  const deadlineBRT = new Date(eventYear, eventMonth, eventDay - 1, 16, 0, 0, 0);
  const brtAsDate = new Date(
    brt.getFullYear(), brt.getMonth(), brt.getDate(),
    brt.getHours(), brt.getMinutes(), brt.getSeconds()
  );

  return brtAsDate >= deadlineBRT;
};

export default function DashboardPage() {
  const { user, profile, signOut } = useAuth();
  const [jantas, setJantas] = useState([]);
  const [stats, setStats] = useState({ totalJantas: 0, membros: 0, presencaMedia: '0%', inadimplentes: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isJustModalOpen, setIsJustModalOpen] = useState(false);
  const [justEventId, setJustEventId] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [error, setError] = useState(null);
  // Aniversariantes
  const [aniversariantes, setAniversariantes] = useState([]);
  // Rating
  const [ratingEvent, setRatingEvent] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [pendingRatingEvent, setPendingRatingEvent] = useState(null);
  // Ranking
  const [ranking, setRanking] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const today = new Date().toISOString().split('T')[0];

      const [
        { data: jantasData, error: jantasErr },
        { count: membrosCount },
        { count: inadimplentesCount },
        { data: attendances },
        { data: allProfiles },
        { data: allProfilesWithBirthday },
        { data: finishedEvents },
        { data: myRatings },
      ] = await Promise.all([
        supabase.from('events').select('*, attendances(user_id, status)').eq('status', 'Aberto').order('date', { ascending: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('inadimplente', true),
        supabase.from('attendances').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('id, name, email'),
        supabase.from('profiles').select('id, name, avatar_url, data_nascimento').not('data_nascimento', 'is', null),
        supabase.from('events').select('id, name, date, responsibles, ratings(stars, comment)').eq('status', 'Finalizado').gte('date', `${currentYear}-01-01`).lte('date', today),
        supabase.from('ratings').select('event_id').eq('user_id', user.id),
      ]);

      if (jantasErr) throw jantasErr;

      // ── Aniversariantes do mês
      const birthday = (allProfilesWithBirthday || []).filter(p => {
        const d = new Date(p.data_nascimento + 'T12:00:00');
        return d.getMonth() + 1 === currentMonth;
      }).sort((a, b) => new Date(a.data_nascimento).getDate() - new Date(b.data_nascimento).getDate());
      setAniversariantes(birthday);

      // ── Ranking: top 3 jantas finalizadas do ano com avaliações
      const ratedEventIds = new Set((myRatings || []).map(r => r.event_id));
      const ranked = (finishedEvents || [])
        .filter(e => e.ratings?.length >= 1)
        .map(e => ({
          ...e,
          avgStars: e.ratings.reduce((s, r) => s + r.stars, 0) / e.ratings.length,
          totalRatings: e.ratings.length,
          dateFormatted: new Date(e.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
        }))
        .sort((a, b) => b.avgStars - a.avgStars || b.totalRatings - a.totalRatings)
        .slice(0, 3);
      setRanking(ranked);

      // ── Evento pendente de avaliação (user foi Presente, não avaliou ainda)
      const myAttendedIds = new Set((attendances || []).filter(a => a.status === 'Presente').map(a => a.event_id));
      const pendingRating = (finishedEvents || [])
        .filter(e => myAttendedIds.has(e.id) && !ratedEventIds.has(e.id))
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (pendingRating) {
        setPendingRatingEvent({
          id: pendingRating.id,
          name: pendingRating.name || 'Janta',
          dateFormatted: new Date(pendingRating.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
        });
      } else {
        setPendingRatingEvent(null);
      }

      if (jantasData) {
        const profileMap = Object.fromEntries((allProfiles || []).map(p => [p.id, p.name || p.email?.split('@')[0]]));

        const formattedJantas = jantasData.map(j => {
          const presentes = j.attendances?.filter(a => a.status === 'Presente') || [];
          const userAtt = j.attendances?.find(a => a.user_id === user.id);
          const responsiveisNomes = (j.responsibles || []).map(id => profileMap[id]).filter(Boolean).join(', ');
          const eventDate = new Date(j.date);
          return {
            id: j.id,
            name: j.name || 'Janta das Quintas',
            date: eventDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
            dateFormatted: eventDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
            rawDate: j.date,
            rawName: j.name,
            rawLocation: j.location,
            location: j.location,
            status: j.status,
            responsiveisNomes: responsiveisNomes || 'Nenhum responsável',
            responsibles: j.responsibles || [],
            attendees: presentes.length,
            userStatus: userAtt ? userAtt.status : null
          };
        });
        setJantas(formattedJantas);

        const userTotalExpected = attendances?.length || 0;
        const userPresentes = attendances?.filter(a => a.status === 'Presente').length || 0;
        const userPerc = userTotalExpected > 0 ? Math.round((userPresentes / userTotalExpected) * 100) : 0;

        setStats({
          totalJantas: jantasData.length,
          membros: membrosCount || 0,
          presencaMedia: `${userPerc}%`,
          inadimplentes: inadimplentesCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setError('Erro ao carregar dados. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Re-busca dados quando a aba volta ao foco
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboardData]);

  // Auto-mark past-deadline on today's open janta
  const autoMarkedRef = React.useRef(false);
  useEffect(() => {
    const autoMarkDeadline = async () => {
      if (autoMarkedRef.current || !user?.id) return;
      const proximaAberta = jantas.find(j => j.status === 'Aberto' && !j.userStatus);
      if (!proximaAberta) return;
      if (!isEventPastDeadline(proximaAberta.rawDate)) return;

      autoMarkedRef.current = true;
      const userName = profile?.name || user?.email?.split('@')[0] || 'Usuário';

      setJantas(prev => prev.map(j => j.id === proximaAberta.id ? { ...j, userStatus: 'Falta Justificada' } : j));

      try {
        const { error } = await supabase.from('attendances').upsert({
          event_id: proximaAberta.id,
          user_id: user.id,
          status: 'Falta Justificada',
          justificativa: `${userName} não confirmou dentro do horário limite (16:00 do dia anterior)`
        }, { onConflict: 'event_id,user_id' });

        if (error) throw error;
      } catch (err) {
        console.error('Erro ao fechar janta fora do prazo', err);
      }
    };
    if (jantas.length > 0 && profile) autoMarkDeadline();
  }, [jantas, profile, user?.id]);

  const handleAttendance = async (eventId, statusParam, justificativa = null) => {
    const janta = jantas.find(j => j.id === eventId);
    if (janta && isEventPastDeadline(janta.rawDate)) {
      alert('O prazo de confirmação encerrou às 16:00 do dia anterior (horário de Brasília).');
      return;
    }
    setActionLoading(true);
    try {
      const payload = { event_id: eventId, user_id: user.id, status: statusParam };
      if (justificativa) payload.justificativa = justificativa;
      const { error } = await supabase.from('attendances').upsert(payload, { onConflict: 'event_id,user_id' });
      if (error) throw error;
      await fetchDashboardData();
    } catch (err) {
      alert('Erro ao registrar presença.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJustificado = (eventId) => {
    const janta = jantas.find(j => j.id === eventId);
    if (janta && isEventPastDeadline(janta.rawDate)) {
      alert('O prazo de confirmação encerrou às 16:00 do dia anterior (horário de Brasília).');
      return;
    }
    setJustEventId(eventId);
    setIsJustModalOpen(true);
  };

  const handleRatingSubmit = async ({ eventId, stars, comment }) => {
    setRatingLoading(true);
    try {
      const { error } = await supabase.from('ratings').upsert(
        { event_id: eventId, user_id: user.id, stars, comment },
        { onConflict: 'event_id,user_id' }
      );
      if (error) throw error;
      setRatingEvent(null);
      setPendingRatingEvent(null);
      fetchDashboardData();
    } catch (err) {
      alert('Erro ao enviar avaliação: ' + err.message);
    } finally {
      setRatingLoading(false);
    }
  };

  const handleJustificativaConfirm = async (texto) => {
    await handleAttendance(justEventId, 'Falta Justificada', texto);
    setIsJustModalOpen(false);
    setJustEventId(null);
  };

  const proximaJanta = jantas.find(j => j.status === 'Aberto');
  const pastDeadline = proximaJanta ? isEventPastDeadline(proximaJanta.rawDate) : false;
  const btnBase = 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-[0.97]';
  const userStatusJanta = proximaJanta?.userStatus;

  const getDashBtnStyle = (thisStatus) => {
    if (!userStatusJanta) {
      if (thisStatus === 'Presente')          return 'border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20';
      if (thisStatus === 'Falta Justificada') return 'border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20';
      return 'border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800';
    }
    if (userStatusJanta === thisStatus) {
      if (thisStatus === 'Presente')          return 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200 dark:shadow-green-900/30';
      if (thisStatus === 'Falta Justificada') return 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-200 dark:shadow-amber-900/30';
      return 'bg-zinc-500 border-zinc-500 text-white';
    }
    return 'border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 opacity-40 cursor-not-allowed';
  };
  const isDashBtnDisabled = (thisStatus) => actionLoading || (!!userStatusJanta && userStatusJanta !== thisStatus);

  if (loading) return <div className="p-8 text-center text-zinc-400 dark:text-[#5E5853] animate-pulse text-sm">Carregando painel...</div>;

  if (error) return (
    <div className="p-8 text-center flex flex-col items-center gap-4">
      <p className="text-red-500 font-bold">{error}</p>
      <button
        onClick={fetchDashboardData}
        className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:opacity-90"
      >
        Tentar novamente
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in">

      {/* ── Header ── */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white capitalize">
            Olá, {profile?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'} 👋
          </h1>
          <p className="text-zinc-400 dark:text-[#5a5a80] text-sm mt-1">
            Bem-vindo ao <span className="text-[#2842B5] dark:text-[#B8ABCF] font-medium">Janta Trembolona</span>
          </p>
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        {[
          { label: "Total de Jantas", value: stats.totalJantas, icon: Calendar,     accent: "text-[#2842B5] dark:text-[#B8ABCF]", bg: "bg-[#2842B5]/08 dark:bg-[#2842B5]/15" },
          { label: "Membros",         value: stats.membros,     icon: Users,         accent: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/08 dark:bg-violet-500/15" },
          { label: "Sua Presença",    value: stats.presencaMedia, icon: Percent,     accent: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/08 dark:bg-emerald-500/15" },
          { label: "Inadimplentes",   value: stats.inadimplentes, icon: AlertCircle, accent: "text-red-500 dark:text-red-400", bg: "bg-red-500/08 dark:bg-red-500/15" },
        ].map((stat, i) => (
          <Card key={i} className="flex flex-col gap-3 !p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-zinc-400 dark:text-[#5a5a80] tracking-wider uppercase leading-tight">{stat.label}</span>
              <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon size={14} className={stat.accent} />
              </div>
            </div>
            <span className={`text-3xl font-bold leading-none ${stat.accent.split(' ')[0] === 'text-red-500' && stat.value > 0 ? 'text-red-500 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
              {stat.value}
            </span>
          </Card>
        ))}
      </div>

      {/* ── Aniversariantes do Mês ── */}
      {aniversariantes.length > 0 && (
        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cake size={16} className="text-pink-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Aniversariantes do Mês</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {aniversariantes.map(p => {
              const day = new Date(p.data_nascimento + 'T12:00:00').getDate();
              return (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 dark:bg-pink-500/10 border border-pink-100 dark:border-pink-500/20 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-pink-200 dark:bg-pink-500/20 flex items-center justify-center text-[10px] font-bold text-pink-600 overflow-hidden shrink-0">
                    {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : (p.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-pink-700 dark:text-pink-300 capitalize">{p.name?.split(' ')[0] || 'Usuário'}</span>
                  <span className="text-[10px] text-pink-400 font-bold">dia {day}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Próxima Janta ── */}
      <section>
        <Card
          className={`${proximaJanta ? 'cursor-pointer' : ''} transition-all !p-0 overflow-hidden`}
          onClick={proximaJanta ? () => setDetailEvent(proximaJanta) : undefined}
        >
          {/* Blue accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#2842B5] via-[#3452c5] to-[#B8ABCF]/30" />
          <div className="p-5">
            {proximaJanta ? (
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#2842B5] dark:text-[#B8ABCF]/70">Próxima Janta</span>
                    <span className="px-2 py-0.5 bg-[#2842B5] text-white text-[9px] font-bold rounded-full uppercase tracking-wider">Aberto</span>
                    {pastDeadline && <span className="text-[9px] text-red-500 font-bold uppercase">⏰ Prazo encerrado</span>}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white capitalize truncate">{proximaJanta.name}</h3>
                  <p className="text-sm text-zinc-400 dark:text-[#5a5a80] mt-1 capitalize">{proximaJanta.date}</p>
                  <p className="text-sm text-zinc-500 dark:text-[#B8ABCF]/70 mt-1 flex items-center gap-1.5">
                    <Utensils size={13} />
                    <span className="capitalize">{proximaJanta.responsiveisNomes}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto" onClick={e => e.stopPropagation()}>
                  {proximaJanta.responsibles.includes(user.id) ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <Lock size={13} className="text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-500">Você é responsável</span>
                    </div>
                  ) : pastDeadline ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <Lock size={13} className="text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-500">Prazo encerrado às 16h do dia anterior.</span>
                    </div>
                  ) : (
                    <div className="flex gap-2 w-full md:w-auto">
                      <button disabled={isDashBtnDisabled('Presente')} onClick={() => handleAttendance(proximaJanta.id, 'Presente')} className={`${btnBase} ${getDashBtnStyle('Presente')}`}>
                        <CheckCircle2 size={14} /> Presente
                      </button>
                      <button disabled={isDashBtnDisabled('Falta Justificada')} onClick={() => handleJustificado(proximaJanta.id)} className={`${btnBase} ${getDashBtnStyle('Falta Justificada')}`}>
                        <AlertCircle size={14} /> Justificada
                      </button>
                      <button disabled={isDashBtnDisabled('Ausente')} onClick={() => handleAttendance(proximaJanta.id, 'Ausente')} className={`${btnBase} ${getDashBtnStyle('Ausente')}`}>
                        <XCircle size={14} /> Não Vou
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center w-full">
                <p className="text-zinc-400 dark:text-[#5a5a80] text-sm">Nenhuma janta marcada nos próximos dias.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ── Avalie a última janta ── */}
      {pendingRatingEvent && (
        <Card className="!p-4 border-l-4 border-l-[#2842B5]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2842B5]/10 dark:bg-[#2842B5]/20 flex items-center justify-center shrink-0">
                <Star size={16} className="text-[#2842B5] dark:text-[#B8ABCF]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Avalie a última janta</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white capitalize">{pendingRatingEvent.name}</p>
                <p className="text-[11px] text-zinc-400 capitalize mt-0.5">{pendingRatingEvent.dateFormatted}</p>
              </div>
            </div>
            <button
              onClick={() => setRatingEvent(pendingRatingEvent)}
              className="shrink-0 px-3 py-1.5 bg-[#2842B5] text-white text-xs font-bold rounded-xl hover:bg-[#3452c5] transition-colors"
            >
              Avaliar
            </button>
          </div>
        </Card>
      )}

      {/* ── Top 3 Ranking ── */}
      {ranking.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">Top Jantas do Ano</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ranking.map((e, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <Card key={e.id} className="!p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{medals[i]}</span>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">{e.avgStars.toFixed(1)}</span>
                      <span className="text-[10px] text-zinc-400">({e.totalRatings})</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize leading-tight">{e.name || 'Janta'}</p>
                  <p className="text-[11px] text-zinc-400 capitalize">{e.dateFormatted}</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Jantas Recentes ── */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">Jantas Recentes</h2>
          <Link to="/jantas" className="text-xs font-medium text-[#2842B5] dark:text-[#B8ABCF] hover:underline underline-offset-2">
            Ver todas →
          </Link>
        </div>
        <div className="space-y-2">
          {jantas.map(janta => (
            <Card
              key={janta.id}
              onClick={() => setDetailEvent(janta)}
              className="!py-3 !px-4 flex items-center justify-between hover:border-[#2842B5]/20 dark:hover:border-white/[0.12] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#2842B5]/08 dark:bg-[#2842B5]/15 flex items-center justify-center shrink-0">
                  <Calendar size={15} className="text-[#2842B5] dark:text-[#B8ABCF]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-zinc-900 dark:text-white capitalize truncate">{janta.name}</p>
                  <p className="text-xs text-zinc-400 dark:text-[#5a5a80] capitalize mt-0.5">{janta.date}</p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border shrink-0 ml-2 tracking-wide ${
                janta.status === 'Aberto'
                  ? 'bg-[#2842B5]/08 border-[#2842B5]/20 text-[#2842B5] dark:bg-[#2842B5]/15 dark:border-[#2842B5]/30 dark:text-[#B8ABCF]'
                  : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-100 dark:border-white/[0.05] text-zinc-400 dark:text-[#5a5a80]'
              }`}>
                {janta.status}
              </span>
            </Card>
          ))}
          {jantas.length === 0 && (
            <p className="text-sm text-zinc-400 dark:text-[#5a5a80] py-4 text-center">Nenhuma janta registrada ainda.</p>
          )}
        </div>
      </section>

      <JustificativaModal
        isOpen={isJustModalOpen}
        onClose={() => { setIsJustModalOpen(false); setJustEventId(null); }}
        onConfirm={handleJustificativaConfirm}
        loading={actionLoading}
      />

      <EventDetailModal
        isOpen={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
        onAttendance={handleAttendance}
        onJustificativa={handleJustificado}
        actionLoading={actionLoading}
        pastDeadline={detailEvent ? isEventPastDeadline(detailEvent.rawDate) : false}
        onEditClick={setEditEvent}
      />

      <EditEventModal
        isOpen={!!editEvent}
        onClose={() => setEditEvent(null)}
        onSuccess={fetchDashboardData}
        event={editEvent}
        isResponsibleOnly={true}
      />

      <RatingModal
        isOpen={!!ratingEvent}
        onClose={() => setRatingEvent(null)}
        event={ratingEvent}
        onSubmit={handleRatingSubmit}
        loading={ratingLoading}
      />
    </div>
  );
}
