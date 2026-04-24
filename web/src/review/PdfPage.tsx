'use client';
import { useEffect, useRef } from 'react';
import type { RenderedPage } from '@/src/pdf/browser-renderer';
import type { Span } from '@/src/types';
import { SpanOverlay } from './SpanOverlay';

interface Props {
  page: RenderedPage;
  spans: Span[];
  focusedSpanId?: string | null;
  detecting?: boolean;
  onSpanClick?: (spanId: string) => void;
}

export function PdfPage({ page, spans, focusedSpanId, detecting, onSpanClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    const task = page.render(canvasRef.current);
    task.promise.catch((e) => {
      if (!cancelled) console.error('render failed', e);
    });
    if (textLayerRef.current) {
      page.renderTextLayer(textLayerRef.current).catch((e) => {
        if (!cancelled) console.error('text layer failed', e);
      });
    }
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [page]);

  return (
    <div
      data-pdf-page={page.pageNum}
      className={`relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] mx-auto ${detecting ? 'ai-shimmer' : ''}`}
      style={{ width: page.width, height: page.height }}
    >
      <canvas ref={canvasRef} className="block relative z-[1]" />
      {/* Text layer overlays the canvas with transparent absolutely-positioned spans
          that the browser can natively select. PDF.js fills this on render. */}
      <div
        ref={textLayerRef}
        className="pdfjs-text-layer"
        style={{ width: page.width, height: page.height }}
      />
      {/* Span overlays sit above the text layer so they're clickable. */}
      <div className="absolute inset-0 pointer-events-none z-[3]">
        {spans.map((s) => (
          <div key={s.id} className="pointer-events-auto">
            <SpanOverlay
              span={s}
              pageWidth={page.width}
              pageHeight={page.height}
              pdfWidth={page.width / 1.5}
              pdfHeight={page.height / 1.5}
              focused={focusedSpanId === s.id}
              onClick={() => onSpanClick?.(s.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
