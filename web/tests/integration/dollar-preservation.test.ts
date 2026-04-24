import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../../src/pdf/load.js';
import { extractPage } from '../../src/pdf/extract.js';
import { detectPage } from '../../src/detection/index.js';
import { RegexDetector } from '../../src/detection/detectors/regex-detector.js';
import { redactDocument } from '../../src/output/redactor.js';
import { verifyDollarPreservation } from '../../src/output/dollar-verifier.js';
import { ValueMapper } from '../../src/mapping/value-mapper.js';
import type { Span, Mode } from '../../src/types.js';

const FIXTURES = ['hud1_garcia.pdf', 'hud1_johnson.pdf', 'hud1_smith.pdf'];

async function processOnce(file: string, mode: Mode, mapper?: ValueMapper) {
  const inputBytes = fs.readFileSync(path.resolve('tests/fixtures', file));
  const inputDoc = await loadPdf(inputBytes);
  const inputPages: string[] = [];
  const allSpans: Span[] = [];

  for (let i = 0; i < inputDoc.pageCount; i++) {
    const ext = extractPage(inputDoc.getPage(i), i);
    inputPages.push(ext.text);
    const detected = await detectPage(ext.text, [new RegexDetector()]);
    for (const s of detected) {
      const bbox = ext.bboxRange(s.start, s.end);
      if (!bbox) continue;
      const span: Span = {
        ...s,
        bbox: { ...bbox, pageNum: i },
        decision: 'accepted',
      };
      if (mode === 'sandbox' && mapper) {
        span.replacement = mapper.mapValue(s.label, s.text);
      }
      allSpans.push(span);
    }
  }
  inputDoc.close();

  const outputBytes = await redactDocument(inputBytes, allSpans, { mode });
  const outputDoc = await loadPdf(outputBytes);
  const outputPages: string[] = [];
  for (let i = 0; i < outputDoc.pageCount; i++) {
    outputPages.push(extractPage(outputDoc.getPage(i), i).text);
  }
  outputDoc.close();

  return { inputPages, outputPages };
}

describe('dollar preservation across all fixtures (redact)', () => {
  for (const f of FIXTURES) {
    it(`${f}: every dollar in input survives redact mode`, async () => {
      const { inputPages, outputPages } = await processOnce(f, 'redact');
      const r = verifyDollarPreservation(inputPages, outputPages);
      if (!r.ok) console.error('Diffs:', JSON.stringify(r.diffs, null, 2));
      expect(r.ok).toBe(true);
    });
  }
});

describe('dollar preservation across all fixtures (sandbox)', () => {
  for (const f of FIXTURES) {
    it(`${f}: every dollar in input survives sandbox mode`, async () => {
      const mapper = new ValueMapper(42);
      const { inputPages, outputPages } = await processOnce(f, 'sandbox', mapper);
      const r = verifyDollarPreservation(inputPages, outputPages);
      if (!r.ok) console.error('Diffs:', JSON.stringify(r.diffs, null, 2));
      expect(r.ok).toBe(true);
    });
  }
});
