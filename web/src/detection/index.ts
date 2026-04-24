import type { Detector, Span } from '../types';
import { mergeSpans, isForbiddenSpan } from './merge';
import { findDollars } from './regex';

export async function detectPage(text: string, detectors: Detector[]): Promise<Span[]> {
  if (!text) return [];
  const dollars = Array.from(findDollars(text)).map((d) => ({ start: d.start, end: d.end }));

  let spans: Span[] = [];
  for (const detector of detectors) {
    const newSpans = await detector.detect(text, spans);
    const safe = newSpans.filter((s) => !isForbiddenSpan(s, dollars));
    spans = mergeSpans(spans, safe);
  }
  return spans;
}

export { mergeSpans, isForbiddenSpan } from './merge';
export { RegexDetector } from './detectors/regex-detector';
export {
  findAll,
  findDollars,
  PATTERNS,
  DEFAULT_ENABLED,
  FORBIDDEN_FOR_MUTATION,
} from './regex';
