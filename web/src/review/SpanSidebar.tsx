'use client';
import { motion } from 'framer-motion';
import type { Span } from '@/src/types';
import { PillBadge } from '@/src/ui/PillBadge';

interface Props {
  spans: Span[];
  focusedSpanId?: string | null;
  detecting?: boolean;
  onSelect: (spanId: string) => void;
  onAccept: (spanId: string) => void;
  onReject: (spanId: string) => void;
}

const labelOrder = [
  'SSN',
  'EIN',
  'PHONE',
  'EMAIL',
  'DATE',
  'LOAN_NUM',
  'NAME',
  'ADDRESS',
  'OTHER',
  'CUSTOM',
];

const toneForSpan = (s: Span): 'regex' | 'llm-high' | 'llm-low' | 'manual' | 'rejected' => {
  if (s.decision === 'rejected') return 'rejected';
  if (s.source === 'manual') return 'manual';
  if (s.source === 'regex') return 'regex';
  return s.confidence >= 0.85 ? 'llm-high' : 'llm-low';
};

export function SpanSidebar({
  spans,
  focusedSpanId,
  detecting,
  onSelect,
  onAccept,
  onReject,
}: Props) {
  const byLabel = new Map<string, Span[]>();
  for (const s of spans) {
    const arr = byLabel.get(s.label) ?? [];
    arr.push(s);
    byLabel.set(s.label, arr);
  }
  const orderedLabels = labelOrder.filter((l) => byLabel.has(l));

  return (
    <aside className="w-80 shrink-0 border-l border-[color:var(--color-border)] overflow-y-auto bg-[color:var(--color-bg)]">
      <div className="px-5 py-4 border-b border-[color:var(--color-border)]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono flex items-center gap-2">
          Detections
          {detecting && (
            <motion.span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
        </p>
        <p className="text-sm text-[color:var(--color-ink)] mt-0.5">
          {spans.length === 0 ? 'No spans on this page' : `${spans.length} on this page`}
        </p>
      </div>
      <div className="divide-y divide-[color:var(--color-border)]">
        {orderedLabels.map((label) => (
          <div key={label} className="py-3">
            <p className="px-5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono mb-2">
              {label}
            </p>
            <ul>
              {byLabel.get(label)!.map((s) => (
                <li key={s.id}>
                  <motion.button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    whileHover={{ backgroundColor: 'rgba(26, 26, 26, 0.03)' }}
                    transition={{ duration: 0.12 }}
                    className={`w-full text-left px-5 py-2 flex items-center gap-3 ${
                      focusedSpanId === s.id ? 'bg-[color:var(--color-surface-muted)]' : ''
                    }`}
                  >
                    <PillBadge tone={toneForSpan(s)}>·</PillBadge>
                    <span className="font-mono text-xs truncate flex-1">{s.text}</span>
                    {s.decision === 'accepted' && (
                      <span className="text-[10px] text-[#16744D]">✓</span>
                    )}
                    {s.decision === 'rejected' && (
                      <span className="text-[10px] text-[color:var(--color-ink-subtle)]">×</span>
                    )}
                    {s.decision === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAccept(s.id);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#16744D] text-white hover:bg-[#0F5F3D]"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReject(s.id);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink-muted)] hover:bg-[#ECEAE3]"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </motion.button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
