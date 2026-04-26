'use client';
import type { Span } from '@/src/types';
import { motion } from 'framer-motion';

interface Props {
  span: Span;
  pageWidth: number;
  pageHeight: number;
  pdfWidth: number;
  pdfHeight: number;
  focused: boolean;
  onClick?: () => void;
}

const styleByState = (s: Span, sandboxPreview: boolean): { className: string } => {
  if (s.decision === 'accepted') {
    // In sandbox preview we want the box to fully cover the original text so
    // the replacement reads as a clean swap. In redact mode we keep the
    // 50%-opacity look so the original is still partially visible.
    if (sandboxPreview) {
      return { className: 'bg-[#0F5F3D] border-[1.5px] border-[#0A4A30]' };
    }
    return { className: 'bg-[rgba(15,95,61,0.5)] border-[1.5px] border-[#0F5F3D]' };
  }
  if (s.decision === 'rejected') {
    return {
      className:
        'bg-transparent border border-dashed border-[color:var(--color-ink-subtle)]',
    };
  }
  if (s.source === 'manual') {
    return {
      className: 'bg-[rgba(107,79,163,0.06)] border-[1.5px] border-[#6B4FA3]',
    };
  }
  if (s.source === 'regex') {
    return {
      className: 'bg-[rgba(22,116,77,0.06)] border-[1.5px] border-[#16744D]',
    };
  }
  if (s.confidence < 0.85) {
    return {
      className:
        'bg-[rgba(194,94,26,0.06)] border-[1.5px] border-dashed border-[#C25E1A]',
    };
  }
  return {
    className: 'bg-[rgba(183,121,31,0.06)] border-[1.5px] border-[#B7791F]',
  };
};

export function SpanOverlay({
  span,
  pageWidth,
  pageHeight,
  pdfWidth,
  pdfHeight,
  focused,
  onClick,
}: Props) {
  const sx = pageWidth / pdfWidth;
  const sy = pageHeight / pdfHeight;
  const left = span.bbox.x * sx;
  const top = span.bbox.y * sy;
  const width = span.bbox.width * sx;
  const height = span.bbox.height * sy;
  // Sandbox preview: when we have a replacement and the span is accepted,
  // render the replacement text inside the box so the user sees the swap
  // in place instead of just a colored highlight.
  const showReplacement =
    span.decision === 'accepted' && typeof span.replacement === 'string' && span.replacement.length > 0;
  const { className } = styleByState(span, showReplacement);

  // Pick a font size that fits the box height. Boxes hug the line height,
  // so ~70% of box height is the target. Cap at 14px — defensive against
  // boxes that accidentally span multiple lines (would otherwise render
  // gigantic text). Floor at 8px for legibility.
  const fontSize = Math.min(14, Math.max(8, Math.round(height * 0.7)));

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        scale: focused ? 1.02 : 1,
        boxShadow: focused
          ? '0 0 0 3px rgba(183, 121, 31, 0.25)'
          : '0 0 0 0 rgba(0,0,0,0)',
      }}
      transition={{ type: 'spring', stiffness: 600, damping: 36 }}
      className={`absolute rounded-[2px] flex items-center overflow-hidden ${className}`}
      style={{ left, top, width, height, paddingLeft: 2, paddingRight: 2 }}
      aria-label={
        showReplacement
          ? `${span.label}: ${span.text} → ${span.replacement}`
          : `${span.label}: ${span.text}`
      }
      title={showReplacement ? `${span.text} → ${span.replacement}` : undefined}
    >
      {showReplacement && (
        <span
          className="text-white font-medium whitespace-nowrap leading-none"
          style={{ fontSize, letterSpacing: '-0.01em' }}
        >
          {span.replacement}
        </span>
      )}
    </motion.button>
  );
}
