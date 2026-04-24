'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AppHeader } from '@/src/ui/AppHeader';
import { Button } from '@/src/ui/Button';
import { ModelPicker } from '@/src/onboarding/ModelPicker';
import { installModel, type InstallProgress } from '@/src/onboarding/install-model';
import { useSettings, type ModelId, MODELS } from '@/src/store/settings-store';

export default function OnboardingPage() {
  const router = useRouter();
  const settings = useSettings();
  const [selected, setSelected] = useState<ModelId>(settings.selectedModel);
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWebGpuAvailable(typeof navigator !== 'undefined' && 'gpu' in navigator);
  }, []);

  const meta = MODELS.find((m) => m.id === selected)!;
  const alreadyInstalled = settings.installedModels.includes(selected) || selected === 'regex-only';

  const handleContinue = async () => {
    settings.set({ selectedModel: selected });
    if (alreadyInstalled) {
      settings.set({ hasCompletedOnboarding: true });
      router.push('/upload');
      return;
    }
    setDownloading(true);
    setError(null);
    setProgress({ status: 'downloading', progress: 0 });
    try {
      await installModel(selected, (p) => setProgress(p));
      settings.markInstalled(selected);
      settings.set({ hasCompletedOnboarding: true });
      // Brief moment to show the "Ready" state
      setTimeout(() => router.push('/upload'), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDownloading(false);
    }
  };

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            Setup · 1 of 1
          </p>
          <h2 className="text-2xl tracking-tight font-medium">Pick a detection model</h2>
          <p className="text-sm text-[color:var(--color-ink-muted)] leading-relaxed">
            The model runs entirely on your device — no PII ever leaves your browser. We&apos;ll
            download it now (one time, then cached). You can change this later in Settings.
          </p>
        </div>

        <ModelPicker
          selected={selected}
          onSelect={setSelected}
          webGpuAvailable={webGpuAvailable}
          allowInstall={false}
        />

        <AnimatePresence>
          {downloading && progress && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[color:var(--color-ink)]">
                  Downloading {meta.name}
                </p>
                <p className="text-[11px] font-mono text-[color:var(--color-ink-muted)]">
                  {Math.round(progress.progress * 100)}%
                </p>
              </div>
              <div className="h-1 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[color:var(--color-accent)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-[11px] font-mono text-[color:var(--color-ink-subtle)]">
                {progress.status === 'ready'
                  ? 'Ready — taking you to upload…'
                  : `${progress.status}${progress.message ? ` · ${progress.message}` : ''}`}
              </p>
              <p className="text-[11px] text-[color:var(--color-ink-subtle)]">
                Why is this needed? The model runs in your browser so nothing crosses the network.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-lg border border-[#A8341B33] bg-[#A8341B0a] p-4 text-sm text-[#A8341B]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={() => router.push('/upload')} disabled={downloading}>
            Skip
          </Button>
          <Button variant="primary" onClick={handleContinue} disabled={downloading}>
            {downloading
              ? 'Downloading…'
              : alreadyInstalled
                ? 'Continue'
                : meta.sizeLabel === '0 MB'
                  ? 'Continue'
                  : `Install ${meta.sizeLabel} & continue`}
          </Button>
        </div>
      </main>
    </>
  );
}
