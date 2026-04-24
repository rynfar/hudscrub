import { describe, it, expect } from 'vitest';
import { detectPage } from '../../src/detection/index.js';
import { RegexDetector } from '../../src/detection/detectors/regex-detector.js';
import type { Detector } from '../../src/types.js';

describe('detection invariants', () => {
  it('regex never produces DOLLAR spans in default-enabled mode', async () => {
    const text = 'paid $1,234.56 for SSN 111-22-3333';
    const spans = await detectPage(text, [new RegexDetector()]);
    expect(spans.some((s) => s.label === 'DOLLAR')).toBe(false);
  });

  it('LLM-stub spans overlapping dollars are dropped by the safety filter', async () => {
    const text = 'amount $1,234.56 here';
    const dollarStart = text.indexOf('$');
    const dollarEnd = dollarStart + '$1,234.56'.length;

    const stub: Detector = {
      name: 'stub-llm',
      detect: async () => [
        {
          id: 'x',
          source: 'llm-other',
          label: 'OTHER',
          text: '$1,234.56',
          start: dollarStart,
          end: dollarEnd,
          bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: 0 },
          confidence: 0.9,
          decision: 'pending',
        },
      ],
    };
    const spans = await detectPage(text, [stub]);
    expect(spans).toHaveLength(0);
  });

  it('regex span beats overlapping LLM span in merge', async () => {
    const text = 'SSN 123-45-6789';
    const stub: Detector = {
      name: 'stub-llm',
      detect: async () => [
        {
          id: 'x',
          source: 'llm-names',
          label: 'NAME',
          text: '123-45-6789',
          start: 4,
          end: 15,
          bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: 0 },
          confidence: 0.9,
          decision: 'pending',
        },
      ],
    };
    const spans = await detectPage(text, [new RegexDetector(), stub]);
    expect(spans).toHaveLength(1);
    expect(spans[0].source).toBe('regex');
    expect(spans[0].label).toBe('SSN');
  });
});
