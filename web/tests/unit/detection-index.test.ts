import { describe, it, expect } from 'vitest';
import { detectPage } from '../../src/detection/index.js';
import { RegexDetector } from '../../src/detection/detectors/regex-detector.js';
import type { Detector, Span } from '../../src/types.js';

describe('detectPage', () => {
  it('runs detectors in order and accumulates spans', async () => {
    const text = 'SSN 123-45-6789 email user@example.com';
    const spans = await detectPage(text, [new RegexDetector()]);
    const labels = spans.map((s) => s.label).sort();
    expect(labels).toEqual(['EMAIL', 'SSN']);
  });

  it('returns [] for empty text', async () => {
    const spans = await detectPage('', [new RegexDetector()]);
    expect(spans).toEqual([]);
  });

  it('passes alreadyFound to each detector', async () => {
    const seen: number[] = [];
    const stub: Detector = {
      name: 'stub',
      detect: async (_t: string, alreadyFound: Span[]) => {
        seen.push(alreadyFound.length);
        return [];
      },
    };
    await detectPage('SSN 123-45-6789', [new RegexDetector(), stub, stub]);
    expect(seen).toEqual([1, 1]);
  });
});
