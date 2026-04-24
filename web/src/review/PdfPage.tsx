'use client';
import { useEffect, useRef } from 'react';
import type { RenderedPage } from '@/src/pdf/browser-renderer';
import type { Span } from '@/src/types';
import { SpanOverlay } from './SpanOverlay';

interface Props {
  page: RenderedPage;
  spans: Span[];
  focusedSpanId?: string | null;
  onSpanClick?: (spanId: string) => void;
}

export function PdfPage({ page, spans, focusedSpanId, onSpanClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    page.render(canvasRef.current).catch((e) => console.error('render failed', e));
  }, [page]);

  return (
    <div
      className="relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] mx-auto"
      style={{ width: page.width, height: page.height }}
    >
      <canvas ref={canvasRef} className="block" />
      <div className="absolute inset-0">
        {spans.map((s) => (
          <SpanOverlay
            key={s.id}
            span={s}
            pageWidth={page.width}
            pageHeight={page.height}
            pdfWidth={page.width / 1.5}
            pdfHeight={page.height / 1.5}
            focused={focusedSpanId === s.id}
            onClick={() => onSpanClick?.(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
