import { describe, it, expectTypeOf } from 'vitest';
import type { Span, SpanLabel, SpanSource, ProcessReport } from '../../src/types.js';

describe('core types', () => {
  it('Span has required shape', () => {
    const s: Span = {
      id: 'x',
      source: 'regex',
      label: 'SSN',
      text: '123-45-6789',
      start: 0,
      end: 11,
      bbox: { x: 0, y: 0, width: 10, height: 10, pageNum: 0 },
      confidence: 1.0,
      decision: 'pending',
    };
    expectTypeOf(s.label).toEqualTypeOf<SpanLabel>();
    expectTypeOf(s.source).toEqualTypeOf<SpanSource>();
  });

  it('ProcessReport has required shape', () => {
    const r: ProcessReport = {
      counts: { SSN: 1 },
      replacements: [],
      dollarsSeen: 0,
    };
    expectTypeOf(r.counts).toEqualTypeOf<Record<string, number>>();
  });
});
