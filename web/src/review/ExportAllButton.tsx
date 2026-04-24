'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/ui/Button';
import { useSettings } from '@/src/store/settings-store';
import { useDocuments } from '@/src/store/document-store';
import { exportBatchAsZip, triggerDownload } from '@/src/export/exporter';

export function ExportAllButton() {
  const settings = useSettings();
  const documents = useDocuments((s) => s.documents);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allDocs = Object.values(documents).sort((a, b) => a.createdAt - b.createdAt);
  if (allDocs.length <= 1) return null;

  // Only docs with at least one accepted span are "ready"; others get warned about.
  const readyDocs = allDocs.filter((d) =>
    d.pages.some((p) => p.spans.some((s) => s.decision === 'accepted')),
  );

  const handleExportAll = async () => {
    if (allDocs.length === 0) return;
    setExporting(true);
    try {
      const result = await exportBatchAsZip(allDocs, settings.mode, settings.sandboxSeed);
      triggerDownload(result.bytes, result.filename, 'application/zip');
      setToast(
        result.warnings.length > 0
          ? `Exported ${allDocs.length} docs as ZIP, ${result.warnings.length} warning(s) — see console`
          : `Exported ${allDocs.length} docs as ZIP to your Downloads.`,
      );
      if (result.warnings.length > 0) console.warn('ZIP export warnings:', result.warnings);
      setTimeout(() => setToast(null), 4500);
    } catch (e) {
      console.error(e);
      setToast(`ZIP export failed: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setToast(null), 6000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={exporting || readyDocs.length === 0}
        onClick={handleExportAll}
        title={
          readyDocs.length === 0
            ? 'Accept at least one span in any document first'
            : `Bundle all ${allDocs.length} documents into one ZIP`
        }
      >
        {exporting ? 'Bundling…' : `Export all as ZIP (${allDocs.length})`}
      </Button>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-lg bg-[color:var(--color-ink)] text-[color:var(--color-bg)] text-sm shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
