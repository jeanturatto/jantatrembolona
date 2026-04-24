import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Copy, CheckCircle, MessageSquare, Users, Calendar, MapPin, X, Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Modal que gera a mensagem de confirmação de participantes para WhatsApp.
 * Aparece para admins e responsáveis após o prazo de confirmação.
 * Props:
 *   isOpen  - bool
 *   onClose - fn
 *   event   - evento formatado (id, name, dateFormatted, location, responsibles, guests)
 */
export const ConfirmacaoModal = ({ isOpen, onClose, event }) => {
  const [confirmedNames, setConfirmedNames] = useState([]);
  const [respNames, setRespNames] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !event?.id) return;
    setCopied(false);

    const fetchData = async () => {
      setLoading(true);
      try {
        // Busca confirmados (Presente)
        const { data: attData } = await supabase
          .from('attendances')
          .select('user_id')
          .eq('event_id', event.id)
          .eq('status', 'Presente');

        const userIds = (attData || []).map(a => a.user_id);

        let names = [];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', userIds);
          names = (profiles || [])
            .map(p => p.name || p.email?.split('@')[0] || 'Usuário')
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        }
        setConfirmedNames(names);

        // Busca responsáveis
        if (event.responsibles?.length > 0) {
          const { data: respData } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', event.responsibles);
          setRespNames(
            (respData || []).map(p => p.name || p.email?.split('@')[0]).filter(Boolean).join(' e ')
          );
        }
      } catch (err) {
        console.error('ConfirmacaoModal: erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, event?.id]);

  const guestNames = Array.isArray(event?.guests) ? event.guests : [];
  const totalPessoas = confirmedNames.length + guestNames.length;

  const buildMessage = () => {
    const dateStr = event?.dateFormatted || event?.date || '';
    const location = event?.rawLocation || event?.location || '';

    const linhasConfirmados = confirmedNames.map(n => `✅ ${n}`).join('\n');
    const linhasConvidados = guestNames.length > 0
      ? guestNames.map(n => `👥 ${n} (convidado)`).join('\n')
      : '';

    return [
      `🍽️ *${event?.name || 'Janta'}*`,
      dateStr ? `📅 ${dateStr}` : null,
      location ? `📍 ${location}` : null,
      respNames ? `👨‍🍳 Responsáveis: ${respNames}` : null,
      '',
      `*Confirmados (${totalPessoas} ${totalPessoas === 1 ? 'pessoa' : 'pessoas'}):*`,
      linhasConfirmados || '_(nenhum confirmado)_',
      linhasConvidados || null,
      '',
      `_Prazo encerrado — lista final de presença._`,
    ].filter(l => l !== null).join('\n');
  };

  const handleCopy = async () => {
    const msg = buildMessage();
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      const el = document.createElement('textarea');
      el.value = msg;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen || !event) return null;

  const message = buildMessage();

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-zinc-900 dark:text-white">Confirmação de Participantes</p>
              <p className="text-[10px] text-zinc-400 capitalize truncate max-w-[220px]">{event.name || 'Janta'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          {event.dateFormatted && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-100 dark:border-zinc-700">
              <Calendar size={11} /> <span className="capitalize">{event.dateFormatted}</span>
            </span>
          )}
          {(event.location || event.rawLocation) && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-100 dark:border-zinc-700">
              <MapPin size={11} /> {event.location || event.rawLocation}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-800/30">
            <Users size={11} /> {totalPessoas} {totalPessoas === 1 ? 'pessoa' : 'pessoas'}
          </span>
          {guestNames.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 rounded-full border border-violet-100 dark:border-violet-800/30">
              +{guestNames.length} convidado{guestNames.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Mensagem */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-4 border-zinc-200 dark:border-zinc-700 border-t-green-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Carregando confirmações...</p>
            </div>
          ) : (
            <div className="relative">
              {/* Fake WhatsApp bubble */}
              <div className="bg-[#DCF8C6] dark:bg-[#1a3a2a] rounded-2xl rounded-tl-sm p-4 shadow-sm">
                <pre className="text-[12px] text-zinc-800 dark:text-zinc-200 font-sans whitespace-pre-wrap leading-relaxed">
                  {message}
                </pre>
              </div>
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#DCF8C6] dark:bg-[#1a3a2a]"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <button
            onClick={handleCopy}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            } disabled:opacity-50`}
          >
            {copied ? (
              <><CheckCircle size={16} /> Copiado!</>
            ) : (
              <><Copy size={16} /> Copiar Mensagem</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
