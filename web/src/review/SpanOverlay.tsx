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

interface StyleState {
  className: string;
  strikethrough: boolean;
  strikethroughColor?: string;
}

const styleByState = (s: Span): StyleState => {
  if (s.decision === 'accepted') {
    // Light green tint with a strong horizontal strike-through to read as redaction.
    return {
      className: 'bg-[rgba(15,95,61,0.12)] border-[1.5px] border-[#0F5F3D]',
      strikethrough: true,
      strikethroughColor: '#0F5F3D',
    };
  }
  if (s.decision === 'rejected') {
    return {
      className:
        'bg-transparent border border-dashed border-[color:var(--color-ink-subtle)]',
      strikethrough: false,
    };
  }
  if (s.source === 'manual') {
    return {
      className: 'bg-[rgba(107,79,163,0.06)] border-[1.5px] border-[#6B4FA3]',
      strikethrough: false,
    };
  }
  if (s.source === 'regex') {
    return {
      className: 'bg-[rgba(22,116,77,0.06)] border-[1.5px] border-[#16744D]',
      strikethrough: false,
    };
  }
  if (s.confidence < 0.85) {
    return {
      className:
        'bg-[rgba(194,94,26,0.06)] border-[1.5px] border-dashed border-[#C25E1A]',
      strikethrough: false,
    };
  }
  return {
    className: 'bg-[rgba(183,121,31,0.06)] border-[1.5px] border-[#B7791F]',
    strikethrough: false,
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
  const { className, strikethrough, strikethroughColor } = styleByState(span);

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
      className={`absolute rounded-[2px] ${className}`}
      style={{ left, top, width, height }}
      aria-label={`${span.label}: ${span.text}`}
    >
      {strikethrough && (
        <span
          aria-hidden
          className="absolute left-0 right-0 top-1/2 pointer-events-none"
          style={{
            height: 2,
            backgroundColor: strikethroughColor ?? '#0F5F3D',
            transform: 'translateY(-50%)',
          }}
        />
      )}
    </motion.button>
  );
}
