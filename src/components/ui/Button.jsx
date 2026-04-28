import { forwardRef } from 'react';

const variants = {
  primary: 'bg-primary text-on-primary hover:bg-opacity-90 active:bg-opacity-80',
  secondary: 'bg-secondary text-on-secondary border border-outline hover:bg-surface active:bg-outline-variant',
  outline: 'bg-transparent text-on-surface border border-outline hover:bg-surface active:bg-outline-variant',
  ghost: 'bg-transparent text-on-surface hover:bg-surface active:bg-outline-variant',
  destructive: 'bg-error text-on-error hover:bg-opacity-90 active:bg-opacity-80',
};

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  ...props
}, ref) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-medium rounded-lg
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50
    disabled:opacity-50 disabled:pointer-events-none
    cursor-pointer
  `;

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="material-symbols-outlined animate-spin text-lg">
          sync
        </span>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;