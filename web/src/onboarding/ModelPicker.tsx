'use client';
import { motion } from 'framer-motion';
import { MODELS, type ModelId } from '@/src/store/settings-store';
import { PillBadge } from '@/src/ui/PillBadge';

interface Props {
  selected: ModelId;
  onSelect: (id: ModelId) => void;
  webGpuAvailable: boolean;
}

export function ModelPicker({ selected, onSelect, webGpuAvailable }: Props) {
  return (
    <div className="space-y-2">
      {MODELS.map((m) => {
        const disabled = m.requiresWebGPU && !webGpuAvailable;
        const isSelected = selected === m.id;
        return (
          <motion.button
            type="button"
            key={m.id}
            disabled={disabled}
            onClick={() => onSelect(m.id)}
            whileHover={!disabled ? { scale: 1.005 } : {}}
            transition={{ type: 'spring', stiffness: 600, damping: 36 }}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              isSelected
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-border-strong)]'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-sm font-medium text-[color:var(--color-ink)]">{m.name}</p>
                <p className="text-xs text-[color:var(--color-ink-muted)]">{m.description}</p>
                {disabled && (
                  <p className="text-[11px] text-[color:var(--color-ink-subtle)] mt-1">
                    Requires WebGPU (not available in this browser)
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <PillBadge tone="neutral" monospace>
                  {m.sizeLabel}
                </PillBadge>
                <PillBadge tone="neutral" monospace>
                  {m.speedLabel}
                </PillBadge>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
