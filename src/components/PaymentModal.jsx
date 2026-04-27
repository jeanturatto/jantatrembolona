import React, { useState, useEffect } from 'react';
import { Copy, CheckCircle, Receipt, Users, Calculator, RefreshCw, Utensils } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';

export const PaymentModal = ({ isOpen, onClose, event, onSuccess }) => {
  const [totalValue, setTotalValue] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [guestNames, setGuestNames] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedRecebedorId, setSelectedRecebedorId] = useState('');

  // Busca participantes e responsáveis ao abrir
  useEffect(() => {
    if (!isOpen || !event?.id) return;

    setGeneratedMessage('');
    setCopied(false);
    // Carrega convidados do evento
    setGuestNames(Array.isArray(event?.guests) ? event.guests : []);

    const fetchData = async () => {
      setLoading(true);
      try {
        // Presentes
        const { data: attData } = await supabase
          .from('attendances')
          .select('user_id')
          .eq('event_id', event.id)
          .eq('status', 'Presente');

        const userIds = (attData || []).map(a => a.user_id);

        let namesMap = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);
          namesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p.name || 'Usuário']));
        }
        setAttendees(userIds.map(id => namesMap[id] || 'Usuário').sort());

        // Responsáveis com PIX
        if (event.responsibles?.length > 0) {
          const { data: respData } = await supabase
            .from('profiles')
            .select('id, name, pix')
            .in('id', event.responsibles);
          setResponsaveis(respData || []);
          if (respData && respData.length > 0) {
            setSelectedRecebedorId(respData[0].id);
          }
        }

        // Pre-preenche valor se já foi gerado antes
        if (event.payment_value) {
          setTotalValue(String(event.payment_value).replace('.', ','));
        }
      } catch (err) {
        console.error('PaymentModal: erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, event?.id]);

  const totalNum = parseFloat((totalValue || '0').replace(',', '.')) || 0;
  const numPeople = (attendees.length + guestNames.length) || 1;
  const perPerson = totalNum > 0 ? Math.ceil(totalNum / numPeople) : 0;

  const buildMessage = () => {
    const recebedor = responsaveis.find(r => r.id === selectedRecebedorId) || responsaveis[0];
    const responsaveisNomes = responsaveis.map(r => r.name).filter(Boolean).join(' e ');
    const pixLines = recebedor && recebedor.pix ? `💳 PIX (${recebedor.name}): ${recebedor.pix}` : '';

    const participantesStr = attendees.map(n => `❌ ${n}`).join('\n');
    const convidadosStr = guestNames.length > 0
      ? guestNames.map(n => `👥 ${n} (convidado)`).join('\n')
      : '';
    const dateStr = event?.dateFormatted || event?.date || '';
    const location = event?.rawLocation || event?.location || '';
    const totalPessoas = attendees.length + guestNames.length;

    return [
      `🍽️ *${event?.name || 'Janta'}*`,
      dateStr ? `📅 ${dateStr}` : null,
      location ? `🏠 ${location}` : null,
      responsaveisNomes ? `👨‍🍳 Responsáveis: ${responsaveisNomes}` : null,
      '',
      `Participantes (${totalPessoas} ${totalPessoas === 1 ? 'pessoa' : 'pessoas'}):`,
      participantesStr,
      convidadosStr || null,
      '',
      `💰 Valor total: R$ ${totalNum.toFixed(2).replace('.', ',')}`,
      `👥 Divisão: R$ ${perPerson},00 por pessoa`,
      pixLines ? `\n${pixLines}` : null,
    ].filter(l => l !== null).join('\n');
  };

  const handleGenerate = async () => {
    if (!totalNum || totalNum <= 0) return;
    setSaving(true);
    try {
      // Salva o valor no banco para que admin possa editar depois
      await supabase
        .from('events')
        .update({ payment_value: totalNum })
        .eq('id', event.id);

      setGeneratedMessage(buildMessage());
      onSuccess?.();
    } catch (err) {
      console.error('PaymentModal: erro ao salvar:', err);
      // Mesmo se falhar no banco, mostra a mensagem
      setGeneratedMessage(buildMessage());
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedMessage(buildMessage());
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para dispositivos sem clipboard API
      const el = document.createElement('textarea');
      el.value = generatedMessage;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleClose = () => {
    setGeneratedMessage('');
    setCopied(false);
    onClose();
  };

  if (!event) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="💰 Acerto da Janta">
      {loading ? (
        <div className="py-10 text-center">
          <div className="w-8 h-8 border-4 border-zinc-200 dark:border-zinc-700 border-t-[#2842B5] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Carregando dados da janta...</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Info do evento */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-700 space-y-1">
            <p className="font-bold text-zinc-900 dark:text-white capitalize text-sm leading-tight">{event.name}</p>
            <p className="text-xs text-zinc-400 capitalize">{event.dateFormatted || event.date}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-zinc-400" />
                <span className="text-xs text-zinc-500 font-medium">{attendees.length} confirmados</span>
              </div>
              {guestNames.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-violet-500 font-bold">+{guestNames.length} convidado{guestNames.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Input do valor total */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Valor Total Gasto</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalValue}
                onChange={e => { setTotalValue(e.target.value); setGeneratedMessage(''); }}
                placeholder="0,00"
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-[#2842B5] dark:focus:border-white transition-all text-sm font-bold text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          {/* Preview da divisão */}
          {totalNum > 0 && (attendees.length > 0 || guestNames.length > 0) && (
            <div className="flex items-center gap-3 p-4 bg-[#2842B5]/[0.06] dark:bg-[#2842B5]/10 border border-[#2842B5]/15 rounded-xl">
              <Calculator size={18} className="text-[#2842B5] dark:text-[#B8ABCF] shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Divisão</p>
                <p className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  R$ {perPerson}<span className="text-sm font-medium text-zinc-400">,00 / pessoa</span>
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  R$ {totalNum.toFixed(2).replace('.', ',')} ÷ {numPeople} pessoas
                  {guestNames.length > 0 && ` (${attendees.length} confirmados + ${guestNames.length} convidados)`}
                </p>
              </div>
            </div>
          )}

          {/* PIX dos responsáveis */}
          {responsaveis.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Conta para recebimento (PIX)</p>
              <div className="relative">
                <select 
                  value={selectedRecebedorId}
                  onChange={e => { setSelectedRecebedorId(e.target.value); setGeneratedMessage(''); }}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-[#2842B5] dark:focus:border-white transition-all text-sm font-bold text-zinc-900 dark:text-white appearance-none"
                >
                  {responsaveis.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.pix ? `(${r.pix})` : '(Sem PIX)'}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                  ▼
                </div>
              </div>
            </div>
          )}

          {/* Mensagem gerada */}
          {generatedMessage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Mensagem para WhatsApp</p>
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-1 text-[10px] text-[#2842B5] dark:text-[#B8ABCF] font-bold hover:underline underline-offset-2"
                >
                  <RefreshCw size={10} /> Gerar Novamente
                </button>
              </div>
              <div className="relative">
                <pre className="p-4 pr-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[11px] text-zinc-700 dark:text-zinc-300 font-sans whitespace-pre-wrap leading-relaxed overflow-auto max-h-64">
                  {generatedMessage}
                </pre>
                <button
                  onClick={handleCopy}
                  className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                    copied
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                      : 'bg-white dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-600'
                  }`}
                >
                  {copied ? <><CheckCircle size={11} /> Copiado!</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClose}
              className="flex-1 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {generatedMessage ? 'Fechar' : 'Depois'}
            </button>
            {generatedMessage ? (
              <button
                onClick={handleCopy}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  copied
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-[#2842B5] hover:bg-[#3452c5] text-white'
                }`}
              >
                {copied ? <><CheckCircle size={15} /> Copiado!</> : <><Copy size={15} /> Copiar Mensagem</>}
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!totalNum || totalNum <= 0 || saving}
                className="flex-1 py-3 bg-[#2842B5] hover:bg-[#3452c5] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Receipt size={15} />
                {saving ? 'Salvando...' : 'Gerar Mensagem'}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
