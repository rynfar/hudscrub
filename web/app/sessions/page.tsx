'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppHeader } from '@/src/ui/AppHeader';
import { useSessions } from '@/src/store/session-store';
import { useDocuments } from '@/src/store/document-store';
import { cancelProcessing, resetProcessing } from '@/src/processing/runner';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SessionsPage() {
  const router = useRouter();
  const sessions = useSessions((s) => s.sessions);
  const hydrated = useSessions((s) => s.hydrated);
  const hydrate = useSessions((s) => s.hydrate);
  const setActive = useSessions((s) => s.setActive);
  const loadSessionDocs = useSessions((s) => s.loadSessionDocs);
  const removeSession = useSessions((s) => s.remove);
  const hydrateMany = useDocuments((s) => s.hydrateMany);
  const clearAll = useDocuments((s) => s.clearAll);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const handleOpen = async (sessionId: string) => {
    setOpening(sessionId);
    try {
      cancelProcessing();
      resetProcessing();
      clearAll();
      const docs = await loadSessionDocs(sessionId);
      if (docs.length === 0) {
        setOpening(null);
        return;
      }
      hydrateMany(docs);
      setActive(sessionId);
      router.push(`/review/${docs[0].id}`);
    } catch (e) {
      console.error('[sessions] open failed', e);
      setOpening(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    await removeSession(sessionId);
  };

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
              History
            </p>
            <h2 className="text-2xl tracking-tight font-medium">Past sessions</h2>
            <p className="text-sm text-[color:var(--color-ink-muted)] leading-relaxed">
              Sessions are kept on this device for 30 days, then automatically removed.
            </p>
          </div>

          {!hydrated && (
            <p className="text-sm text-[color:var(--color-ink-muted)]">Loading…</p>
          )}

          {hydrated && sessions.length === 0 && (
            <div className="border border-dashed border-[color:var(--color-border)] rounded-lg px-8 py-12 text-center space-y-3">
              <p className="text-sm text-[color:var(--color-ink-muted)]">
                No sessions yet.
              </p>
              <Link
                href="/upload"
                className="text-xs text-[color:var(--color-accent)] underline"
              >
                Upload a document to start
              </Link>
            </div>
          )}

          {hydrated && sessions.length > 0 && (
            <ul className="divide-y divide-[color:var(--color-border)] border-t border-b border-[color:var(--color-border)]">
              {sessions.map((s) => {
                const isExported = s.status === 'exported';
                return (
                  <li key={s.id}>
                    <motion.div
                      whileHover={{ backgroundColor: 'rgba(26, 26, 26, 0.02)' }}
                      transition={{ duration: 0.12 }}
                      className="group relative flex items-center justify-between gap-4 px-4 py-4"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpen(s.id)}
                        disabled={opening !== null}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-[color:var(--color-ink)] truncate">
                            {s.label}
                          </p>
                          {isExported ? (
                            <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#0F5F3D] bg-[rgba(15,95,61,0.1)] px-2 py-0.5 rounded shrink-0">
                              ✓ exported
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--color-ink-subtle)] bg-[color:var(--color-surface-muted)] px-2 py-0.5 rounded shrink-0">
                              reviewing
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-[color:var(--color-ink-subtle)] font-mono">
                          <span>{s.docIds.length} doc{s.docIds.length === 1 ? '' : 's'}</span>
                          <span>·</span>
                          <span>{formatDate(s.createdAt)}</span>
                          {isExported && s.exportedAt && (
                            <>
                              <span>·</span>
                              <span>exported {formatDate(s.exportedAt)}</span>
                            </>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpen(s.id)}
                          disabled={opening !== null}
                          className="text-xs px-3 py-1.5 rounded text-[color:var(--color-accent)] hover:bg-[color:var(--color-surface-muted)] transition-colors disabled:opacity-50"
                        >
                          {opening === s.id ? 'Opening…' : 'Open'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          disabled={opening !== null}
                          title="Delete session"
                          className="text-xs px-2 py-1.5 rounded text-[color:var(--color-ink-subtle)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    </motion.div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
