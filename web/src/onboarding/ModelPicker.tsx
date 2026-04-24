'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODELS, type ModelId, useSettings } from '@/src/store/settings-store';
import { PillBadge } from '@/src/ui/PillBadge';
import { installModel, type InstallProgress } from './install-model';

interface Props {
  selected: ModelId;
  onSelect: (id: ModelId) => void;
  webGpuAvailable: boolean;
  /** Show inline install buttons on each card (used in Settings). Default true. */
  allowInstall?: boolean;
}

export function ModelPicker({ selected, onSelect, webGpuAvailable, allowInstall = true }: Props) {
  const installedModels = useSettings((s) => s.installedModels);
  const markInstalled = useSettings((s) => s.markInstalled);
  const [installing, setInstalling] = useState<ModelId | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInstall = async (id: ModelId) => {
    setInstalling(id);
    setProgress({ status: 'downloading', progress: 0 });
    setErrors((e) => ({ ...e, [id]: '' }));
    try {
      await installModel(id, (p) => setProgress(p));
      markInstalled(id);
      setTimeout(() => {
        setInstalling(null);
        setProgress(null);
      }, 600);
    } catch (e) {
      setErrors((es) => ({ ...es, [id]: e instanceof Error ? e.message : String(e) }));
      setInstalling(null);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-2">
      {MODELS.map((m) => {
        const disabled = m.requiresWebGPU && !webGpuAvailable;
        const isSelected = selected === m.id;
        const isInstalled = installedModels.includes(m.id) || m.id === 'regex-only';
        const isInstallingThis = installing === m.id;

        return (
          <motion.div
            role="radio"
            tabIndex={disabled ? -1 : 0}
            aria-checked={isSelected}
            aria-disabled={disabled}
            key={m.id}
            onClick={() => !disabled && onSelect(m.id)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(m.id);
              }
            }}
            whileHover={!disabled ? { scale: 1.005 } : {}}
            transition={{ type: 'spring', stiffness: 600, damping: 36 }}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              !disabled ? 'cursor-pointer' : ''
            } ${
              isSelected
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-border-strong)]'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[color:var(--color-ink)]">{m.name}</p>
                  {isInstalled && (
                    <PillBadge tone="regex">Installed</PillBadge>
                  )}
                </div>
                <p className="text-xs text-[color:var(--color-ink-muted)]">{m.description}</p>
                {disabled && (
                  <p className="text-[11px] text-[color:var(--color-ink-subtle)] mt-1">
                    Requires WebGPU (not available in this browser)
                  </p>
                )}
                {errors[m.id] && (
                  <p className="text-[11px] text-[#A8341B] mt-1">{errors[m.id]}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <PillBadge tone="neutral" monospace>
                    {m.sizeLabel}
                  </PillBadge>
                  <PillBadge tone="neutral" monospace>
                    {m.speedLabel}
                  </PillBadge>
                </div>
                {allowInstall && !isInstalled && !disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstall(m.id);
                    }}
                    disabled={isInstallingThis}
                    className="text-[11px] px-2.5 py-1 rounded border border-[color:var(--color-border-strong)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)] disabled:opacity-50 transition-colors font-medium"
                  >
                    {isInstallingThis ? 'Installing…' : 'Install'}
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {isInstallingThis && progress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <div className="h-1 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[color:var(--color-accent)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.progress * 100}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-[color:var(--color-ink-subtle)]">
                      {progress.status === 'ready'
                        ? 'Ready'
                        : `${progress.status} · ${Math.round(progress.progress * 100)}%`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
