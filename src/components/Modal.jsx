import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="
          bg-white dark:bg-[#0e0e20]
          border border-[#2842B5]/10 dark:border-white/[0.08]
          w-full sm:max-w-md
          rounded-t-3xl sm:rounded-2xl
          shadow-2xl
          overflow-hidden
          animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200
          flex flex-col
          max-h-[92dvh] sm:max-h-[90vh]
        "
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-zinc-100 dark:border-white/[0.06] shrink-0">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 dark:text-[#5a5a80] hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="px-5 py-4 sm:px-6 sm:py-5 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
};
