'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/src/ui/Button';
import { AppHeader } from '@/src/ui/AppHeader';
import { useSettings, MODELS } from '@/src/store/settings-store';
import { useSessions } from '@/src/store/session-store';
import type { SessionRow } from '@/src/storage/db';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < hr) return `${Math.max(1, Math.round(diff / min))}m ago`;
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RecentSessionRow({ session }: { session: SessionRow }) {
  const isExported = session.status === 'exported';
  return (
    <Link
      href="/sessions"
      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[color:var(--color-surface-muted)] transition-colors rounded-md"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {isExported && <span className="text-xs text-[#0F5F3D] shrink-0">✓</span>}
          <p className="text-sm text-[color:var(--color-ink)] truncate">{session.label}</p>
        </div>
        <p className="text-[11px] font-mono text-[color:var(--color-ink-subtle)] mt-0.5">
          {session.docIds.length} doc{session.docIds.length === 1 ? '' : 's'} ·{' '}
          {isExported ? 'exported' : 'reviewing'} · {formatRelative(session.createdAt)}
        </p>
      </div>
      <span className="text-xs text-[color:var(--color-accent)] shrink-0">Open →</span>
    </Link>
  );
}

export default function Home() {
  // Read settings + sessions on the client only — Zustand persist isn't
  // hydrated during SSR.
  const hasOnboarded = useSettings((s) => s.hasCompletedOnboarding);
  const selectedModel = useSettings((s) => s.selectedModel);
  const installedModels = useSettings((s) => s.installedModels);
  const mode = useSettings((s) => s.mode);
  const setSettings = useSettings((s) => s.set);
  const sessions = useSessions((s) => s.sessions);
  const sessionsHydrated = useSessions((s) => s.hydrated);
  const meta = MODELS.find((m) => m.id === selectedModel);
  const isInstalled =
    installedModels.includes(selectedModel) || selectedModel === 'regex-only';

  // Avoid hydration mismatch by waiting for client mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showReturning = mounted && sessionsHydrated && sessions.length > 0;
  const recentSessions = sessions.slice(0, 3);
  const startHref = hasOnboarded ? '/upload' : '/onboarding';

  return (
    <>
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {/* Hero */}
        <section className="text-center space-y-4 mb-14">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            On-device PII redaction
          </p>
          <h1 className="text-3xl md:text-5xl tracking-tight text-[color:var(--color-ink)] font-medium leading-[1.1]">
            Review and redact HUD-1 closing documents
            <span className="text-[color:var(--color-ink-subtle)]">
              {' '}without uploading them.
            </span>
          </h1>
          <p className="text-base text-[color:var(--color-ink-muted)] leading-relaxed max-w-xl mx-auto">
            Detection runs on your device. Your PDFs never leave your browser.
          </p>
        </section>

        {/* Returning user view: recent sessions + quick actions */}
        {showReturning ? (
          <section className="space-y-6 mb-14">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
                  Recent sessions
                </p>
                <h2 className="text-lg font-medium text-[color:var(--color-ink)] mt-1">
                  Pick up where you left off
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/sessions">
                  <Button variant="ghost" size="sm">
                    View all ({sessions.length})
                  </Button>
                </Link>
                <Link href={startHref}>
                  <Button variant="primary" size="sm">
                    New upload
                  </Button>
                </Link>
              </div>
            </div>
            <div className="border border-[color:var(--color-border)] rounded-lg p-1.5">
              {recentSessions.map((s) => (
                <RecentSessionRow key={s.id} session={s} />
              ))}
            </div>
          </section>
        ) : (
          /* First-time view: clear CTA */
          <section className="text-center space-y-4 mb-14">
            <Link href={startHref}>
              <Button variant="primary" size="lg">
                Upload a document
              </Button>
            </Link>
            <p className="text-xs text-[color:var(--color-ink-subtle)]">
              Setup takes about two minutes
            </p>
          </section>
        )}

        {/* Output mode toggle */}
        <section className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono mb-3">
            Output mode
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSettings({ mode: 'sandbox' })}
              className={`text-left p-4 rounded-lg border transition-colors ${
                mode === 'sandbox'
                  ? 'border-[color:var(--color-ink)] bg-[color:var(--color-surface)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-bg)] hover:bg-[color:var(--color-surface)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-medium text-[color:var(--color-ink)]">
                  Sandbox
                </h3>
                {mode === 'sandbox' && (
                  <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#0F5F3D] bg-[rgba(15,95,61,0.1)] px-2 py-0.5 rounded">
                    selected
                  </span>
                )}
              </div>
              <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed">
                Replace PII with realistic fake values (same name → same fake).
                Best for sharing test data or debugging.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSettings({ mode: 'redact' })}
              className={`text-left p-4 rounded-lg border transition-colors ${
                mode === 'redact'
                  ? 'border-[color:var(--color-ink)] bg-[color:var(--color-surface)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-bg)] hover:bg-[color:var(--color-surface)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-medium text-[color:var(--color-ink)]">
                  Redact
                </h3>
                {mode === 'redact' && (
                  <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#0F5F3D] bg-[rgba(15,95,61,0.1)] px-2 py-0.5 rounded">
                    selected
                  </span>
                )}
              </div>
              <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed">
                Black out PII so it can&apos;t be recovered from the PDF.
                Best for sending finalized documents to third parties.
              </p>
            </button>
          </div>
        </section>

        {/* Active model status */}
        <section className="mb-14">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono shrink-0">
                Detection model
              </p>
              <p className="text-sm text-[color:var(--color-ink)] truncate">
                {meta?.name ?? selectedModel}
              </p>
              {isInstalled ? (
                <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#0F5F3D] bg-[rgba(15,95,61,0.1)] px-2 py-0.5 rounded shrink-0">
                  installed
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#8B5A14] bg-[rgba(139,90,20,0.1)] px-2 py-0.5 rounded shrink-0">
                  not installed
                </span>
              )}
            </div>
            <Link
              href="/settings"
              className="text-xs text-[color:var(--color-accent)] hover:underline shrink-0"
            >
              Change
            </Link>
          </div>
          {!isInstalled && (
            <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed mt-2 px-1">
              Detection will run with regex-only patterns until you install the
              selected model from{' '}
              <Link href="/settings" className="text-[color:var(--color-accent)] underline">
                Settings
              </Link>
              . Models download once and run locally afterwards.
            </p>
          )}
        </section>

        {/* How it works */}
        <section className="mb-14">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono mb-4">
            How it works
          </p>
          <ol className="grid md:grid-cols-3 gap-4">
            <li className="space-y-2 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-bg)] text-[11px] font-mono">
                1
              </span>
              <h3 className="text-sm font-medium text-[color:var(--color-ink)]">
                Upload your HUD-1
              </h3>
              <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed">
                Drop one or more PDFs. Each upload starts a new session that
                stays in your history for 30 days.
              </p>
            </li>
            <li className="space-y-2 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-bg)] text-[11px] font-mono">
                2
              </span>
              <h3 className="text-sm font-medium text-[color:var(--color-ink)]">
                Review &amp; refine
              </h3>
              <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed">
                Detection runs on-device. Accept, reject, or add redactions.
                Approve each document when you&apos;re satisfied.
              </p>
            </li>
            <li className="space-y-2 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-bg)] text-[11px] font-mono">
                3
              </span>
              <h3 className="text-sm font-medium text-[color:var(--color-ink)]">
                Export &amp; archive
              </h3>
              <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed">
                Download the redacted PDF (or sandboxed version with fake
                replacements). Sessions stay archived in History.
              </p>
            </li>
          </ol>
        </section>

        {/* Trust panel */}
        <section className="rounded-lg bg-[color:var(--color-surface-muted)] p-5 md:p-6 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            Privacy
          </p>
          <h3 className="text-sm font-medium text-[color:var(--color-ink)]">
            Your documents stay on your device
          </h3>
          <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed max-w-2xl">
            PDFs are never uploaded to a server. PII detection runs in your
            browser using a model that downloads once. Past sessions are kept
            in your browser&apos;s local storage and pruned automatically after
            30 days.
          </p>
        </section>
      </main>
    </>
  );
}
