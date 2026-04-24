'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useProcessingStatus, cancelProcessing } from '@/src/processing/runner';

export function ProcessingBanner() {
  const status = useProcessingStatus();
  const visible = status.isRunning && status.progress && status.progress.phase !== 'done';
  return (
    <AnimatePresence>
      {visible && status.progress && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="border-b border-[color:var(--color-border)] bg-[color:var(--color-accent-soft)] px-6 py-2 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-accent)] font-mono shrink-0">
              processing
            </span>
            <span className="text-xs text-[color:var(--color-ink)] truncate">
              {status.progress.docFilename}
              {status.progress.phase === 'detecting' &&
                status.progress.pageCount > 0 &&
                ` · page ${status.progress.pageIndex} / ${status.progress.pageCount}`}
              {status.progress.phase === 'loading-model' &&
                status.progress.modelLoadProgress > 0 &&
                status.progress.modelLoadProgress < 1 &&
                ` · downloading model ${Math.round(status.progress.modelLoadProgress * 100)}%`}
              {status.progress.docCount > 1 &&
                ` · doc ${status.progress.docIndex + 1} / ${status.progress.docCount}`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-32 h-1 bg-[color:var(--color-bg)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[color:var(--color-accent)]"
                animate={{
                  width: `${(() => {
                    const p = status.progress;
                    if (!p || p.docCount === 0) return 0;
                    const docFraction = p.docIndex / p.docCount;
                    let withinDoc = 0;
                    if (p.phase === 'detecting' && p.pageCount > 0) {
                      withinDoc = p.pageIndex / p.pageCount;
                    }
                    return Math.round(Math.min(1, docFraction + withinDoc / p.docCount) * 100);
                  })()}%`,
                }}
                transition={{ duration: 0.25 }}
              />
            </div>
            <button
              type="button"
              onClick={() => cancelProcessing()}
              className="text-[11px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:underline"
            >
              cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
