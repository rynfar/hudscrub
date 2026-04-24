import type { ReactNode } from 'react';

type Tone = 'neutral' | 'regex' | 'llm-high' | 'llm-low' | 'manual' | 'rejected' | 'accent';

interface Props {
  tone?: Tone;
  children: ReactNode;
  monospace?: boolean;
}

const toneClasses: Record<Tone, string> = {
  neutral: 'text-[color:var(--color-ink-muted)] bg-[color:var(--color-surface-muted)]',
  regex: 'text-[#0F5F3D] bg-[rgba(22,116,77,0.1)]',
  'llm-high': 'text-[#8B5A14] bg-[rgba(183,121,31,0.12)]',
  'llm-low': 'text-[#9E4815] bg-[rgba(194,94,26,0.12)]',
  manual: 'text-[#5B4192] bg-[rgba(107,79,163,0.12)]',
  rejected: 'text-[color:var(--color-ink-subtle)] bg-[color:var(--color-surface-muted)] line-through',
  accent: 'text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]',
};

export function PillBadge({ tone = 'neutral', children, monospace = false }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] tracking-wide ${toneClasses[tone]} ${monospace ? 'font-mono' : 'font-medium'}`}
    >
      {children}
    </span>
  );
}
