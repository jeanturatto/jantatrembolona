import React, { useState } from 'react';
import { Modal } from './Modal';

export const JustificativaModal = ({ isOpen, onClose, onConfirm, loading }) => {
  const [texto, setTexto] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    onConfirm(texto.trim());
    setTexto('');
  };

  const handleClose = () => {
    setTexto('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Justificar Falta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-zinc-500">Descreva o motivo da sua falta. Esta informação será visível apenas para os administradores.</p>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">Motivo</label>
          <textarea
            required
            rows={4}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex: Viagem de trabalho, compromisso médico..."
            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm text-zinc-900 dark:text-white resize-none placeholder:text-zinc-400"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !texto.trim()}
            className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-50 transition-transform active:scale-[0.98]"
          >
            {loading ? 'Enviando...' : 'Confirmar Falta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
