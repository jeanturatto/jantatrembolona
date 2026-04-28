import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileDown, Users, DollarSign, MessageCircle } from 'lucide-react';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

/**
 * Modal for choosing PDF export period and share method
 * Props: isOpen, onClose, onConfirm(params)
 * params: { type: 'month'|'year'|'range', year, month, startDate, endDate, reportType, shareMethod }
 */
export const PdfPeriodoModal = ({ isOpen, onClose, onConfirm }) => {
  const now = new Date();
  const [type, setType] = useState('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('presencas');
  const [shareMethod, setShareMethod] = useState('pdf');

  const years = [now.getFullYear() - 1, now.getFullYear()];

  const handleConfirm = () => {
    if (type === 'range' && (!startDate || !endDate)) {
      alert('Preencha as duas datas.'); return;
    }
    onConfirm({ type, year, month, startDate, endDate, reportType, shareMethod });
    onClose();
  };

  const btnBase = 'text-xs font-bold px-4 py-2 rounded-lg border transition-colors';
  const btnActive = 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent';
  const btnInactive = 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exportar Relatório">
      <div className="space-y-5">
        {/* Share Method selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-400">Como compartilhar</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setShareMethod('pdf')} 
              className={`flex-1 flex items-center justify-center gap-2 ${btnBase} ${shareMethod === 'pdf' ? btnActive : btnInactive}`}
            >
              <FileDown size={14} /> PDF
            </button>
            <button 
              onClick={() => setShareMethod('whatsapp')} 
              className={`flex-1 flex items-center justify-center gap-2 ${btnBase} ${shareMethod === 'whatsapp' ? btnActive : btnInactive}`}
            >
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>
        </div>

        {/* Report Type selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-400">Tipo de Relatório</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setReportType('presencas')} 
              className={`flex-1 flex items-center justify-center gap-2 ${btnBase} ${reportType === 'presencas' ? btnActive : btnInactive}`}
            >
              <Users size={14} /> Presenças
            </button>
            <button 
              onClick={() => setReportType('valores')} 
              className={`flex-1 flex items-center justify-center gap-2 ${btnBase} ${reportType === 'valores' ? btnActive : btnInactive}`}
            >
              <DollarShare size={14} /> Valores
            </button>
          </div>
        </div>

        {/* Type selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-400">Período</label>
          <div className="flex gap-2">
            {[['month','Mês'], ['year','Ano Inteiro'], ['range','Intervalo']].map(([v, l]) => (
              <button key={v} onClick={() => setType(v)} className={`${btnBase} ${type === v ? btnActive : btnInactive}`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Year selector (always visible) */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-400">Ano</label>
          <div className="flex gap-2">
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)} className={`${btnBase} ${year === y ? btnActive : btnInactive}`}>{y}</button>
            ))}
          </div>
        </div>

        {/* Month selector (only for 'month' type) */}
        {type === 'month' && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Mês</label>
            <div className="flex flex-wrap gap-1.5">
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setMonth(i)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${month === i ? btnActive : btnInactive}`}>
                  {m.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date range (only for 'range' type) */}
        {type === 'range' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Data início</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Data fim</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white transition-all" />
            </div>
          </div>
        )}

        {/* Preview text */}
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-center">
          <p className="text-xs font-bold text-zinc-500">
            {type === 'month' && `${MONTHS[month]} ${year}`}
            {type === 'year' && `Ano inteiro ${year}`}
            {type === 'range' && (startDate && endDate ? `${startDate} até ${endDate}` : 'Selecione as datas')}
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm}
            className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <FileDown size={16} /> Gerar PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};
