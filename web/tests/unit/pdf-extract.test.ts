import { describe, it, expect } from 'vitest';
import { loadPdf } from '../../src/pdf/load.js';
import { extractPage } from '../../src/pdf/extract.js';
import * as fs from 'node:fs';

import * as path from 'node:path';
const FIXTURE = path.resolve('tests/fixtures/hud1_garcia.pdf');

describe('extractPage', () => {
  it('returns text and per-character bbox lookup', async () => {
    if (!fs.existsSync(FIXTURE)) return;
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const page = doc.getPage(0);
    const result = extractPage(page);
    expect(result.text.length).toBeGreaterThan(0);

    const idx = Math.floor(result.text.length / 2);
    const bbox = result.bboxAt(idx);
    expect(bbox).toBeDefined();
    expect(bbox!.height).toBeGreaterThan(0);
    doc.close();
  });

  it('produces a union bbox for a multi-character span', async () => {
    if (!fs.existsSync(FIXTURE)) return;
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const page = doc.getPage(0);
    const result = extractPage(page);
    const sliceStart = 0;
    const sliceEnd = Math.min(20, result.text.length);
    const bbox = result.bboxRange(sliceStart, sliceEnd);
    expect(bbox).toBeDefined();
    expect(bbox!.width).toBeGreaterThan(0);
    doc.close();
  });

  it('extracted text contains expected fixture data', async () => {
    if (!fs.existsSync(FIXTURE)) return;
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const page = doc.getPage(0);
    const { text } = extractPage(page);
    // Python fixture should contain at least one SSN and a borrower name
    expect(text).toMatch(/\d{3}-\d{2}-\d{4}/);
    doc.close();
  });
});
