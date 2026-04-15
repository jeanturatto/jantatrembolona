import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Utensils, Lock, Pencil, Eye, CheckCheck, XCircle, UserCog, Trash2, Receipt, MapPin, Star } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CreateEventModal } from '../components/CreateEventModal';
import { EditEventModal } from '../components/EditEventModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { JustificativaModal } from '../components/JustificativaModal';
import { AdminAttendanceModal } from '../components/AdminAttendanceModal';
import { PaymentModal } from '../components/PaymentModal';
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

  // Prazo = meio-dia (12:00) do dia da janta em BRT
  const deadlineBRT = new Date(eventYear, eventMonth, eventDay, 12, 0, 0, 0);
  const brtAsDate = new Date(
    brt.getFullYear(), brt.getMonth(), brt.getDate(),
    brt.getHours(), brt.getMinutes(), brt.getSeconds()
  );

  return brtAsDate >= deadlineBRT;
};

export default function JantasPage() {
  const { user, isAdmin } = useAuth();
  const [jantas, setJantas] = useState([]);
  const [filter, setFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJustModalOpen, setIsJustModalOpen] = useState(false);
  const [justEventId, setJustEventId] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [ausenciasNoMes, setAusenciasNoMes] = useState(0);
  const LIMITE_AUSENCIAS = 3;
  const [paymentEvent, setPaymentEvent] = useState(null);
  const [ratingEvent, setRatingEvent] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [myRatingsIds, setMyRatingsIds] = useState(new Set());

  const fetchJantas = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ data, error }, { data: myRatings }] = await Promise.all([
        supabase
          .from('events')
          .select('*, attendances(user_id, status)')
          .order('date', { ascending: false }),
        supabase
          .from('ratings')
          .select('event_id')
          .eq('user_id', user.id)
      ]);

      if (error) {
        console.error('Erro ao buscar jantas:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Auto-conclude past open events
        const toAutoClose = data.filter(j => {
          const eventDate = new Date(j.date);
          eventDate.setHours(0, 0, 0, 0);
          return j.status === 'Aberto' && eventDate < today;
        });
        if (toAutoClose.length > 0) {
          await Promise.all(toAutoClose.map(j =>
            supabase.from('events').update({ status: 'Finalizado' }).eq('id', j.id)
          ));
          toAutoClose.forEach(j => { j.status = 'Finalizado'; });
        }

        setMyRatingsIds(new Set((myRatings || []).map(r => r.event_id)));

        const formattedJantas = data.map(j => {
          const presentes = j.attendances?.filter(a => a.status === 'Presente') || [];
          const userAtt = j.attendances?.find(a => a.user_id === user.id);
          const eventDate = new Date(j.date);
          return {
            id: j.id,
            rawName: j.name,
            name: j.name || 'Janta das Quintas',
            date: eventDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
            dateFormatted: eventDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
            rawDate: j.date,
            rawLocation: j.location,
            location: j.location,
            status: j.status,
            responsibles: j.responsibles || [],
            responsiblesLabel: `${j.responsibles?.length || 0} responsável(is)`,
            attendees: presentes.length,
            userStatus: userAtt ? userAtt.status : null,
            created_by: j.created_by,
            payment_value: j.payment_value || null,
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
      }
    } catch (error) {
      console.error('Error fetching jantas:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchJantas(); }, [fetchJantas]);

  // Re-busca dados quando a aba volta ao foco
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchJantas();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchJantas]);

  // Count current month absences
  useEffect(() => {
    const fetchAusencias = async () => {
      const now = new Date();
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'Ausente')
        .gte('created_at', inicio)
        .lte('created_at', fim);
      setAusenciasNoMes(data?.length || 0);
    };
    fetchAusencias();
  }, [user.id, jantas]);

  const handleAttendance = async (eventId, statusParam, justificativa = null) => {
    const janta = jantas.find(j => j.id === eventId);
    if (janta && isEventPastDeadline(janta.rawDate)) {
      alert('O prazo de confirmação encerrou às 16:00 (horário de Brasília).');
      return;
    }
    setActionLoading(eventId);
    try {
      const payload = { event_id: eventId, user_id: user.id, status: statusParam };
      if (justificativa) payload.justificativa = justificativa;
      const { error } = await supabase.from('attendances').upsert(payload, { onConflict: 'event_id,user_id' });
      if (error) throw error;
      await fetchJantas();
    } catch (err) {
      alert('Erro ao registrar presença.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRatingSubmit = async ({ eventId, stars, comment }) => {
    setRatingLoading(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .insert({
          event_id: eventId,
          user_id: user.id,
          stars,
          comment
        });

      if (error) throw error;
      setRatingEvent(null);
      fetchJantas();
    } catch (err) {
      console.error('Erro ao avaliar:', err);
      alert('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleJustificado = (eventId) => {
    const janta = jantas.find(j => j.id === eventId);
    if (janta && isEventPastDeadline(janta.rawDate)) {
      alert('O prazo de confirmação encerrou às 16:00 (horário de Brasília).');
      return;
    }
    setJustEventId(eventId); setIsJustModalOpen(true); 
  };

  const handleJustificativaConfirm = async (texto) => {
    await handleAttendance(justEventId, 'Falta Justificada', texto);
    setIsJustModalOpen(false);
    setJustEventId(null);
  };

  const handleNaoVou = (eventId) => {
    const janta = jantas.find(j => j.id === eventId);
    if (janta && isEventPastDeadline(janta.rawDate)) {
      alert('O prazo de confirmação encerrou às 16:00 (horário de Brasília).');
      return;
    }
    if (ausenciasNoMes >= LIMITE_AUSENCIAS) {
      alert(`Você já marcou "Não Vou" ${LIMITE_AUSENCIAS}x neste mês. A partir de agora é obrigatório justificar.`);
      handleJustificado(eventId);
      return;
    }
    handleAttendance(eventId, 'Ausente');
  };

  const handleConcluir = async (eventId) => {
    if (!confirm('Concluir esta janta?')) return;
    setActionLoading(eventId);
    try {
      const { error } = await supabase.from('events').update({ status: 'Finalizado' }).eq('id', eventId);
      if (error) throw error;
      await fetchJantas();
    } catch (err) { 
      alert('Erro ao concluir janta: ' + (err.message || 'Erro desconhecido.')); 
      console.error(err);
    }
    finally { setActionLoading(null); }
  };

  const handleCancelar = async (eventId) => {
    if (!confirm('Cancelar esta janta? Os participantes serão notificados.')) return;
    setActionLoading(eventId);
    try {
      const { error } = await supabase.from('events').update({ status: 'Cancelado' }).eq('id', eventId);
      if (error) throw error;
      await fetchJantas();
    } catch (err) { 
      alert('Erro ao cancelar janta: ' + (err.message || 'Erro desconhecido.')); 
      console.error(err);
    }
    finally { setActionLoading(null); }
  };

  const handleDeleteJanta = async (eventId, eventName) => {
    if (!confirm(`⚠️ ATENÇÃO: Isso irá apagar permanentemente a janta "${eventName}" e todos os registros de presença vinculados. Esta ação não pode ser desfeita. Confirmar?`)) return;
    setActionLoading(eventId);
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;
      await fetchJantas();
    } catch (err) {
      alert('Erro ao apagar janta: ' + (err.message || 'Erro desconhecido.'));
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const canEdit = (janta) => isAdmin;

  // Tabs: Canceladas only for ADMIN
  const filters = ['Todas', 'Abertas', 'Concluídas', ...(isAdmin ? ['Canceladas'] : [])];

  const filteredJantas = jantas.filter(j => {
    if (filter === 'Abertas') return j.status === 'Aberto';
    if (filter === 'Concluídas') return j.status === 'Finalizado';
    if (filter === 'Canceladas') return j.status === 'Cancelado';
    // "Todas" for non-admin hides Canceladas
    return isAdmin ? true : j.status !== 'Cancelado';
  });

  // Status badge styles
  const badgeStyle = (status) => {
    if (status === 'Aberto') return 'bg-green-100 text-green-700';
    if (status === 'Cancelado') return 'bg-red-100 text-red-600 dark:bg-red-900/20';
    return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20 min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2 mb-4">
        <h1 className="text-2xl font-bold">Jantas</h1>
        {isAdmin && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-zinc-900 text-white dark:bg-white dark:text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity w-full sm:w-auto justify-center mt-2 sm:mt-0"
          >
            <Plus size={18} /> Nova Janta
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-1 overflow-x-auto">
        {filters.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`pb-2 text-sm font-medium px-2 whitespace-nowrap ${filter === t ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'text-zinc-400'}`}
          >{t}</button>
        ))}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {loading && <p className="text-sm text-zinc-500 p-4 text-center">Carregando jantas...</p>}
        {!loading && filteredJantas.length === 0 && (
          <div className="text-center p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-500 font-medium">Nenhuma janta encontrada.</p>
          </div>
        )}

        {filteredJantas.map(janta => (
          <Card 
            key={janta.id} 
            onClick={() => setDetailEvent(janta)}
            className={`flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer ${janta.status === 'Cancelado' ? 'opacity-70' : ''}`}
          >
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${badgeStyle(janta.status)}`}>
                    {janta.status}
                  </span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white mb-1 capitalize">{janta.name}</p>
                <p className="text-xs font-medium text-zinc-500 mb-1 capitalize">{janta.date}</p>
                {janta.location && (
                  <p className="text-xs flex items-center gap-2 text-zinc-500 mb-1 capitalize">
                    <MapPin size={12} className="shrink-0" /> {janta.location}
                  </p>
                )}
                <p className="text-xs flex items-center gap-2 text-zinc-500"><Utensils size={12} /> {janta.responsiblesLabel}</p>
              </div>

              {/* Right: confirmados + action buttons */}
              <div className="flex flex-col items-end gap-2">
                <div className="bg-zinc-50 dark:bg-zinc-800 px-3 py-2 rounded-lg flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-zinc-400" />
                    <span className="text-sm font-bold">{janta.attendees}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Confirmados</span>
                </div>

                <div 
                  className="flex items-center gap-2 flex-wrap justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Avaliar (se concluida, não avaliada) */}
                  {janta.status === 'Finalizado' && !myRatingsIds.has(janta.id) && (
                    <button onClick={() => setRatingEvent(janta)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors">
                      <Star size={12} className="fill-amber-500" /> Avaliar
                    </button>
                  )}

                  {/* Editar */}
                  {canEdit(janta) && janta.status !== 'Cancelado' && (
                    <button onClick={() => setEditEvent(janta)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 transition-colors">
                      <Pencil size={12} /> Editar
                    </button>
                  )}

                  {/* Admin/Responsável: Gerar Cobrança (somente Finalizado) */}
                  {janta.status === 'Finalizado' && janta.responsibles.includes(user.id) && (
                    <button onClick={() => setPaymentEvent(janta)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors">
                      <Receipt size={12} />
                      {janta.payment_value ? 'Ver Cobrança' : 'Gerar Cobrança'}
                    </button>
                  )}
                  {/* Admin: Ver/editar cobrança gerada por responsável */}
                  {janta.status === 'Finalizado' && isAdmin && !janta.responsibles.includes(user.id) && janta.payment_value && (
                    <button onClick={() => setPaymentEvent(janta)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors">
                      <Receipt size={12} /> Ver Cobrança
                    </button>
                  )}

                  {/* Admin: Gerenciar Presaças */}
                  {isAdmin && janta.status === 'Aberto' && (
                    <button onClick={() => setAttendanceEvent(janta)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                      <UserCog size={12} /> Presenças
                    </button>
                  )}

                  {/* Admin: Concluir */}
                  {isAdmin && janta.status === 'Aberto' && (
                    <button onClick={() => handleConcluir(janta.id)} disabled={actionLoading === janta.id}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <CheckCheck size={12} /> Concluir
                    </button>
                  )}

                  {/* Admin: Cancelar */}
                  {isAdmin && janta.status === 'Aberto' && (
                    <button onClick={() => handleCancelar(janta.id)} disabled={actionLoading === janta.id}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                      <XCircle size={12} /> Cancelar
                    </button>
                  )}

                  {/* Admin: Apagar (permanente — todos os status) */}
                  {isAdmin && (
                    <button onClick={() => handleDeleteJanta(janta.id, janta.name)} disabled={actionLoading === janta.id}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/10 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={12} /> Apagar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance buttons (only for Aberto and not Cancelado) */}
            {janta.status === 'Aberto' && (
              <div 
                className="flex flex-col sm:flex-row flex-wrap gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800"
                onClick={(e) => e.stopPropagation()}
              >
                {janta.responsibles.includes(user.id) ? (
                  <button disabled className="flex-1 sm:flex-none text-xs font-bold py-2 px-4 rounded-xl border border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10 min-w-[140px] flex items-center gap-2 cursor-not-allowed">
                    <Lock size={12} /> Responsável (Confirmado)
                  </button>
                ) : janta.userStatus === 'Presente' ? (
                  <button disabled className="flex-1 sm:flex-none text-xs font-bold py-2 px-4 rounded-xl border border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10 min-w-[140px] flex items-center gap-2 cursor-not-allowed opacity-80">
                    <Lock size={12} /> Presença Confirmada
                  </button>
                ) : janta.userStatus === 'Falta Justificada' ? (
                  <button disabled className="flex-1 sm:flex-none text-xs font-bold py-2 px-4 rounded-xl border border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 min-w-[140px] flex items-center gap-2 cursor-not-allowed opacity-80">
                    <Lock size={12} /> Falta Justificada
                  </button>
                ) : janta.userStatus === 'Ausente' ? (
                  <button disabled className="flex-1 sm:flex-none text-xs font-bold py-2 px-4 rounded-xl border border-zinc-400 text-zinc-500 bg-zinc-100 dark:bg-zinc-800 min-w-[140px] flex items-center gap-2 cursor-not-allowed opacity-80">
                    <Lock size={12} /> Não Vai
                  </button>
                ) : isEventPastDeadline(janta.rawDate) ? (
                  <button disabled className="flex-1 sm:flex-none text-xs font-bold py-2 px-4 rounded-xl border border-red-300 text-red-400 bg-red-50 dark:bg-red-900/10 min-w-[140px] flex items-center gap-2 cursor-not-allowed opacity-80">
                    Prazo Encerrado
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleAttendance(janta.id, 'Presente')} disabled={actionLoading === janta.id}
                      className="flex-1 sm:flex-none border-2 border-green-500 bg-green-50 dark:bg-green-500/10 text-green-600 font-bold text-xs py-2 px-4 rounded-xl hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors min-w-[130px]">
                      {actionLoading === janta.id ? '...' : '✅ Confirmar Presença'}
                    </button>
                    <button onClick={() => handleNaoVou(janta.id)} disabled={actionLoading === janta.id}
                      className="flex-1 sm:flex-none border-2 border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 font-bold text-xs py-2 px-4 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors min-w-[120px]">
                      {actionLoading === janta.id ? '...' : `❌ Não Vou (${Math.max(0, LIMITE_AUSENCIAS - ausenciasNoMes)}x)`}
                    </button>
                    <button onClick={() => handleJustificado(janta.id)} disabled={actionLoading === janta.id}
                      className="flex-1 sm:flex-none bg-amber-50 border border-amber-400 text-amber-600 hover:bg-amber-100 transition-colors text-xs font-bold py-2 px-4 rounded-xl min-w-[140px]">
                      {actionLoading === janta.id ? '...' : '🟡 Não Vou (Justificado)'}
                    </button>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Modals */}
      <CreateEventModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={fetchJantas} />
      <EditEventModal isOpen={!!editEvent} onClose={() => setEditEvent(null)} onSuccess={fetchJantas} event={editEvent} isResponsibleOnly={!isAdmin} />
      <EventDetailModal
        isOpen={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
        onAttendance={handleAttendance}
        onJustificativa={handleJustificado}
        actionLoading={actionLoading}
        pastDeadline={detailEvent ? isEventPastDeadline(detailEvent.rawDate) : false}
        onEditClick={setEditEvent}
        onPaymentClick={setPaymentEvent}
      />
      <AdminAttendanceModal isOpen={!!attendanceEvent} onClose={() => setAttendanceEvent(null)} event={attendanceEvent} onSuccess={fetchJantas} />
      <JustificativaModal
        isOpen={isJustModalOpen}
        onClose={() => { setIsJustModalOpen(false); setJustEventId(null); }}
        onConfirm={handleJustificativaConfirm}
        loading={!!actionLoading}
      />
      <PaymentModal
        isOpen={!!paymentEvent}
        onClose={() => setPaymentEvent(null)}
        event={paymentEvent}
        onSuccess={fetchJantas}
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
