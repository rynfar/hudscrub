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

  let start = pageText.indexOf(text);
  let end = start >= 0 ? start + text.length : 0;

  // PDF.js text-layer spans are per-text-item; selection often clips mid-word.
  // If the captured selection ends inside a word, push the boundary outward
  // to the next non-word character so the user sees the full thing.
  if (start >= 0 && end > 0) {
    const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);
    while (start > 0 && isWord(pageText[start - 1]) && isWord(pageText[start])) {
      start--;
    }
    while (end < pageText.length && isWord(pageText[end - 1]) && isWord(pageText[end])) {
      end++;
    }
  }

  const finalText = start >= 0 ? pageText.slice(start, end) : text;

  return {
    id: crypto.randomUUID(),
    source: 'manual',
    label: 'CUSTOM',
    text: finalText,
    start: start >= 0 ? start : 0,
    end: start >= 0 ? end : 0,
    bbox: { x: pdfX, y: pdfY, width: pdfW, height: pdfH, pageNum },
    confidence: 1.0,
    decision: 'accepted',
  };
}
