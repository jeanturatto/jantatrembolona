import React from 'react';

export const Card = ({ children, className = "", onClick }) => (
  <div
    className={`
      bg-white/90 dark:bg-white/[0.04]
      backdrop-blur-xl dark:backdrop-blur-2xl
      border border-[#2842B5]/[0.09] dark:border-white/[0.07]
      rounded-2xl p-5
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
