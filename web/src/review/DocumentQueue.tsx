'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useDocuments, type DocumentSession } from '@/src/store/document-store';

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
  const router = useRouter();
  const removeDoc = useDocuments((s) => s.remove);

  if (documents.length <= 1) return null;

  const handleRemove = (id: string) => {
    const next = removeDoc(id);
    if (id === activeId) {
      if (next) router.push(`/review/${next}`);
      else router.push('/upload');
    }
  };

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
                className="group relative"
              >
                <Link
                  href={`/review/${d.id}`}
                  className={`block pl-4 pr-9 py-2.5 ${
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
                <button
                  type="button"
                  title="Remove from queue"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemove(d.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[color:var(--color-ink-subtle)] opacity-0 group-hover:opacity-100 hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-ink)] transition-opacity"
                >
                  <span className="text-[12px] leading-none">×</span>
                </button>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
