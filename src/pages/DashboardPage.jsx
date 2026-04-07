import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Users, Percent, AlertCircle, Utensils, Lock } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { JustificativaModal } from '../components/JustificativaModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { EditEventModal } from '../components/EditEventModal';

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

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const [
        { data: jantasData, error: jantasErr },
        { count: membrosCount },
        { count: inadimplentesCount },
        { data: attendances },
        { data: allProfiles }
      ] = await Promise.all([
        supabase.from('events').select('*, attendances(user_id, status)').eq('status', 'Aberto').order('date', { ascending: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('inadimplente', true),
        supabase.from('attendances').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('id, name, email'),
      ]);

      if (jantasErr) throw jantasErr;

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

  const handleJustificativaConfirm = async (texto) => {
    await handleAttendance(justEventId, 'Falta Justificada', texto);
    setIsJustModalOpen(false);
    setJustEventId(null);
  };

  const proximaJanta = jantas.find(j => j.status === 'Aberto');
  const pastDeadline = proximaJanta ? isEventPastDeadline(proximaJanta.rawDate) : false;

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
                    <button disabled className="flex-1 md:flex-none border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-not-allowed">
                      <Lock size={12} /> Responsável
                    </button>
                  ) : proximaJanta.userStatus === 'Presente' ? (
                    <button disabled className="flex-1 md:flex-none border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-not-allowed">
                      <Lock size={12} /> Confirmado
                    </button>
                  ) : proximaJanta.userStatus === 'Falta Justificada' ? (
                    <button disabled className="flex-1 md:flex-none border border-amber-400/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-not-allowed">
                      <Lock size={12} /> Justificado
                    </button>
                  ) : proximaJanta.userStatus === 'Ausente' ? (
                    <button disabled className="flex-1 md:flex-none border border-zinc-300 dark:border-white/10 text-zinc-400 dark:text-[#5a5a80] bg-zinc-50 dark:bg-white/[0.03] px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-not-allowed">
                      <Lock size={12} /> Não vai
                    </button>
                  ) : pastDeadline ? (
                    <button disabled className="flex-1 md:flex-none border border-red-300 dark:border-red-500/20 text-red-400 bg-red-50 dark:bg-red-500/[0.06] px-4 py-2 text-xs font-semibold rounded-xl cursor-not-allowed">
                      Prazo Encerrado
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleAttendance(proximaJanta.id, 'Presente')} disabled={actionLoading}
                        className="flex-1 md:flex-none border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap">
                        {actionLoading ? '...' : '✓ Confirmar'}
                      </button>
                      <button onClick={() => handleAttendance(proximaJanta.id, 'Ausente')} disabled={actionLoading}
                        className="flex-1 md:flex-none border border-red-400/40 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap">
                        {actionLoading ? '...' : '✕ Não vou'}
                      </button>
                      <button onClick={() => handleJustificado(proximaJanta.id)} disabled={actionLoading}
                        className="flex-1 md:flex-none border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap">
                        {actionLoading ? '...' : 'Justificado'}
                      </button>
                    </>
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
    </div>
  );
}
