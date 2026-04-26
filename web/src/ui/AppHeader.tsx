'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDocuments } from '@/src/store/document-store';
import { useSessions } from '@/src/store/session-store';

export function AppHeader() {
  const pathname = usePathname();
  const hasDocs = useDocuments((s) => Object.keys(s.documents).length > 0);
  const sessionCount = useSessions((s) => s.sessions.length);
  // Show "New upload" once the user has docs in their session — gives them
  // an obvious way to start over without using the browser back button.
  const showNewUpload = hasDocs && pathname !== '/upload' && pathname !== '/processing';
  const showHistory = sessionCount > 0;

  const navItemClass = (active: boolean) =>
    `px-3 py-1.5 rounded text-xs ${
      active
        ? 'text-[color:var(--color-ink)] bg-[color:var(--color-surface-muted)]'
        : 'text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]'
    }`;

  return (
    <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="max-w-[1280px] mx-auto h-12 px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-medium tracking-tight text-[color:var(--color-ink)]">
            hudscrub
          </span>
          <span className="text-[10px] font-mono text-[color:var(--color-ink-subtle)] hidden sm:inline">
            v0.1
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {showNewUpload && (
            <Link href="/upload" className={navItemClass(false)}>
              New upload
            </Link>
          )}
          {showHistory && (
            <Link href="/sessions" className={navItemClass(pathname === '/sessions')}>
              History
            </Link>
          )}
          <Link href="/settings" className={navItemClass(pathname === '/settings')}>
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
