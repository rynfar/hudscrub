'use client';
import { useEffect } from 'react';
import type { Span } from '@/src/types';

interface Props {
  /** Page text (used to find the selection's char offsets). */
  pageText: string;
  pageNum: number;
  /** Width/height of the rendered canvas in CSS pixels (at scale 1.5). */
  pageWidth: number;
  pageHeight: number;
  onAdd: (span: Span) => void;
}

const SCALE = 1.5;

export function ManualSelect({ pageText, pageNum, pageWidth, pageHeight, onAdd }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 2) return;

      // Find the canvas to map selection rect → page-relative coords
      const range = selection!.getRangeAt(0);
      const selRect = range.getBoundingClientRect();
      // Find the closest .pdf-page container by walking up from the anchor node
      let node: Node | null = range.commonAncestorContainer;
      let pageEl: HTMLElement | null = null;
      while (node) {
        if (node instanceof HTMLElement && node.dataset.pdfPage === String(pageNum)) {
          pageEl = node;
          break;
        }
        node = node.parentNode;
      }
      if (!pageEl) return;
      const pageRect = pageEl.getBoundingClientRect();
      // Selection in page-relative CSS pixels
      const cssX = selRect.left - pageRect.left;
      const cssY = selRect.top - pageRect.top;
      const cssW = selRect.width;
      const cssH = selRect.height;
      // Convert to PDF user-space (SpanOverlay scales pdfX × (pageWidth/pdfWidth) back to CSS)
      const pdfX = cssX / SCALE;
      const pdfY = cssY / SCALE;
      const pdfW = cssW / SCALE;
      const pdfH = cssH / SCALE;

      // Compute char offsets — best-effort indexOf on the page text
      const start = pageText.indexOf(text);
      const end = start >= 0 ? start + text.length : 0;

      e.preventDefault();
      onAdd({
        id: crypto.randomUUID(),
        source: 'manual',
        label: 'CUSTOM',
        text,
        start: start >= 0 ? start : 0,
        end,
        bbox: { x: pdfX, y: pdfY, width: pdfW, height: pdfH, pageNum },
        confidence: 1.0,
        decision: 'accepted',
      });
      selection?.removeAllRanges();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageText, pageNum, pageWidth, pageHeight]);

  return null;
}
