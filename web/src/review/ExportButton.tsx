'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/ui/Button';
import { useSettings } from '@/src/store/settings-store';
import { useSessions } from '@/src/store/session-store';
import { exportDocument, triggerDownload } from '@/src/export/exporter';
import type { DocumentSession } from '@/src/store/document-store';

export function ExportButton({
  doc,
  archived = false,
}: {
  doc: DocumentSession;
  archived?: boolean;
}) {
  const settings = useSettings();
  const markExported = useSessions((s) => s.markExported);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Archived sessions act as if approved for export purposes — the user is
  // re-exporting an immutable history record.
  const canExport = archived || doc.approvedAt !== null;
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
      // If we have mappings (sandbox mode), bundle PDF + mappings.json into
      // a single ZIP. Two simultaneous downloads trigger Chrome's "allow
      // multiple downloads?" prompt, which silently blocks subsequent clicks.
      if (result.mappings) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        zip.file(`${baseName}${suffix}`, result.bytes);
        zip.file(`${baseName}.mappings.json`, JSON.stringify(result.mappings, null, 2));
        const zipBytes = await zip.generateAsync({ type: 'uint8array' });
        triggerDownload(zipBytes, `${baseName}.zip`, 'application/zip');
      } else {
        triggerDownload(result.bytes, `${baseName}${suffix}`);
      }
      setToast(
        result.warning
          ? `Exported with warning: ${result.warning}`
          : `Exported ${result.spanCount} redaction${result.spanCount === 1 ? '' : 's'} to your Downloads.`,
      );
      setTimeout(() => setToast(null), 4000);
      // Mark this session as exported so it shows up archived in history.
      markExported(doc.sessionId).catch((e) => console.warn('[export] markExported failed:', e));
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
        disabled={exporting || !canExport || acceptedCount === 0}
        onClick={handleExport}
        title={
          !canExport
            ? 'Approve this document before exporting'
            : acceptedCount === 0
              ? 'Accept at least one span to export'
              : `Download ${acceptedCount} redaction${acceptedCount === 1 ? '' : 's'} as PDF`
        }
      >
        {exporting
          ? 'Exporting…'
          : !canExport
            ? 'Approve to export'
            : archived
              ? 'Re-download PDF'
              : 'Download PDF'}
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
