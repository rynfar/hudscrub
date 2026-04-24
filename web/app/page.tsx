'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/src/ui/AppHeader';
import { Button } from '@/src/ui/Button';
import { useSettings } from '@/src/store/settings-store';

export default function Home() {
  const [destination, setDestination] = useState('/upload');
  // Read settings on the client only — Zustand persist isn't hydrated during SSR.
  const hasOnboarded = useSettings((s) => s.hasCompletedOnboarding);
  useEffect(() => {
    setDestination(hasOnboarded ? '/upload' : '/onboarding');
  }, [hasOnboarded]);

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-10">
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
              On-device PII redaction
            </p>
            <h1 className="text-4xl md:text-5xl tracking-tight text-[color:var(--color-ink)] font-medium leading-[1.1]">
              Review and redact HUD-1 closing documents
              <span className="text-[color:var(--color-ink-subtle)]">
                {' '}
                without uploading them.
              </span>
            </h1>
            <p className="text-base text-[color:var(--color-ink-muted)] leading-relaxed max-w-md mx-auto">
              Detection runs on your device. Your PDFs never leave your browser.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Link href={destination}>
              <Button variant="primary" size="lg">
                Get started
              </Button>
            </Link>
            <p className="text-xs text-[color:var(--color-ink-subtle)]">
              Setup takes about two minutes
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
