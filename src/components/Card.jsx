import React from 'react';

export const Card = ({ children, className = "", onClick }) => (
  <div
    className={`
      bg-white dark:bg-[#121226]
      border border-zinc-100 dark:border-white/[0.05]
      rounded-[1.25rem] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]
      ${className}
    `}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e); } : undefined}
  >
    {children}
  </div>
);
