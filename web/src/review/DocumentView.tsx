'use client';
import { useState, useEffect, useRef } from 'react';
import { useDocuments, type DocumentSession } from '@/src/store/document-store';
import { useSettings, MODELS } from '@/src/store/settings-store';
import { loadPdfInBrowser, type RenderedPage } from '@/src/pdf/browser-renderer';
import { PdfPage } from './PdfPage';
import { SpanSidebar } from './SpanSidebar';
import { KeyboardLayer } from './KeyboardLayer';
import { ExportButton } from './ExportButton';
import { ExportAllButton } from './ExportAllButton';
import { ManualSelect } from './ManualSelect';
import { SelectionToolbar } from './SelectionToolbar';
import { selectionToSpan } from './selection-to-span';
import { DocumentQueue } from './DocumentQueue';
import { Kbd } from '@/src/ui/Kbd';
import { useProcessingStatus } from '@/src/processing/runner';
import { ProcessingBanner } from './ProcessingBanner';

interface Props {
  doc: DocumentSession;
}

export function DocumentView({ doc }: Props) {
  const selectedModel = useSettings((s) => s.selectedModel);
  const updateSpan = useDocuments((s) => s.updateSpan);
  const addSpan = useDocuments((s) => s.addSpan);
  const processingStatus = useProcessingStatus();
  void selectedModel;

  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [focusedSpanId, setFocusedSpanId] = useState<string | null>(null);
  const pdfScopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Detection has already happened in /processing. We just need to render
      // the PDF for visual display; the spans are already in the store.
      const pdf = await loadPdfInBrowser(doc.fileBytes);
      const out: RenderedPage[] = [];
      for (let i = 0; i < pdf.numPages; i++) out.push(await pdf.getPage(i));
      if (cancelled) return;
      setPages(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const pageState = doc.pages[currentPage];
  const spans = pageState?.spans ?? [];
  const renderedPage = pages[currentPage];

  const acceptSpan = (spanId: string) =>
    updateSpan(doc.id, currentPage, spanId, { decision: 'accepted' });
  const rejectSpan = (spanId: string) =>
    updateSpan(doc.id, currentPage, spanId, { decision: 'rejected' });
  const resetDecision = (spanId: string) =>
    updateSpan(doc.id, currentPage, spanId, { decision: 'pending' });
  const acceptAll = () => {
    for (const s of spans) {
      if (s.decision === 'pending') updateSpan(doc.id, currentPage, s.id, { decision: 'accepted' });
    }
  };

  const isProcessingThisDoc =
    processingStatus.isRunning && processingStatus.progress?.docFilename === doc.filename;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* ProcessingBanner kept in tree but no-op when not running — left in case
          we re-enable parallel review-while-processing later. */}
      <ProcessingBanner />
      {/* Document toolbar */}
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[color:var(--color-ink-muted)]">
            {doc.filename}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono">
            · {MODELS.find((m) => m.id === selectedModel)?.name.split('—')[0].trim() ?? selectedModel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ExportAllButton />
          <ExportButton doc={doc} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-[color:var(--color-surface-muted)]">
        <DocumentQueue documents={Object.values(useDocuments.getState().documents)} activeId={doc.id} />
        <div className="flex-1 overflow-auto py-8 px-6 relative" ref={pdfScopeRef}>
          {pages.length === 0 && (
            <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
              Loading PDF…
            </p>
          )}
          {renderedPage && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-[color:var(--color-ink-muted)]">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-2 py-1 rounded hover:bg-[color:var(--color-surface)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  ← prev
                </button>
                <span>
                  page {currentPage + 1} / {pages.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                  disabled={currentPage >= pages.length - 1}
                  className="px-2 py-1 rounded hover:bg-[color:var(--color-surface)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  next →
                </button>
              </div>
              <PdfPage
                page={renderedPage}
                spans={spans}
                focusedSpanId={focusedSpanId}
                detecting={isProcessingThisDoc && pageState?.status !== 'ready'}
                onSpanClick={setFocusedSpanId}
              />
            </div>
          )}
        </div>
        <SpanSidebar
          spans={spans}
          focusedSpanId={focusedSpanId}
          detecting={isProcessingThisDoc}
          onSelect={setFocusedSpanId}
          onAccept={acceptSpan}
          onReject={rejectSpan}
          onResetDecision={resetDecision}
        />
      </div>

      {/* Keyboard hint footer */}
      <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)] py-2 px-6 flex items-center gap-5 text-[11px] text-[color:var(--color-ink-subtle)]">
        <span className="flex items-center gap-1.5">
          <Kbd>Tab</Kbd> next
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> accept
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>⌫</Kbd> reject
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>A</Kbd> accept all on page
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>N</Kbd>/<Kbd>P</Kbd> page nav
        </span>
        <span className="flex items-center gap-1.5 text-[color:var(--color-ink-subtle)]">
          select text in the PDF and click <span className="font-medium text-[color:var(--color-ink-muted)]">Redact this</span>
        </span>
      </div>

      <KeyboardLayer
        spans={spans}
        focusedSpanId={focusedSpanId}
        onSetFocus={setFocusedSpanId}
        onAccept={acceptSpan}
        onReject={rejectSpan}
        onAcceptAll={acceptAll}
        onNextPage={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
        onPrevPage={() => setCurrentPage((p) => Math.max(0, p - 1))}
      />
      {renderedPage && pageState && (
        <>
          <ManualSelect
            pageText={pageState.text}
            pageNum={currentPage}
            onAdd={(span) => addSpan(doc.id, currentPage, span)}
          />
          <SelectionToolbar
            scopeRef={pdfScopeRef}
            onAddRedaction={() => {
              const span = selectionToSpan(currentPage, pageState.text);
              if (span) addSpan(doc.id, currentPage, span);
            }}
          />
        </>
      )}
    </div>
  );
}
