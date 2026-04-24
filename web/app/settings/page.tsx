'use client';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/src/ui/AppHeader';
import { ModelPicker } from '@/src/onboarding/ModelPicker';
import { Surface } from '@/src/ui/Surface';
import { useSettings } from '@/src/store/settings-store';

export default function SettingsPage() {
  const settings = useSettings();
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  useEffect(
    () => setWebGpuAvailable(typeof navigator !== 'undefined' && 'gpu' in navigator),
    [],
  );

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            Settings
          </p>
          <h2 className="text-2xl tracking-tight font-medium">Preferences</h2>
        </div>

        <Surface inset>
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono">
              Mode
            </h3>
            <div className="flex gap-2">
              {(['redact', 'sandbox'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => settings.set({ mode: m })}
                  className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                    settings.mode === m
                      ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-ink)]'
                      : 'border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink)]'
                  }`}
                >
                  {m === 'redact' ? 'Redact (black box)' : 'Sandbox (fake replacements)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-[color:var(--color-ink-muted)]">
              {settings.mode === 'redact'
                ? 'PII is permanently removed from the PDF content stream.'
                : 'PII is replaced with deterministic fake values (visible as overlay annotations).'}
            </p>
          </div>
        </Surface>

        <Surface inset>
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono">
              Detection model
            </h3>
            <ModelPicker
              selected={settings.selectedModel}
              onSelect={(id) => settings.set({ selectedModel: id })}
              webGpuAvailable={webGpuAvailable}
            />
          </div>
        </Surface>

        <Surface inset>
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono">
              Reset
            </h3>
            <p className="text-sm text-[color:var(--color-ink-muted)]">
              Wipe all locally stored settings and name lists. Documents in memory are not affected.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset all settings to defaults?')) settings.reset();
              }}
              className="text-sm text-[#A8341B] hover:underline self-start"
            >
              Reset to defaults
            </button>
          </div>
        </Surface>
      </main>
    </>
  );
}
