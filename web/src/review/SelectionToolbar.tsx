'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectionInfo {
  text: string;
  rect: DOMRect;
}

interface Props {
  /** Restrict selection capture to text inside this container. */
  scopeRef: React.RefObject<HTMLElement | null>;
  onAddRedaction: (text: string) => void;
}

/**
 * Floating "Add redaction" pill that appears just above any text the user
 * has selected inside the PDF text layer. Single click action — the same
 * behavior as pressing R.
 */
export function SelectionToolbar({ scopeRef, onAddRedaction }: Props) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      if (text.length < 2) {
        setSelection(null);
        return;
      }
      // Only show the toolbar if the selection is inside the scope (the PDF area)
      const scope = scopeRef.current;
      if (scope && !scope.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }
      setSelection({ text, rect });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [scopeRef]);

  if (!selection) return null;

  // Position: centered horizontally on the selection, just above it.
  const top = selection.rect.top + window.scrollY - 44;
  const left =
    selection.rect.left + window.scrollX + selection.rect.width / 2;

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 600, damping: 36 }}
          style={{
            position: 'absolute',
            top,
            left,
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[color:var(--color-ink)] text-[color:var(--color-bg)] text-xs shadow-lg whitespace-nowrap"
          // Keep mousedown from clearing the selection before our click fires
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              onAddRedaction(selection.text);
              window.getSelection()?.removeAllRanges();
              setSelection(null);
            }}
            className="font-medium hover:underline underline-offset-2"
          >
            Redact this
          </button>
          <span className="text-[color:var(--color-ink-subtle)] text-[10px] font-mono">
            or press R
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
