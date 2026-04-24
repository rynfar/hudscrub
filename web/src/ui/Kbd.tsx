import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-[1.5rem] px-1.5 rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[10px] font-mono text-[color:var(--color-ink-muted)] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {children}
    </kbd>
  );
}
