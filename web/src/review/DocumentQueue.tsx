'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { DocumentSession } from '@/src/store/document-store';

interface Props {
  documents: DocumentSession[];
  activeId: string;
}

const statusLabel = (s: DocumentSession): string => {
  if (s.status === 'detecting') return 'detecting';
  if (s.status === 'reviewing') {
    const total = s.pages.reduce((n, p) => n + p.spans.length, 0);
    const done = s.pages.reduce(
      (n, p) => n + p.spans.filter((sp) => sp.decision !== 'pending').length,
      0,
    );
    if (total === 0) return 'no spans';
    if (done === total) return 'review complete';
    return `${total - done} pending`;
  }
  if (s.status === 'exported') return 'exported';
  return s.status;
};

export function DocumentQueue({ documents, activeId }: Props) {
  if (documents.length <= 1) return null;
  return (
    <aside className="w-56 shrink-0 border-r border-[color:var(--color-border)] bg-[color:var(--color-bg)] overflow-y-auto">
      <div className="px-4 py-4 border-b border-[color:var(--color-border)]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono">
          Queue · {documents.length}
        </p>
      </div>
      <ul className="py-2">
        {documents.map((d) => {
          const isActive = d.id === activeId;
          return (
            <li key={d.id}>
              <motion.div
                whileHover={{ backgroundColor: 'rgba(26, 26, 26, 0.03)' }}
                transition={{ duration: 0.12 }}
              >
                <Link
                  href={`/review/${d.id}`}
                  className={`block px-4 py-2.5 ${
                    isActive ? 'bg-[color:var(--color-surface-muted)]' : ''
                  }`}
                >
                  <p className="text-xs font-mono truncate text-[color:var(--color-ink)]">
                    {d.filename}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-ink-subtle)] font-mono mt-0.5">
                    {statusLabel(d)}
                  </p>
                </Link>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
