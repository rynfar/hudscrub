import type { Detector, Span, SpanLabel } from '../../types.js';
import { findAll, DEFAULT_ENABLED } from '../regex.js';
import { randomUUID } from 'node:crypto';

export class RegexDetector implements Detector {
  readonly name = 'regex';
  private enabled: SpanLabel[];

  constructor(enabled: SpanLabel[] = DEFAULT_ENABLED) {
    this.enabled = enabled;
  }

  async detect(text: string, _alreadyFound: Span[]): Promise<Span[]> {
    const out: Span[] = [];
    for (const m of findAll(text, this.enabled)) {
      out.push({
        id: randomUUID(),
        source: 'regex',
        label: m.label,
        text: m.text,
        start: m.start,
        end: m.end,
        bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
        confidence: 1.0,
        decision: 'pending',
      });
    }
    return out;
  }
}
