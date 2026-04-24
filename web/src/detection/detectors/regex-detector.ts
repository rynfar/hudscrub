import type { Detector, Span, SpanLabel } from '../../types';
import { findAll, DEFAULT_ENABLED } from '../regex';

// `crypto.randomUUID` is available in browsers and Node 19+ as a global.
const randomUUID = (): string => crypto.randomUUID();

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
        decision: 'accepted',
      });
    }
    return out;
  }
}
