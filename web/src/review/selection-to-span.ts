'use client';
import type { Span } from '@/src/types';
import { useSettings } from '@/src/store/settings-store';
import { replacementFor } from '@/src/processing/sandbox-mapper';

const SCALE = 1.5;

/**
 * Locate `needle` in `haystack` with whitespace tolerance — selections often
 * include newlines that don't appear in the joined page text. Returns the
 * position in the original haystack so character offsets stay correct.
 */
function locateInPageText(
  haystack: string,
  needle: string,
): { start: number; end: number } | null {
  const trimmed = needle.trim();
  if (trimmed.length < 1) return null;
  const exact = haystack.indexOf(trimmed);
  if (exact >= 0) return { start: exact, end: exact + trimmed.length };

  // Whitespace-collapsed match: build an index that maps positions in a
  // whitespace-stripped form back to positions in the original.
  const positions: number[] = [];
  let stripped = '';
  for (let i = 0; i < haystack.length; i++) {
    if (!/\s/.test(haystack[i])) {
      positions.push(i);
      stripped += haystack[i];
    }
  }
  const needleStripped = trimmed.replace(/\s+/g, '');
  if (needleStripped.length < 1) return null;
  const idx = stripped.indexOf(needleStripped);
  if (idx < 0) return null;
  const start = positions[idx];
  const lastChar = positions[idx + needleStripped.length - 1];
  if (lastChar === undefined) return null;
  return { start, end: lastChar + 1 };
}

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

  // Find the selection in pageText. Try exact match first, then a whitespace-
  // tolerant match (selections often span newlines while pageText uses single
  // spaces, so plain indexOf fails on multi-line selections).
  const located = locateInPageText(pageText, text);
  let start = located?.start ?? -1;
  let end = located?.end ?? 0;

  // Expand to word boundaries — PDF.js text-layer spans are per-text-item, so
  // selections often clip mid-word. Push outward until non-word char.
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

  // In sandbox mode, populate the replacement so the user sees what it'll
  // become as soon as they click "Redact this".
  const settings = useSettings.getState();
  const replacement =
    settings.mode === 'sandbox'
      ? replacementFor('CUSTOM', finalText, settings.sandboxSeed)
      : undefined;

  return {
    id: crypto.randomUUID(),
    source: 'manual',
    label: 'CUSTOM',
    text: finalText,
    replacement,
    start: start >= 0 ? start : 0,
    end: start >= 0 ? end : 0,
    bbox: { x: pdfX, y: pdfY, width: pdfW, height: pdfH, pageNum },
    confidence: 1.0,
    decision: 'accepted',
  };
}
