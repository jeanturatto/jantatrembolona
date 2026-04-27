import React from 'react';
import { createPortal } from 'react-dom';
import { Receipt, CheckCircle, X } from 'lucide-react';

export const PaymentPromptModal = ({ isOpen, event, onClose, onGeneratePayment, onMarkAsSent }) => {
  if (!isOpen || !event) return null;

  const eventDate = event.rawDate ? new Date(event.rawDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : event.dateFormatted;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-500 px-5 py-4 text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <Receipt size={24} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Janta Finalizada!</h2>
          <p className="text-emerald-100 text-sm">Hora de realizar a cobrança</p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-center">
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">
              A janta <strong className="text-zinc-900 dark:text-white">"{event.name}"</strong> foi concluída.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-2">
              {eventDate}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">
              O que você gostaria de fazer?
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => { onGeneratePayment(event); onClose(); }}
              className="w-full py-3 px-4 bg-[#2842B5] hover:bg-[#3452c5] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Receipt size={18} /> Gerar Cobrança
            </button>

            <button
              onClick={() => { onMarkAsSent(event.id); onClose(); }}
              className="w-full py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Cobrança já enviada
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-sm font-medium transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};