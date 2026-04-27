import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Users, Percent, AlertCircle, Utensils, Lock, Star, Cake, CheckCircle2, XCircle, Trophy, MapPin } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { JustificativaModal } from '../components/JustificativaModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { EditEventModal } from '../components/EditEventModal';
import { RatingModal } from '../components/RatingModal';
import { PaymentModal } from '../components/PaymentModal';
import { ConfirmacaoModal } from '../components/ConfirmacaoModal';
import { PaymentPromptModal } from '../components/PaymentPromptModal';

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

  // Prazo = meio-dia (12:00) do dia da janta em BRT
  const deadlineBRT = new Date(eventYear, eventMonth, eventDay, 12, 0, 0, 0);
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
  const [myRatingsIds, setMyRatingsIds] = useState(new Set());
  // Payment modal (responsaveis)
  const [pendingPaymentEvent, setPendingPaymentEvent] = useState(null);
  const [paymentModalEvent, setPaymentModalEvent] = useState(null);
  const [confirmacaoEvent, setConfirmacaoEvent] = useState(null);
  // Payment prompt
  const [paymentPromptEvent, setPaymentPromptEvent] = useState(null);
  const [shownPaymentPrompts, setShownPaymentPrompts] = useState(() => {
    try {
      const saved = sessionStorage.getItem('shownPaymentPrompts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [sessionChecked, setSessionChecked] = useState(false);
  // Ranking
  const [activeTab, setActiveTab] = useState('Abertas');
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
        supabase.from('profiles').select('id, name, email, avatar_url'),
        supabase.from('profiles').select('id, name, avatar_url, data_nascimento').not('data_nascimento', 'is', null),
        supabase.from('events').select('*, attendances(user_id, status)').eq('status', 'Finalizado').lte('date', today),
        supabase.from('ratings').select('event_id').eq('user_id', user.id),
        supabase.from('profiles').select('created_at').eq('id', user.id).single(),
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
        { data: userProfile },
      ] = results;

      if (jantasErr) throw jantasErr;

      const userCreatedAt = userProfile?.created_at;
      console.log('User created at:', userCreatedAt, 'User ID:', user?.id);

      // ── Aniversariantes do mês
      const birthday = (allProfilesWithBirthday || []).filter(p => {
        const d = new Date(p.data_nascimento + 'T12:00:00');
        return d.getMonth() + 1 === currentMonth;
      }).sort((a, b) => new Date(a.data_nascimento).getDate() - new Date(b.data_nascimento).getDate());
      setAniversariantes(birthday);

      // ── Ranking: top 3 jantas finalizadas do ano com avaliações
      const ratedEventIds = new Set((myRatings || []).map(r => r.event_id));
      setMyRatingsIds(ratedEventIds);
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

      // ── Evento pendente de avaliação
      // Mostra para todos os usuarios que participaram (Presente ou Ausente) em jantas finalizadas
      // O popup só some quando avaliar
      // IMPORTANTE: só mostra jantas posteriores à data de criação do usuário
      const myAttendedInFinished = (jantasData || [])
        .filter(j => j.status === 'Finalizado')
        .filter(j => !userCreatedAt || new Date(j.date) >= new Date(userCreatedAt))
        .map(j => {
          const userAtt = j.attendances?.find(a => a.user_id === user.id);
          return { event: j, userStatus: userAtt?.status };
        })
        .filter(({ userStatus }) => userStatus === 'Presente' || userStatus === 'Ausente')
        .filter(({ event }) => !ratedEventIds.has(event.id));
      
      const pendingRating = myAttendedInFinished
        .sort((a, b) => new Date(b.event.date) - new Date(a.event.date))[0];
      
      if (pendingRating) {
        setRatingEvent({
          id: pendingRating.event.id,
          name: pendingRating.event.name || 'Janta',
          dateFormatted: new Date(pendingRating.event.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
          rawDate: pendingRating.event.date,
        });
        setPendingRatingEvent({
          id: pendingRating.event.id,
          name: pendingRating.event.name || 'Janta',
          dateFormatted: new Date(pendingRating.event.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
          rawDate: pendingRating.event.date,
        });
      } else {
        setPendingRatingEvent(null);
      }

      

      if (jantasData) {
        const profileMap = Object.fromEntries(
          (allProfiles || []).map(p => [p.id, {
            name: p.name || p.email?.split('@')[0] || 'U',
            avatar_url: p.avatar_url || null,
          }])
        );

        const formattedJantas = jantasData.map(j => {
          const presentes = j.attendances?.filter(a => a.status === 'Presente') || [];
          const userAtt = j.attendances?.find(a => a.user_id === user.id);
          const userStatus = userAtt ? userAtt.status : null;
          const responsiveisNomes = (j.responsibles || []).map(id => profileMap[id]).filter(Boolean).join(', ');
          const eventDate = new Date(j.date);
          const isAfterUserJoined = !userCreatedAt || new Date(j.date) >= new Date(userCreatedAt);
          return {
            id: j.id,
            name: j.name || 'Janta das Quintas',
            userStatus: userStatus,
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
            payment_sent: j.payment_sent || false,
            payment_value: j.payment_value || null,
            canRate: isAfterUserJoined,
            attendees: presentes.length,
            // Lista com nome, avatar e inicial dos primeiros 3 presentes
            attendeesList: presentes.slice(0, 3).map(a => ({
              name: (profileMap[a.user_id]?.name || 'U').split(' ')[0],
              fullName: profileMap[a.user_id]?.name || 'U',
              avatar_url: profileMap[a.user_id]?.avatar_url || null,
              initial: (profileMap[a.user_id]?.name || 'U').charAt(0).toUpperCase(),
            })),
            allAttendeesList: presentes.map(a => ({
              id: a.user_id,
              name: (profileMap[a.user_id]?.name || 'U').split(' ')[0],
              fullName: profileMap[a.user_id]?.name || 'U',
              avatar_url: profileMap[a.user_id]?.avatar_url || null,
              initial: (profileMap[a.user_id]?.name || 'U').charAt(0).toUpperCase(),
            })),
            responsiblesList: (j.responsibles || []).map(id => ({
              name: (profileMap[id]?.name || 'U').split(' ')[0],
              fullName: profileMap[id]?.name || 'U',
              avatar_url: profileMap[id]?.avatar_url || null,
              initial: (profileMap[id]?.name || 'U').charAt(0).toUpperCase(),
            })),
            responsiveisNomes: (j.responsibles || []).map(id => profileMap[id]?.name).filter(Boolean).join(', ') || 'Nenhum responsável',
            userStatus: userAtt ? userAtt.status : null,
            guests: Array.isArray(j.guests) ? j.guests : [],
          };
        });

        // Ordenação inteligente: Abertas (crescente -> próxima janta primeiro),
        // Fechadas (decrescente -> recém concluída primeiro).
        formattedJantas.sort((a, b) => {
          if (a.status === 'Aberto' && b.status === 'Aberto') {
            return new Date(a.rawDate) - new Date(b.rawDate);
          }
          if (a.status !== 'Aberto' && b.status !== 'Aberto') {
            return new Date(b.rawDate) - new Date(a.rawDate);
          }
          if (a.status === 'Aberto') return -1;
          return 1;
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
          justificativa: `Não confirmou dentro do Horário`
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
      alert('O prazo de confirmação encerrou às 12:00 do dia da janta (horário de Brasília).');
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

  const handleMarkPaymentAsSent = async (eventId) => {
    try {
      await supabase.from('events').update({ payment_sent: true }).eq('id', eventId);
      const newSet = new Set([...shownPaymentPrompts, eventId]);
      setShownPaymentPrompts(newSet);
      sessionStorage.setItem('shownPaymentPrompts', JSON.stringify([...newSet]));
      setPaymentPromptEvent(null);
      await fetchDashboardData();
    } catch (err) {
      console.error('Erro ao marcar cobrança como enviada:', err);
    }
  };

  // Check for payment prompts when jantas change
  // Só mostra popup se: usuario é responsáveis E ainda não gerou cobrança E não foi marcada como enviada
  useEffect(() => {
    if (!sessionChecked || !jantas.length || !user?.id) return;
    
    const pendingPayment = jantas.find(j => 
      j.status === 'Finalizado' && 
      j.responsibles.includes(user.id) &&
      !j.payment_value &&
      !j.payment_sent &&
      !shownPaymentPrompts.has(j.id)
    );

    if (pendingPayment) {
      setPaymentPromptEvent(pendingPayment);
    }
  }, [jantas, user?.id, shownPaymentPrompts, sessionChecked]);

  // Init session check
  useEffect(() => {
    setSessionChecked(true);
  }, []);

  // Quando usuario fecha o popup (qualquer ação), marca para não mostrar mais nesta sessão
  const handlePaymentPromptClose = () => {
    if (paymentPromptEvent) {
      const newSet = new Set([...shownPaymentPrompts, paymentPromptEvent.id]);
      setShownPaymentPrompts(newSet);
      sessionStorage.setItem('shownPaymentPrompts', JSON.stringify([...newSet]));
    }
    setPaymentPromptEvent(null);
  };

  // Limpar sessionStorage quando a janta for atualizada (cobrada ou marcada como enviada)

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
            {['Todas', 'Abertas', 'Concluídas'].map(tab => (
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
          {['Todas', 'Abertas', 'Concluídas'].map(tab => (
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <Card className="col-span-2 !p-5 md:!p-6 flex flex-col justify-between h-28 md:h-32 relative overflow-hidden">
          <span className="text-[10px] font-extrabold text-zinc-400 dark:text-[#5a5a80] tracking-widest uppercase">Média de Presença</span>
          <span className="text-4xl md:text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tighter -ml-1">
            {stats.presencaMedia}
          </span>
          {/* Placeholder graph */}
          <div className="absolute right-5 bottom-4 flex items-end gap-1">
            <span className="text-[8px] absolute -top-4 right-0 text-zinc-400 whitespace-nowrap">ÚLTIMOS 30 DIAS</span>
            <div className="w-1.5 h-6 bg-zinc-200 dark:bg-white/10 rounded-full"></div>
            <div className="w-1.5 h-8 bg-zinc-900 dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-5 bg-zinc-200 dark:bg-white/10 rounded-full"></div>
            <div className="w-1.5 h-7 bg-zinc-900 dark:bg-white rounded-full"></div>
          </div>
        </Card>
        
        <Card className="!bg-zinc-900 dark:!bg-black border-none !p-5 md:!p-6 flex flex-col justify-between h-28 md:h-32">
          <span className="text-[10px] font-extrabold text-zinc-400 tracking-widest uppercase">Jantas Abertas</span>
          <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tighter -ml-1">
            {String(jantas.filter(j => j.status === 'Aberto').length).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium hidden sm:block">Confirme sua presença</span>
        </Card>

        <Card className="!p-5 md:!p-6 flex flex-col justify-between h-28 md:h-32">
          <span className="text-[10px] font-extrabold text-zinc-400 dark:text-[#5a5a80] tracking-widest uppercase">META</span>
          <span className="text-4xl md:text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tighter -ml-1">
            1/semana
          </span>
          <span className="text-[10px] text-zinc-400 font-medium hidden sm:block">
            {(() => {
              const now = new Date();
              const jan1 = new Date(now.getFullYear(), 0, 1);
              const weekNum = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
              return `Semana ${weekNum} de 52`;
            })()}
          </span>
        </Card>
      </div>

      {/* ── Jantas Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jantas
          .filter(j => {
             if (activeTab === 'Todas') return j.status !== 'Cancelado';
             if (activeTab === 'Abertas') return j.status === 'Aberto';
             if (activeTab === 'Concluídas') return j.status === 'Finalizado';
             return j.status !== 'Cancelado';
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
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs text-zinc-400 font-medium capitalize">
                      {janta.monthYearText.split(' de ')[0]}, {janta.monthYearText.split(' de ')[1]} • {janta.timeText}
                    </p>
                    {janta.location && (
                      <p className="text-xs text-zinc-500 font-medium capitalize flex items-center gap-1">
                        <MapPin size={11} className="shrink-0" /> {janta.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {janta.status === 'Aberto' && (
                <span className="bg-zinc-900 text-white text-[9px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider">Aberta</span>
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
                  <div className="flex -space-x-1.5 items-center">
                     {janta.responsiblesList?.length > 0 ? janta.responsiblesList.slice(0, 2).map((resp, i) => (
                       <div key={i} title={resp.fullName} className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-blue-100 dark:bg-blue-900/40 overflow-hidden ring-1 ring-zinc-100 dark:ring-zinc-700 text-[9px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center">
                         {resp.avatar_url
                           ? <img src={resp.avatar_url} alt={resp.initial} className="w-full h-full object-cover" />
                           : resp.initial}
                       </div>
                     )) : (
                       <span className="text-xs text-zinc-400 font-medium">Nenhum</span>
                     )}
                     {janta.responsiblesList?.length > 2 && (
                       <span className="w-6 h-6 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[8px] font-bold text-zinc-600">
                         +{janta.responsiblesList.length - 2}
                       </span>
                     )}
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 capitalize">{janta.responsiveisNomes}</span>
                </div>
              </div>

              <div className="flex items-end justify-between mt-2">
                <div>
                  <span className="text-[8px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1 block">Participantes</span>
                  <div className="flex -space-x-1.5 items-center">
                    {janta.attendees > 0 ? janta.attendeesList.map((att, i) => (
                       <div key={i} title={att.fullName} className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-green-100 dark:bg-green-900/40 overflow-hidden ring-1 ring-zinc-100 dark:ring-zinc-700 text-[9px] font-bold text-green-700 dark:text-green-300 flex items-center justify-center cursor-help">
                         {att.avatar_url
                           ? <img src={att.avatar_url} alt={att.name} className="w-full h-full object-cover" />
                           : att.name}
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
                   {janta.guests?.length > 0 && (
                     <span className="text-[10px] text-violet-500 font-bold mt-0.5 block">
                       +{janta.guests.length} convidado{janta.guests.length > 1 ? 's' : ''}
                     </span>
                   )}
                </div>

                {janta.status === 'Aberto' ? (
                  isEventPastDeadline(janta.rawDate) ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-zinc-500 font-bold bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-not-allowed">
                        <Lock size={12} /> Prazo Encerrado
                      </span>
                    </div>
                  ) : (
                    <div className="flex bg-zinc-100/50 dark:bg-zinc-800/30 p-1 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <button
                        disabled={actionLoading || (janta.userStatus && janta.userStatus !== 'Presente')}
                        onClick={(e) => { e.stopPropagation(); handleAttendance(janta.id, 'Presente'); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          janta.userStatus === 'Presente' ? 'bg-green-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        } ${actionLoading || (janta.userStatus && janta.userStatus !== 'Presente') ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <CheckCircle2 size={12} /> Vai
                      </button>
                      <button
                        disabled={actionLoading || (janta.userStatus && janta.userStatus !== 'Falta Justificada')}
                        onClick={(e) => { e.stopPropagation(); setIsJustModalOpen(true); setJustEventId(janta.id); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all mx-0.5 ${
                          janta.userStatus === 'Falta Justificada' ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        } ${actionLoading || (janta.userStatus && janta.userStatus !== 'Falta Justificada') ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <AlertCircle size={12} /> Just.
                      </button>
                      <button
                        disabled={actionLoading || (janta.userStatus && janta.userStatus !== 'Ausente')}
                        onClick={(e) => { e.stopPropagation(); handleAttendance(janta.id, 'Ausente'); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          janta.userStatus === 'Ausente' ? 'bg-zinc-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        } ${actionLoading || (janta.userStatus && janta.userStatus !== 'Ausente') ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <XCircle size={12} /> Não
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex gap-2">
                    {janta.status === 'Finalizado' && !myRatingsIds.has(janta.id) && janta.canRate && (
                      <button 
                        onClick={() => setRatingEvent(janta)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Star size={11} className="fill-amber-500 dark:fill-amber-400 text-amber-500 dark:text-amber-400" /> Avaliar
                      </button>
                    )}
                    <button 
                      onClick={() => setDetailEvent(janta)}
                      className="text-zinc-900 border-b border-zinc-900 text-xs font-bold pb-0.5 hover:text-blue-600 hover:border-blue-600 transition-colors cursor-pointer"
                    >
                      Ver Detalhes
                    </button>
                  </div>
                )}
              </div>
            </div>

          </Card>
        ))}
        {jantas.filter(j => {
             if (activeTab === 'Todas') return j.status !== 'Cancelado';
             if (activeTab === 'Abertas') return j.status === 'Aberto';
             if (activeTab === 'Concluídas') return j.status === 'Finalizado';
             return j.status !== 'Cancelado';
          }).length === 0 && !loading && (
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
        onPaymentClick={setPaymentModalEvent}
        onConfirmacaoClick={setConfirmacaoEvent}
        onEventUpdate={fetchDashboardData}
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
        onClose={() => {
          // If the event we are trying to close is the mandatory pending event, ignore the close (force user).
          if (pendingRatingEvent && ratingEvent?.id === pendingRatingEvent.id) {
            return; // required
          }
          setRatingEvent(null);
        }}
        event={ratingEvent}
        onSubmit={handleRatingSubmit}
        loading={ratingLoading}
        unclosable={!!(pendingRatingEvent && ratingEvent?.id === pendingRatingEvent.id)}
      />
      {/* Modal de pagamento: SÓ abre quando usuario clicar em Gerar Cobrança */}
      <PaymentModal
        isOpen={!!paymentModalEvent}
        onClose={() => setPaymentModalEvent(null)}
        event={paymentModalEvent}
        onSuccess={fetchDashboardData}
      />
      <ConfirmacaoModal
        isOpen={!!confirmacaoEvent}
        onClose={() => setConfirmacaoEvent(null)}
        event={confirmacaoEvent}
      />
      <PaymentPromptModal
        isOpen={!!paymentPromptEvent}
        event={paymentPromptEvent}
        onClose={handlePaymentPromptClose}
        onGeneratePayment={(event) => { 
          if (paymentPromptEvent) {
            const newSet = new Set([...shownPaymentPrompts, paymentPromptEvent.id]);
            setShownPaymentPrompts(newSet);
            sessionStorage.setItem('shownPaymentPrompts', JSON.stringify([...newSet]));
          }
          setPaymentModalEvent(event); 
          setPaymentPromptEvent(null); 
        }}
        onMarkAsSent={handleMarkPaymentAsSent}
      />
    </div>
  );
}
