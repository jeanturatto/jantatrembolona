import React, { useEffect, useState } from 'react';
import { Calendar, Users, Percent, AlertCircle, Utensils, Lock } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { JustificativaModal } from '../components/JustificativaModal';
import { EventDetailModal } from '../components/EventDetailModal';

// Regra: o prazo de confirmação encerra no DIA ANTERIOR à janta às 16:00 BRT.
// Ex: janta dia 02/04 → prazo encerra 01/04 às 16h.
const isEventPastDeadline = (eventDateStr) => {
  if (!eventDateStr) return false;
  const now = new Date();
  const brtOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const brt = new Date(utcMs + brtOffset * 60000);

  // Data da janta em UTC → componentes de data locais
  const eventDate = new Date(eventDateStr);
  const eventYear = eventDate.getUTCFullYear();
  const eventMonth = eventDate.getUTCMonth();
  const eventDay = eventDate.getUTCDate();

  // Prazo = dia anterior à janta às 16:00 BRT
  // Construímos o prazo como Date em BRT
  const deadlineBRT = new Date(eventYear, eventMonth, eventDay - 1, 16, 0, 0, 0);
  // deadlineBRT está em timezone LOCAL do JS, mas precisamos comparar com BRT atual
  // Convertemos o BRT atual para um Date comparável
  const brtAsDate = new Date(
    brt.getFullYear(),
    brt.getMonth(),
    brt.getDate(),
    brt.getHours(),
    brt.getMinutes(),
    brt.getSeconds()
  );

  return brtAsDate >= deadlineBRT;
};

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [jantas, setJantas] = useState([]);
  const [stats, setStats] = useState({ totalJantas: 0, membros: 0, presencaMedia: '0%', inadimplentes: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isJustModalOpen, setIsJustModalOpen] = useState(false);
  const [justEventId, setJustEventId] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const [{ data: jantasData }, { count: membrosCount }, { count: inadimplentesCount }, { data: attendances }, { data: allProfiles }] = await Promise.all([
        supabase.from('events').select('*, attendances(user_id, status)').order('date', { ascending: false }).limit(5),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('inadimplente', true),
        supabase.from('attendances').select('*'),
        supabase.from('profiles').select('id, name, email')
      ]);

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

        const userTotalExpected = attendances?.filter(a => a.user_id === user.id).length || 0;
        const userPresentes = attendances?.filter(a => a.user_id === user.id && a.status === 'Presente').length || 0;
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchDashboardData();
  }, [user?.id]);

  // Re-busca dados quando a aba volta ao foco (resolve perda de dados por inatividade)
  useEffect(() => {
    if (!user?.id) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id]);

  // Auto-mark past-deadline on today's open janta
  const autoMarkedRef = React.useRef(false);
  useEffect(() => {
    let isSubscribed = true;
    const autoMarkDeadline = async () => {
      if (autoMarkedRef.current) return;
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
        console.error("Erro ao fechar janta fora do prazo", err);
      }
    };
    if (jantas.length > 0 && profile) autoMarkDeadline();
    return () => { isSubscribed = false; };
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

  const handleJustificativaConfirm = async (texto) => {
    await handleAttendance(justEventId, 'Falta Justificada', texto);
    setIsJustModalOpen(false);
    setJustEventId(null);
  };

  const proximaJanta = jantas.find(j => j.status === 'Aberto');
  const pastDeadline = proximaJanta ? isEventPastDeadline(proximaJanta.rawDate) : false;

  if (loading) return <div className="p-8 text-center text-zinc-500 animate-pulse">Carregando painel...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white capitalize">
          Olá, {profile?.name || user?.email?.split('@')[0] || 'Usuário'} 👋
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Bem-vindo ao Janta Trembolona</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "TOTAL DE JANTAS", value: stats.totalJantas, icon: Calendar },
          { label: "MEMBROS", value: stats.membros, icon: Users },
          { label: "SUA PRESENÇA", value: stats.presencaMedia, icon: Percent },
          { label: "INADIMPLENTES", value: stats.inadimplentes, icon: AlertCircle, color: "text-red-500" },
        ].map((stat, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <span className="text-[10px] md:text-xs font-bold text-zinc-400 tracking-wider uppercase leading-tight">{stat.label}</span>
              <stat.icon size={16} className="text-zinc-300 shrink-0" />
            </div>
            <span className={`text-2xl font-bold ${stat.color || "text-zinc-900 dark:text-white"}`}>{stat.value}</span>
          </Card>
        ))}
      </div>

      {/* Próxima Janta — card inteiro clicável */}
      <section>
        <Card
          className={`${proximaJanta ? 'cursor-pointer hover:shadow-md' : ''} transition-all bg-zinc-50 border-dashed border-zinc-300 dark:bg-zinc-800/50`}
          onClick={proximaJanta ? () => setDetailEvent(proximaJanta) : undefined}
        >
          {proximaJanta ? (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              {/* Info — não precisa de onClick próprio pois o Card inteiro já abre */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Próxima Janta</p>
                <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white capitalize truncate">{proximaJanta.name}</h3>
                <p className="text-sm text-zinc-500 mt-0.5 capitalize">{proximaJanta.date}</p>
                <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
                  <Utensils size={14} />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">{proximaJanta.responsiveisNomes}</span>
                </p>
                {pastDeadline && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">⏰ Prazo encerrado (16:00 BRT do dia anterior)</p>
                )}
              </div>

              {/* Botões de ação — stopPropagation para não abrir o modal ao clicar */}
              <div
                className="flex flex-wrap gap-2 w-full md:w-auto"
                onClick={e => e.stopPropagation()}
              >
                <span className="px-3 py-1 bg-zinc-900 text-white dark:bg-white dark:text-black text-[10px] font-bold rounded-full uppercase self-center hidden md:inline-block">Aberto</span>
                {proximaJanta.responsibles.includes(user.id) ? (
                  <button disabled className="flex-1 md:flex-none border border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 cursor-not-allowed">
                    <Lock size={12} /> Responsável (Confirmado)
                  </button>
                ) : proximaJanta.userStatus === 'Presente' ? (
                  <button disabled className="flex-1 md:flex-none border border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 cursor-not-allowed opacity-80">
                    <Lock size={12} /> Presença Confirmada
                  </button>
                ) : proximaJanta.userStatus === 'Falta Justificada' ? (
                  <button disabled className="flex-1 md:flex-none border border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 cursor-not-allowed opacity-80">
                    <Lock size={12} /> Falta Justificada
                  </button>
                ) : proximaJanta.userStatus === 'Ausente' ? (
                  <button disabled className="flex-1 md:flex-none border border-zinc-400 text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 cursor-not-allowed opacity-80">
                    <Lock size={12} /> Não Vai
                  </button>
                ) : pastDeadline ? (
                  <button disabled className="flex-1 md:flex-none border border-red-300 text-red-400 bg-red-50 dark:bg-red-900/10 px-4 py-2 text-xs font-bold rounded-xl cursor-not-allowed opacity-80">
                    Prazo Encerrado
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleAttendance(proximaJanta.id, 'Presente')} disabled={actionLoading}
                      className="flex-1 md:flex-none border-2 border-green-500 bg-green-50 dark:bg-green-500/10 text-green-600 hover:bg-green-100 transition-colors px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap">
                      {actionLoading ? '...' : '✅ Confirmar Presença'}
                    </button>
                    <button onClick={() => handleAttendance(proximaJanta.id, 'Ausente')} disabled={actionLoading}
                      className="flex-1 md:flex-none border-2 border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap">
                      {actionLoading ? '...' : '❌ Não Vou'}
                    </button>
                    <button onClick={() => handleJustificado(proximaJanta.id)} disabled={actionLoading}
                      className="flex-1 md:flex-none bg-amber-50 border border-amber-400 text-amber-600 hover:bg-amber-100 transition-colors px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap">
                      {actionLoading ? '...' : '🟡 Não Vou (Justificado)'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center w-full">
              <p className="text-zinc-500 font-medium">Nenhuma janta marcada para os próximos dias.</p>
            </div>
          )}
        </Card>
      </section>

      {/* Jantas Recentes */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-lg font-bold">Jantas Recentes</h2>
          <Link to="/jantas" className="text-sm font-medium text-zinc-500 hover:underline">Ver todas</Link>
        </div>
        <div className="space-y-2">
          {jantas.map(janta => (
            <Card
              key={janta.id}
              onClick={() => setDetailEvent(janta)}
              className="py-3 px-4 flex items-center justify-between hover:border-zinc-400 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400 shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm capitalize truncate">{janta.name}</p>
                  <p className="text-xs text-zinc-500 capitalize">{janta.date}</p>
                  <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5 capitalize">
                    <Utensils size={10} /> {janta.responsiveisNomes}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ml-2 ${janta.status === 'Aberto' ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-50 border-transparent text-zinc-400'}`}>
                {janta.status}
              </span>
            </Card>
          ))}
          {jantas.length === 0 && <p className="text-sm text-zinc-400">Nenhuma janta registrada ainda.</p>}
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
      />
    </div>
  );
}
