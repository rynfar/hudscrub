'use client';
import { useEffect } from 'react';
import type { Span } from '@/src/types';
import { selectionToSpan } from './selection-to-span';

interface Props {
  pageText: string;
  pageNum: number;
  onAdd: (span: Span) => void;
}

export function ManualSelect({ pageText, pageNum, onAdd }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      )
        return;
      const span = selectionToSpan(pageNum, pageText);
      if (!span) return;
      e.preventDefault();
      onAdd(span);
      window.getSelection()?.removeAllRanges();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pageText, pageNum, onAdd]);

  return null;
}
