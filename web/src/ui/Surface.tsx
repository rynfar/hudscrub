import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  inset?: boolean;
}

export function Surface({ children, inset = false, className = '', ...rest }: Props) {
  return (
    <div
      className={`bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg ${inset ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
