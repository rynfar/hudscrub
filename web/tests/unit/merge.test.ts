import { describe, it, expect } from 'vitest';
import { mergeSpans, isForbiddenSpan } from '../../src/detection/merge.js';
import type { Span } from '../../src/types.js';

const span = (overrides: Partial<Span>): Span => ({
  id: Math.random().toString(),
  source: 'regex',
  label: 'NAME',
  text: 'X',
  start: 0,
  end: 1,
  bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: 0 },
  confidence: 1.0,
  decision: 'pending',
  ...overrides,
});

describe('mergeSpans', () => {
  it('combines disjoint spans from both sources', () => {
    const a = [span({ start: 0, end: 5, label: 'NAME', source: 'regex' })];
    const b = [span({ start: 10, end: 15, label: 'NAME', source: 'llm-names' })];
    expect(mergeSpans(a, b)).toHaveLength(2);
  });

  it('regex span beats LLM span on identical range', () => {
    const a = [span({ start: 0, end: 5, label: 'NAME', source: 'regex' })];
    const b = [span({ start: 0, end: 5, label: 'NAME', source: 'llm-names' })];
    const merged = mergeSpans(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('regex');
  });

  it('larger span wins over smaller for overlapping LLM spans', () => {
    const a = [span({ start: 0, end: 5, source: 'llm-names', label: 'NAME' })];
    const b = [span({ start: 0, end: 10, source: 'llm-names', label: 'NAME' })];
    const merged = mergeSpans(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].end).toBe(10);
  });

  it('manual span always wins over any source', () => {
    const a = [span({ start: 0, end: 5, source: 'regex', label: 'SSN' })];
    const b = [span({ start: 0, end: 5, source: 'manual', label: 'NAME' })];
    const merged = mergeSpans(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('manual');
  });
});

describe('isForbiddenSpan', () => {
  it('returns true if span overlaps any dollar amount', () => {
    const dollars = [{ start: 10, end: 15 }];
    expect(isForbiddenSpan(span({ start: 12, end: 14 }), dollars)).toBe(true);
  });
  it('returns false for non-overlapping spans', () => {
    const dollars = [{ start: 10, end: 15 }];
    expect(isForbiddenSpan(span({ start: 0, end: 5 }), dollars)).toBe(false);
  });
});
