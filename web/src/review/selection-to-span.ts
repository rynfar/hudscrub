'use client';
import type { Span } from '@/src/types';

const SCALE = 1.5;

/**
 * Convert the current window selection (must be inside a [data-pdf-page="N"]
 * container) into a manual Span. Returns null if no valid selection.
 */
export function selectionToSpan(pageNum: number, pageText: string): Span | null {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || text.length < 2 || !selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const selRect = range.getBoundingClientRect();
  let node: Node | null = range.commonAncestorContainer;
  let pageEl: HTMLElement | null = null;
  while (node) {
    if (node instanceof HTMLElement && node.dataset.pdfPage === String(pageNum)) {
      pageEl = node;
      break;
    }
    node = node.parentNode;
  }
  if (!pageEl) return null;
  const pageRect = pageEl.getBoundingClientRect();
  const cssX = selRect.left - pageRect.left;
  const cssY = selRect.top - pageRect.top;
  const cssW = selRect.width;
  const cssH = selRect.height;
  const pdfX = cssX / SCALE;
  const pdfY = cssY / SCALE;
  const pdfW = cssW / SCALE;
  const pdfH = cssH / SCALE;

  const start = pageText.indexOf(text);
  const end = start >= 0 ? start + text.length : 0;

  return {
    id: crypto.randomUUID(),
    source: 'manual',
    label: 'CUSTOM',
    text,
    start: start >= 0 ? start : 0,
    end,
    bbox: { x: pdfX, y: pdfY, width: pdfW, height: pdfH, pageNum },
    confidence: 1.0,
    decision: 'accepted',
  };
}
