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
      className="relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] mx-auto"
      style={{ width: page.width, height: page.height }}
    >
      <canvas ref={canvasRef} className="block" />
      {/* Text layer for native browser selection. PDF.js sets up absolutely-positioned spans inside.
          Pointer events: auto to allow selection; the span overlays sit on a higher z-index. */}
      <div
        ref={textLayerRef}
        className="absolute inset-0 select-text leading-none"
        style={{
          color: 'transparent',
          // Match PDF.js TextLayer expected dimensions
          width: page.width,
          height: page.height,
        }}
      />
      <div className="absolute inset-0 pointer-events-none">
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
