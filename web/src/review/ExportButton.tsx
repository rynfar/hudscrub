'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/ui/Button';
import { useSettings } from '@/src/store/settings-store';
import { exportDocument, triggerDownload, triggerJsonDownload } from '@/src/export/exporter';
import type { DocumentSession } from '@/src/store/document-store';

export function ExportButton({ doc }: { doc: DocumentSession }) {
  const settings = useSettings();
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allDecided = doc.pages.every((p) => p.spans.every((s) => s.decision !== 'pending'));
  const acceptedCount = doc.pages.reduce(
    (sum, p) => sum + p.spans.filter((s) => s.decision === 'accepted').length,
    0,
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportDocument(doc, settings.mode, settings.sandboxSeed);
      const baseName = doc.filename.replace(/\.pdf$/, '');
      const suffix = settings.mode === 'redact' ? '.redacted.pdf' : '.sandboxed.pdf';
      triggerDownload(result.bytes, `${baseName}${suffix}`);
      if (result.mappings) {
        triggerJsonDownload(result.mappings, `${baseName}.mappings.json`);
      }
      setToast(
        result.warning
          ? `Exported with warning: ${result.warning}`
          : `Exported ${result.spanCount} redactions to your Downloads.`,
      );
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      console.error(e);
      setToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setToast(null), 6000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={exporting || !allDecided || acceptedCount === 0}
        onClick={handleExport}
        title={
          !allDecided
            ? 'Decide on every span before exporting'
            : acceptedCount === 0
              ? 'Accept at least one span to export'
              : undefined
        }
      >
        {exporting ? 'Exporting…' : !allDecided ? 'Review remaining first' : `Export (${acceptedCount})`}
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
