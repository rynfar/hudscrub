import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../../src/pdf/load.js';
import { extractPage } from '../../src/pdf/extract.js';
import { detectPage } from '../../src/detection/index.js';
import { RegexDetector } from '../../src/detection/detectors/regex-detector.js';
import { ValueMapper } from '../../src/mapping/value-mapper.js';

describe('sandbox consistency', () => {
  it('same SSN appearing N times produces N identical fakes', async () => {
    const buf = fs.readFileSync(path.resolve('tests/fixtures/hud1_garcia.pdf'));
    const doc = await loadPdf(buf);
    const mapper = new ValueMapper(42);

    const seen = new Map<string, string>();
    let count = 0;
    for (let i = 0; i < doc.pageCount; i++) {
      const ext = extractPage(doc.getPage(i), i);
      for (const span of await detectPage(ext.text, [new RegexDetector()])) {
        if (span.label !== 'SSN') continue;
        count++;
        const fake = mapper.mapValue('SSN', span.text);
        if (seen.has(span.text)) {
          expect(fake).toBe(seen.get(span.text));
        } else {
          seen.set(span.text, fake);
        }
      }
    }
    doc.close();
    expect(count).toBeGreaterThan(0);
  });

  it('same seed produces byte-identical mapping report across runs', async () => {
    const buf = fs.readFileSync(path.resolve('tests/fixtures/hud1_garcia.pdf'));

    async function run(): Promise<string> {
      const doc = await loadPdf(buf);
      const mapper = new ValueMapper(123);
      for (let i = 0; i < doc.pageCount; i++) {
        const ext = extractPage(doc.getPage(i), i);
        for (const s of await detectPage(ext.text, [new RegexDetector()])) {
          mapper.mapValue(s.label, s.text);
        }
      }
      doc.close();
      return JSON.stringify(mapper.getMappingReport());
    }

    const a = await run();
    const b = await run();
    expect(a).toBe(b);
  });

  it('same loan number across multiple fixtures produces same fake when shared', async () => {
    // Use one mapper across multiple docs, simulating a batch
    const mapper = new ValueMapper(7);
    const garciaLoan = 'GAR-2024-77310';
    const johnsonLoan = 'JOH-2024-44820';
    const a1 = mapper.mapValue('LOAN_NUM', garciaLoan);
    const a2 = mapper.mapValue('LOAN_NUM', garciaLoan);
    const b1 = mapper.mapValue('LOAN_NUM', johnsonLoan);
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b1);
  });
});
