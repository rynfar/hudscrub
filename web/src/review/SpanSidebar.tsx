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
  onResetDecision: (spanId: string) => void;
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
  onResetDecision,
}: Props) {
  const byLabel = new Map<string, Span[]>();
  for (const s of spans) {
    const arr = byLabel.get(s.label) ?? [];
    arr.push(s);
    byLabel.set(s.label, arr);
  }
  const orderedLabels = labelOrder.filter((l) => byLabel.has(l));

  // Source breakdown: how many spans came from each detector
  const sourceCounts = {
    regex: 0,
    llm: 0,
    manual: 0,
  };
  for (const s of spans) {
    if (s.source === 'regex') sourceCounts.regex++;
    else if (s.source === 'manual') sourceCounts.manual++;
    else sourceCounts.llm++;
  }

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
        {spans.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {sourceCounts.regex > 0 && (
              <span className="text-[10px] font-mono text-[#0F5F3D]" title="From regex pattern matching">
                {sourceCounts.regex} regex
              </span>
            )}
            {sourceCounts.llm > 0 && (
              <span className="text-[10px] font-mono text-[#8B5A14]" title="From the AI model">
                {sourceCounts.llm} ai
              </span>
            )}
            {sourceCounts.manual > 0 && (
              <span className="text-[10px] font-mono text-[#5B4192]" title="Added manually by you">
                {sourceCounts.manual} manual
              </span>
            )}
          </div>
        )}
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
                  <motion.div
                    role="button"
                    tabIndex={0}
                    title={s.text}
                    onClick={() => onSelect(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(s.id);
                      }
                    }}
                    whileHover={{ backgroundColor: 'rgba(26, 26, 26, 0.03)' }}
                    transition={{ duration: 0.12 }}
                    className={`w-full text-left px-5 py-2 flex items-start gap-3 cursor-pointer ${
                      focusedSpanId === s.id ? 'bg-[color:var(--color-surface-muted)]' : ''
                    }`}
                  >
                    <PillBadge tone={toneForSpan(s)}>·</PillBadge>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-mono text-xs break-words leading-snug ${
                          s.decision === 'rejected'
                            ? 'line-through text-[color:var(--color-ink-subtle)]'
                            : ''
                        }`}
                      >
                        {s.text}
                      </div>
                      {s.replacement && (
                        <div className="font-mono text-[11px] break-words leading-snug text-[color:var(--color-ink-muted)] mt-0.5 flex items-baseline gap-1.5">
                          <span className="text-[color:var(--color-ink-subtle)]">→</span>
                          <span>{s.replacement}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title={
                          s.decision === 'accepted'
                            ? 'Accepted — click to undo'
                            : 'Accept this span'
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (s.decision === 'accepted') onResetDecision(s.id);
                          else onAccept(s.id);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          s.decision === 'accepted'
                            ? 'bg-[#16744D] text-white hover:bg-[#0F5F3D]'
                            : 'bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink-muted)] hover:bg-[rgba(22,116,77,0.15)] hover:text-[#0F5F3D]'
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        title={
                          s.decision === 'rejected'
                            ? 'Rejected — click to undo'
                            : 'Reject this span'
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (s.decision === 'rejected') onResetDecision(s.id);
                          else onReject(s.id);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          s.decision === 'rejected'
                            ? 'bg-[color:var(--color-ink)] text-[color:var(--color-bg)] hover:bg-[#2a2a2a]'
                            : 'bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink-muted)] hover:bg-[#ECEAE3] hover:text-[color:var(--color-ink)]'
                        }`}
                      >
                        ×
                      </button>
                    </div>
                  </motion.div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
