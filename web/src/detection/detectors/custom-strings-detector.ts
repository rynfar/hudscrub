import type { Detector, Span } from '../../types';

const randomUUID = (): string => crypto.randomUUID();

interface Entry {
  original: string;
  replacement?: string;
}

/**
 * Literal-string detector for user-curated lists (e.g. names that always appear
 * in a HUD packet). Matches every occurrence on the page; emits accepted spans
 * with `source: manual` so they sit at the top of the merge precedence and are
 * never overwritten by other detectors.
 */
export class CustomStringsDetector implements Detector {
  readonly name = 'custom-strings';
  private entries: Entry[];

  constructor(entries: Entry[]) {
    // Filter empties and sort longest-first so we match the most specific phrase
    this.entries = entries
      .filter((e) => typeof e.original === 'string' && e.original.trim().length >= 2)
      .map((e) => ({ ...e, original: e.original.trim() }))
      .sort((a, b) => b.original.length - a.original.length);
  }

  async detect(text: string, _alreadyFound: Span[]): Promise<Span[]> {
    if (!text || this.entries.length === 0) return [];
    const out: Span[] = [];
    for (const entry of this.entries) {
      let cursor = 0;
      while (true) {
        const idx = text.indexOf(entry.original, cursor);
        if (idx < 0) break;
        out.push({
          id: randomUUID(),
          source: 'manual',
          label: 'CUSTOM',
          text: entry.original,
          start: idx,
          end: idx + entry.original.length,
          bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
          confidence: 1.0,
          decision: 'accepted',
          replacement: entry.replacement,
        });
        cursor = idx + entry.original.length;
      }
    }
    return out;
  }
}
