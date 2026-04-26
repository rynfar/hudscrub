'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/ui/Button';
import { useSettings } from '@/src/store/settings-store';
import { useDocuments } from '@/src/store/document-store';
import { useSessions } from '@/src/store/session-store';
import { exportBatchAsZip, triggerDownload } from '@/src/export/exporter';

export function ExportAllButton() {
  const settings = useSettings();
  const documents = useDocuments((s) => s.documents);
  const activeSessionId = useSessions((s) => s.activeSessionId);
  const markExported = useSessions((s) => s.markExported);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Only docs from the active session — old hydrated sessions in the store
  // shouldn't get bundled together.
  const allDocs = Object.values(documents)
    .filter((d) => !activeSessionId || d.sessionId === activeSessionId)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (allDocs.length <= 1) return null;

  const pendingApproval = allDocs.filter((d) => d.approvedAt === null);
  const allApproved = pendingApproval.length === 0;

  const handleExportAll = async () => {
    if (allDocs.length === 0 || !allApproved) return;
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
      if (activeSessionId) {
        markExported(activeSessionId).catch((e) =>
          console.warn('[export] markExported failed:', e),
        );
      }
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
        disabled={exporting || !allApproved}
        onClick={handleExportAll}
        title={
          !allApproved
            ? `${pendingApproval.length} document(s) still need approval: ${pendingApproval
                .map((d) => d.filename)
                .join(', ')}`
            : `Bundle all ${allDocs.length} documents into one ZIP`
        }
      >
        {exporting
          ? 'Bundling…'
          : !allApproved
            ? `Approve all to export (${pendingApproval.length} pending)`
            : `Export all as ZIP (${allDocs.length})`}
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
