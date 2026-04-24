import type { SpanLabel } from '../types';

export const PATTERNS: Record<string, RegExp> = {
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  EIN: /\b\d{2}-\d{7}\b/g,
  PHONE: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  DATE: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g,
  LOAN_NUM: /(?:Loan|Case|File|Account|FHA)\s*(?:#|No\.?|Number)?\s*:?\s*([A-Z0-9][A-Z0-9-]{5,})/gi,
  ZIP: /\b\d{5}(?:-\d{4})?\b/g,
  DOLLAR: /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g,
};

export const DEFAULT_ENABLED: SpanLabel[] = ['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM'];

export const FORBIDDEN_FOR_MUTATION: ReadonlySet<SpanLabel> = new Set<SpanLabel>(['DOLLAR']);

export interface RegexMatch {
  label: SpanLabel;
  text: string;
  start: number;
  end: number;
}

export function* findAll(
  text: string,
  enabled: SpanLabel[] = DEFAULT_ENABLED,
): Generator<RegexMatch> {
  const filtered = enabled.filter((e) => !FORBIDDEN_FOR_MUTATION.has(e));
  for (const name of filtered) {
    const pattern = PATTERNS[name];
    if (!pattern) continue;
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (name === 'LOAN_NUM' && m[1] !== undefined) {
        const idx = m.index + m[0].indexOf(m[1]);
        yield { label: 'LOAN_NUM', text: m[1], start: idx, end: idx + m[1].length };
      } else {
        yield { label: name as SpanLabel, text: m[0], start: m.index, end: m.index + m[0].length };
      }
    }
  }
}

export function* findDollars(text: string): Generator<RegexMatch> {
  const re = new RegExp(PATTERNS.DOLLAR.source, PATTERNS.DOLLAR.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    yield { label: 'DOLLAR', text: m[0], start: m.index, end: m.index + m[0].length };
  }
}
