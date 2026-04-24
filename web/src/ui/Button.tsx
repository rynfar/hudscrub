'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[color:var(--color-ink)] text-[color:var(--color-bg)] hover:bg-[#2a2a2a]',
  secondary:
    'bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink)] hover:bg-[#ECEAE3] border border-[color:var(--color-border)]',
  ghost:
    'bg-transparent text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]',
  danger:
    'bg-transparent text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
