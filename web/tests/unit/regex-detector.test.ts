import { describe, it, expect } from 'vitest';
import { RegexDetector } from '../../src/detection/detectors/regex-detector.js';

describe('RegexDetector', () => {
  it('returns Span objects from regex matches', async () => {
    const d = new RegexDetector();
    const text = 'SSN 123-45-6789 phone 555-123-4567';
    const spans = await d.detect(text, []);
    expect(spans.length).toBe(2);
    const labels = spans.map((s) => s.label).sort();
    expect(labels).toEqual(['PHONE', 'SSN']);
  });
  it('all spans have source=regex and confidence=1.0', async () => {
    const d = new RegexDetector();
    const spans = await d.detect('SSN 123-45-6789', []);
    expect(spans.every((s) => s.source === 'regex')).toBe(true);
    expect(spans.every((s) => s.confidence === 1.0)).toBe(true);
  });
  it('all spans start as accepted (safer default — user un-accepts false positives)', async () => {
    const d = new RegexDetector();
    const spans = await d.detect('SSN 123-45-6789', []);
    expect(spans.every((s) => s.decision === 'accepted')).toBe(true);
  });
  it('span text matches text.slice(start, end)', async () => {
    const d = new RegexDetector();
    const text = 'see 123-45-6789 here';
    const [s] = await d.detect(text, []);
    expect(text.slice(s.start, s.end)).toBe(s.text);
  });
});
