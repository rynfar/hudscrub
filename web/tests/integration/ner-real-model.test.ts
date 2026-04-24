import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../../src/pdf/load.js';
import { extractPage } from '../../src/pdf/extract.js';
import { NerDetector } from '../../src/detection/ner/ner-detector.js';
import { loadTransformersNer } from '../../src/detection/ner/transformers-loader.js';

const FIXTURE = path.resolve('tests/fixtures/hud1_garcia.pdf');
const SHOULD_RUN = process.env.RUN_NER_TESTS === '1';

describe.skipIf(!SHOULD_RUN)('NerDetector with real model', () => {
  let detector: NerDetector;

  beforeAll(async () => {
    detector = new NerDetector({ loader: loadTransformersNer });
    await detector.ensureLoaded((p) => {
      if (p.status === 'downloading' && p.progress > 0) {
        process.stdout.write(`\r  loading: ${Math.round(p.progress * 100)}% `);
      }
    });
    process.stdout.write('\n');
  }, 180000);

  it('finds the borrower name in the fixture', async () => {
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const ext = extractPage(doc.getPage(0));
    const spans = await detector.detect(ext.text, []);
    doc.close();

    const names = spans.filter((s) => s.label === 'NAME').map((s) => s.text);
    // bert-base-NER is imperfect — accept partial match (any span containing "Garcia" qualifies)
    expect(names.some((n) => n.toLowerCase().includes('garcia'))).toBe(true);
  }, 60000);

  it('finds at least one location/address span', async () => {
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const ext = extractPage(doc.getPage(0));
    const spans = await detector.detect(ext.text, []);
    doc.close();
    const addrs = spans.filter((s) => s.label === 'ADDRESS');
    expect(addrs.length).toBeGreaterThan(0);
  }, 60000);
});
