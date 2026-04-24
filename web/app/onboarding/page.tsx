'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { Button } from '@/src/ui/Button';
import { ModelPicker } from '@/src/onboarding/ModelPicker';
import { useSettings, type ModelId } from '@/src/store/settings-store';

export default function OnboardingPage() {
  const router = useRouter();
  const settings = useSettings();
  const [selected, setSelected] = useState<ModelId>(settings.selectedModel);
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);

  useEffect(() => {
    setWebGpuAvailable(typeof navigator !== 'undefined' && 'gpu' in navigator);
  }, []);

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
            The model runs entirely on your device. You can change this later in Settings.
          </p>
        </div>

        <ModelPicker
          selected={selected}
          onSelect={setSelected}
          webGpuAvailable={webGpuAvailable}
        />

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={() => router.push('/upload')}>
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              settings.set({ selectedModel: selected, hasCompletedOnboarding: true });
              router.push('/upload');
            }}
          >
            Continue
          </Button>
        </div>
      </main>
    </>
  );
}
