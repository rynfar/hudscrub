'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppHeader() {
  const pathname = usePathname();
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
          <Link
            href="/settings"
            className={`px-3 py-1.5 rounded text-xs ${
              pathname === '/settings'
                ? 'text-[color:var(--color-ink)] bg-[color:var(--color-surface-muted)]'
                : 'text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]'
            }`}
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
