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
  const [activeTab, setActiveTab] = useState('Todas');
  const [ranking, setRanking] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const today = new Date().toISOString().split('T')[0];

      const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
      ]);

      const fetchPromises = Promise.all([
        supabase.from('events').select('*, attendances(user_id, status)').gte('date', `${currentYear}-01-01`).order('date', { ascending: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('inadimplente', true),
        supabase.from('attendances').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('id, name, email'),
        supabase.from('profiles').select('id, name, avatar_url, data_nascimento').not('data_nascimento', 'is', null),
        supabase.from('events').select('id, name, date, responsibles, ratings(stars, comment)').eq('status', 'Finalizado').gte('date', `${currentYear}-01-01`).lte('date', today),
        supabase.from('ratings').select('event_id').eq('user_id', user.id),
      ]);

      const results = await withTimeout(fetchPromises, 12000); // 12 seconds max timeout
      
      const [
        { data: jantasData, error: jantasErr },
        { count: membrosCount },
        { count: inadimplentesCount },
        { data: attendances },
        { data: allProfiles },
        { data: allProfilesWithBirthday },
        { data: finishedEvents },
        { data: myRatings },
      ] = results;

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
            dayText: eventDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
            dateNum: eventDate.getDate().toString().padStart(2, '0'),
            monthYearText: eventDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            timeText: eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            rawDate: j.date,
            rawName: j.name,
            rawLocation: j.location,
            location: j.location,
            status: j.status,
            responsiveisNomes: responsiveisNomes || 'Nenhum responsável',
            responsibles: j.responsibles || [],
            attendees: presentes.length,
            attendeesList: presentes.slice(0, 3).map(a => profileMap[a.user_id] || 'U'),
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
      if (error.message === 'TIMEOUT') {
        setError('A conexão com o banco de dados falhou ou está instável lenta. Verifique sua intenet e tente recarregar a página.');
      } else {
        setError('Erro ao carregar dados. Tente recarregar a página.');
      }
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

      {/* ── Tabs & Header ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b pb-4 mb-6 border-zinc-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-zinc-900 dark:bg-white rounded-full"></div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Próximas Jantas
            </h1>
          </div>
          
          <div className="hidden md:flex gap-4">
            {['Todas', 'Abertas', 'Fechadas', 'Concluídas'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-semibold transition-colors ${
                  activeTab === tab 
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-1 -mb-[18px]' 
                    : 'text-zinc-400 hover:text-zinc-600 dark:text-[#5a5a80] dark:hover:text-white pb-1 -mb-[18px]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        
        {/* Mobile Tabs */}
        <div className="flex md:hidden gap-3 mt-4 overflow-x-auto w-full no-scrollbar">
          {['Todas', 'Abertas', 'Fechadas', 'Concluídas'].map(tab => (
             <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`shrink-0 text-sm font-semibold transition-colors ${
               activeTab === tab 
                 ? 'text-zinc-900 dark:text-white pb-1 border-b-2 border-zinc-900 dark:border-white' 
                 : 'text-zinc-400 pb-1'
             }`}
           >
             {tab}
           </button>
          ))}
        </div>
      </header>

      {/* ── Stats Grid (Mockup Style) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="md:col-span-2 !p-6 flex flex-col justify-between h-32 relative overflow-hidden">
          <span className="text-[10px] font-extrabold text-zinc-400 dark:text-[#5a5a80] tracking-widest uppercase">Média de Presença</span>
          <span className="text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tighter -ml-1">
            {stats.presencaMedia}
          </span>
          {/* Placeholder graph */}
          <div className="absolute right-6 bottom-4 flex items-end gap-1">
            <span className="text-[8px] absolute -top-4 right-0 text-zinc-400 whitespace-nowrap">ÚLTIMOS 30 DIAS</span>
            <div className="w-1.5 h-6 bg-zinc-200 dark:bg-white/10 rounded-full"></div>
            <div className="w-1.5 h-8 bg-zinc-900 dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-5 bg-zinc-200 dark:bg-white/10 rounded-full"></div>
            <div className="w-1.5 h-7 bg-zinc-900 dark:bg-white rounded-full"></div>
          </div>
        </Card>
        
        <Card className="!bg-zinc-900 dark:!bg-black border-none !p-6 flex flex-col justify-between h-32">
          <span className="text-[10px] font-extrabold text-zinc-400 tracking-widest uppercase">Jantas Abertas</span>
          <span className="text-5xl font-extrabold text-white tracking-tighter -ml-1">
            {String(jantas.filter(j => j.status === 'Aberto').length).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">Confirme sua presença até amanhã</span>
        </Card>

        <Card className="!p-6 flex flex-col justify-between h-32">
          <span className="text-[10px] font-extrabold text-zinc-400 dark:text-[#5a5a80] tracking-widest uppercase">Total do Mês</span>
          <span className="text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tighter -ml-1">
            {String(stats.totalJantas).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">Meta: {jantas.length + 5} jantas</span>
        </Card>
      </div>

      {/* ── Jantas Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jantas
          .filter(j => {
             if (activeTab === 'Todas') return true;
             if (activeTab === 'Abertas') return j.status === 'Aberto';
             if (activeTab === 'Fechadas') return j.status === 'Fechado';
             if (activeTab === 'Concluídas') return j.status === 'Finalizado';
             return true;
          })
          .map(janta => (
          <Card key={janta.id} className="!p-6 flex flex-col justify-between min-h-[220px]" onClick={undefined}>
            
            <div className="flex justify-between items-start w-full">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-[#5a5a80] uppercase -mb-1">{janta.dayText}</span>
                  <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">{janta.dateNum}</span>
                </div>
                <div className="mt-1">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight capitalize cursor-pointer hover:underline" onClick={() => setDetailEvent(janta)}>
                    {janta.name}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium capitalize mt-1">
                    {janta.monthYearText.split(' de ')[0]}, {janta.monthYearText.split(' de ')[1]} • {janta.timeText}
                  </p>
                </div>
              </div>

              {janta.status === 'Aberto' && (
                <span className="bg-zinc-900 text-white text-[9px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider">Aberta</span>
              )}
              {janta.status === 'Fechado' && (
                <span className="bg-zinc-100 text-zinc-500 font-extrabold text-[9px] uppercase px-3 py-1 rounded-full tracking-wider">Fechada</span>
              )}
              {janta.status === 'Finalizado' && (
                <span className="flex items-center gap-1 bg-zinc-100 text-zinc-500 font-extrabold text-[9px] uppercase px-3 py-1 rounded-full tracking-wider">
                   <CheckCircle2 size={10} /> Concluída
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <div>
                <span className="text-[8px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1.5 block">Responsáveis</span>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                     {/* Dummy profile pics, ideally from responsibles avatars */}
                     {janta.responsibles.slice(0, 2).map((r, i) => (
                       <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 overflow-hidden ring-1 ring-zinc-100">
                         <img src={`https://ui-avatars.com/api/?name=${janta.responsiveisNomes.split(', ')[i]}&background=random`} alt="av" />
                       </div>
                     ))}
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 capitalize">{janta.responsiveisNomes}</span>
                </div>
              </div>

              <div className="flex items-end justify-between mt-2">
                <div>
                  <span className="text-[8px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1 block">Participantes</span>
                  <div className="flex -space-x-1.5 items-center">
                    {janta.attendees > 0 ? Array.from({length: Math.min(3, janta.attendees)}).map((_, i) => (
                       <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-green-100 overflow-hidden ring-1 ring-zinc-100">
                         <img src={`https://ui-avatars.com/api/?name=User&background=random`} alt="av" />
                       </div>
                    )) : (
                       <span className="text-xs text-zinc-400 font-medium">Nenhum</span>
                    )}
                    {janta.attendees > 3 && (
                       <span className="w-6 h-6 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[8px] font-bold text-zinc-600">
                         +{janta.attendees - 3}
                       </span>
                    )}
                  </div>
                </div>

                {janta.status === 'Aberto' ? (
                  <button 
                    onClick={() => setDetailEvent(janta)}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-5 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    Participar
                  </button>
                ) : (
                  <button 
                    onClick={() => setDetailEvent(janta)}
                    className="text-zinc-900 border-b border-zinc-900 text-xs font-bold pb-0.5 hover:text-blue-600 hover:border-blue-600 transition-colors cursor-pointer"
                  >
                    Ver Detalhes
                  </button>
                )}
              </div>
            </div>

          </Card>
        ))}
        {jantas.length === 0 && !loading && (
          <p className="text-sm text-zinc-400 dark:text-[#5a5a80] py-4 text-center md:col-span-2">Nenhuma janta encontrada nos filtros atuais.</p>
        )}
      </div>
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
