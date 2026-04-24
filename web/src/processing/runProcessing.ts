'use client';
import { detectDocument, getDetectors } from '@/src/detection/browser-runner';
import { loadPdfInBrowser, type RenderedPage } from '@/src/pdf/browser-renderer';
import type { DocumentSession, PageState } from '@/src/store/document-store';
import type { ModelId } from '@/src/store/settings-store';

export interface ProcessingProgress {
  docIndex: number;
  docCount: number;
  docFilename: string;
  phase: 'loading-pdf' | 'loading-model' | 'detecting' | 'done';
  pageIndex: number;
  pageCount: number;
  modelLoadProgress: number; // 0-1, for the model download phase
}

export interface ProcessingHandlers {
  onPage: (docId: string, pageNum: number, page: PageState) => void;
  onProgress: (p: ProcessingProgress) => void;
  shouldCancel: () => boolean;
}

/**
 * Run detection across a batch of documents sequentially.
 * Reports phase + page progress via the onProgress callback. Each completed page
 * is committed to the store via onPage. Returns when all docs are done or cancelled.
 */
export async function runProcessing(
  docs: DocumentSession[],
  selectedModel: ModelId,
  handlers: ProcessingHandlers,
): Promise<void> {
  for (let i = 0; i < docs.length; i++) {
    if (handlers.shouldCancel()) return;
    const doc = docs[i];

    handlers.onProgress({
      docIndex: i,
      docCount: docs.length,
      docFilename: doc.filename,
      phase: 'loading-pdf',
      pageIndex: 0,
      pageCount: 0,
      modelLoadProgress: 0,
    });

    let pdfPages: RenderedPage[];
    try {
      const pdf = await loadPdfInBrowser(doc.fileBytes);
      pdfPages = [];
      for (let p = 0; p < pdf.numPages; p++) {
        if (handlers.shouldCancel()) return;
        pdfPages.push(await pdf.getPage(p));
      }
    } catch (e) {
      console.error(`[processing] failed to load PDF for ${doc.filename}:`, e);
      continue;
    }

    // Initialize page state in the store with text/dimensions but no spans yet
    pdfPages.forEach((p, idx) => {
      handlers.onPage(doc.id, idx, {
        pageNum: idx,
        text: p.text,
        width: p.width,
        height: p.height,
        spans: [],
        status: 'detecting',
      });
    });

    // Build detectors (model loads only on first doc, then reuses singleton)
    handlers.onProgress({
      docIndex: i,
      docCount: docs.length,
      docFilename: doc.filename,
      phase: 'loading-model',
      pageIndex: 0,
      pageCount: pdfPages.length,
      modelLoadProgress: 0,
    });
    const detectors = await getDetectors({
      selectedModel,
      onLoadProgress: (p) => {
        handlers.onProgress({
          docIndex: i,
          docCount: docs.length,
          docFilename: doc.filename,
          phase: 'loading-model',
          pageIndex: 0,
          pageCount: pdfPages.length,
          modelLoadProgress: p,
        });
      },
    });

    // Per-page detection
    let pageIdx = 0;
    await detectDocument(pdfPages, detectors, (pageNum, spans) => {
      if (handlers.shouldCancel()) return;
      handlers.onPage(doc.id, pageNum, {
        pageNum,
        text: pdfPages[pageNum].text,
        width: pdfPages[pageNum].width,
        height: pdfPages[pageNum].height,
        spans,
        status: 'ready',
      });
      pageIdx = pageNum + 1;
      handlers.onProgress({
        docIndex: i,
        docCount: docs.length,
        docFilename: doc.filename,
        phase: 'detecting',
        pageIndex: pageIdx,
        pageCount: pdfPages.length,
        modelLoadProgress: 1,
      });
    });
  }

  handlers.onProgress({
    docIndex: docs.length,
    docCount: docs.length,
    docFilename: '',
    phase: 'done',
    pageIndex: 0,
    pageCount: 0,
    modelLoadProgress: 1,
  });
}
