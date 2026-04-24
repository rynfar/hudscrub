import type { Span } from '../types';

const PRECEDENCE: Record<string, number> = {
  manual: 100,
  regex: 50,
  'llm-names': 30,
  'llm-addresses': 30,
  'llm-other': 10,
};

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

function spanSize(s: Span): number {
  return s.end - s.start;
}

function pickWinner(a: Span, b: Span): Span {
  const pa = PRECEDENCE[a.source] ?? 0;
  const pb = PRECEDENCE[b.source] ?? 0;
  if (pa !== pb) return pa > pb ? a : b;
  return spanSize(a) >= spanSize(b) ? a : b;
}

export function mergeSpans(existing: Span[], incoming: Span[]): Span[] {
  const all = [...existing];
  for (const candidate of incoming) {
    let conflictIdx = -1;
    for (let i = 0; i < all.length; i++) {
      if (overlaps(all[i], candidate)) {
        conflictIdx = i;
        break;
      }
    }
    if (conflictIdx === -1) {
      all.push(candidate);
      continue;
    }
    all[conflictIdx] = pickWinner(all[conflictIdx], candidate);
  }
  return all;
}

export interface DollarRange {
  start: number;
  end: number;
}

export function isForbiddenSpan(span: Span, dollars: DollarRange[]): boolean {
  for (const d of dollars) {
    if (span.start < d.end && d.start < span.end) return true;
  }
  return false;
}
