import React from 'react';

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 ${className}`}>
    {children}
  </div>
);
