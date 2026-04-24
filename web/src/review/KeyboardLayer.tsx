'use client';
import { useEffect } from 'react';
import type { Span } from '@/src/types';

interface Props {
  spans: Span[];
  focusedSpanId: string | null;
  onSetFocus: (id: string | null) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export function KeyboardLayer({
  spans,
  focusedSpanId,
  onSetFocus,
  onAccept,
  onReject,
  onAcceptAll,
  onNextPage,
  onPrevPage,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

      const pendingSpans = spans.filter((s) => s.decision === 'pending');
      const idx = focusedSpanId ? pendingSpans.findIndex((s) => s.id === focusedSpanId) : -1;

      if (e.key === 'Tab') {
        if (pendingSpans.length === 0) return;
        e.preventDefault();
        const next = e.shiftKey
          ? idx <= 0
            ? pendingSpans.length - 1
            : idx - 1
          : (idx + 1) % pendingSpans.length;
        onSetFocus(pendingSpans[next].id);
      } else if (e.key === 'Enter' && focusedSpanId) {
        e.preventDefault();
        onAccept(focusedSpanId);
        const remaining = pendingSpans.filter((s) => s.id !== focusedSpanId);
        if (remaining.length > 0) {
          const nextIdx = Math.min(idx, remaining.length - 1);
          onSetFocus(remaining[nextIdx].id);
        }
      } else if (e.key === 'Backspace' && focusedSpanId) {
        e.preventDefault();
        onReject(focusedSpanId);
        const remaining = pendingSpans.filter((s) => s.id !== focusedSpanId);
        if (remaining.length > 0) {
          const nextIdx = Math.min(idx, remaining.length - 1);
          onSetFocus(remaining[nextIdx].id);
        }
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        onNextPage();
      } else if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey) {
        onPrevPage();
      } else if (e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onAcceptAll();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spans, focusedSpanId, onSetFocus, onAccept, onReject, onAcceptAll, onNextPage, onPrevPage]);

  return null;
}
