'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppHeader } from '@/src/ui/AppHeader';
import { useDocuments } from '@/src/store/document-store';
import { useSettings, MODELS } from '@/src/store/settings-store';
import {
  startProcessing,
  useProcessingStatus,
  cancelProcessing,
  resetProcessing,
} from '@/src/processing/runner';

export default function ProcessingPage() {
  const router = useRouter();
  const documentsMap = useDocuments((s) => s.documents);
  const removeDoc = useDocuments((s) => s.remove);
  const selectedModel = useSettings((s) => s.selectedModel);
  const meta = MODELS.find((m) => m.id === selectedModel);
  const status = useProcessingStatus();
  const [autoOpened, setAutoOpened] = useState(false);
  const startedRef = useRef(false);

  // Snapshot once: docs that need processing right now
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const all = Object.values(documentsMap).sort((a, b) => a.createdAt - b.createdAt);
    const needsProcessing = all.filter(
      (d) => d.status === 'uploading' || d.status === 'detecting',
    );
    if (needsProcessing.length === 0) {
      if (all.length > 0) router.replace(`/review/${all[0].id}`);
      else router.replace('/upload');
      return;
    }
    startProcessing(needsProcessing.map((d) => d.id), selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait for ALL docs to finish processing, then route to the first one.
  // The user explicitly preferred a fully-blocked processing screen over
  // a "review one while others process" flow.
  useEffect(() => {
    if (autoOpened) return;
    if (
      !status.isRunning &&
      status.progress?.phase === 'done' &&
      status.completedDocIds.length > 0
    ) {
      setAutoOpened(true);
      router.replace(`/review/${status.completedDocIds[0]}`);
    }
  }, [status.isRunning, status.progress, status.completedDocIds, autoOpened, router]);

  const phaseLabel: Record<string, string> = {
    'loading-pdf': 'Reading PDF',
    'loading-model':
      status.progress && status.progress.modelLoadProgress < 1
        ? 'Downloading model'
        : 'Loading model',
    detecting: 'Analyzing',
    done: 'Ready',
  };

  const overallProgress = (() => {
    const p = status.progress;
    if (!p || p.docCount === 0) return 0;
    const docFraction = p.docIndex / p.docCount;
    let withinDoc = 0;
    if (p.phase === 'detecting' && p.pageCount > 0) {
      withinDoc = p.pageIndex / p.pageCount;
    } else if (p.phase === 'loading-model') {
      withinDoc = 0.05 + 0.1 * p.modelLoadProgress;
    } else if (p.phase === 'loading-pdf') {
      withinDoc = 0.02;
    }
    return Math.min(1, docFraction + withinDoc / p.docCount);
  })();

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full space-y-8">
          <div className="space-y-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
              Processing
            </p>
            <h2 className="text-2xl tracking-tight font-medium">Detecting PII</h2>
            <p className="text-sm text-[color:var(--color-ink-muted)] leading-relaxed">
              Using {meta?.name.split('—')[0].trim() ?? selectedModel}. Everything runs on
              your device.
            </p>
          </div>

          {status.error && (
            <div className="rounded-lg border border-[#A8341B33] bg-[#A8341B0a] p-4 text-sm text-[#A8341B]">
              {status.error}
            </div>
          )}

          {status.progress && (
            <div className="space-y-3">
              <div className="h-1 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[color:var(--color-accent)]"
                  animate={{ width: `${Math.round(overallProgress * 100)}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[color:var(--color-ink-muted)]">
                  {phaseLabel[status.progress.phase] ?? status.progress.phase}
                  {status.progress.phase === 'detecting' &&
                    status.progress.pageCount > 0 &&
                    ` · page ${status.progress.pageIndex} / ${status.progress.pageCount}`}
                  {status.progress.phase === 'loading-model' &&
                    status.progress.modelLoadProgress > 0 &&
                    status.progress.modelLoadProgress < 1 &&
                    ` · ${Math.round(status.progress.modelLoadProgress * 100)}%`}
                </span>
                <span className="text-[color:var(--color-ink-subtle)]">
                  {status.progress.docCount > 1 &&
                    `doc ${status.progress.docIndex + 1} / ${status.progress.docCount}`}
                </span>
              </div>

              {status.progress.docFilename && (
                <p className="text-xs text-[color:var(--color-ink-subtle)] truncate">
                  {status.progress.docFilename}
                </p>
              )}

              {status.progress.docCount > 1 && (
                <p className="text-xs text-[color:var(--color-ink-subtle)] text-center pt-2">
                  You&apos;ll be taken to review when all {status.progress.docCount} documents
                  are ready.
                </p>
              )}

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    cancelProcessing();
                    // Drop any docs that were in the queue but never completed.
                    // Otherwise they'd reappear on the next upload as "uploading"
                    // and processing would re-pick them up.
                    for (const d of Object.values(documentsMap)) {
                      if (d.status === 'uploading' || d.status === 'detecting') {
                        removeDoc(d.id);
                      }
                    }
                    resetProcessing();
                    router.replace('/upload');
                  }}
                  className="text-xs text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
