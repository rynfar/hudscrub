import { describe, it, expect } from 'vitest';
import { redactDocument } from '../../src/output/redactor.js';
import { loadPdf } from '../../src/pdf/load.js';
import { extractPage } from '../../src/pdf/extract.js';
import { RegexDetector } from '../../src/detection/detectors/regex-detector.js';
import { detectPage } from '../../src/detection/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FIXTURE = path.resolve('tests/fixtures/hud1_garcia.pdf');

interface MupdfAnnotLike {
  getContents(): string;
}

describe('redactDocument (redact mode)', () => {
  it('removes detected SSN from output', async () => {
    if (!fs.existsSync(FIXTURE)) return;
    const buf = fs.readFileSync(FIXTURE);

    const doc = await loadPdf(buf);
    const ext = extractPage(doc.getPage(0));
    const detected = await detectPage(ext.text, [new RegexDetector()]);
    const ssnSpan = detected.find((s) => s.label === 'SSN');
    expect(ssnSpan).toBeDefined();
    const originalSsn = ssnSpan!.text;
    const bbox = ext.bboxRange(ssnSpan!.start, ssnSpan!.end)!;
    const ssnSpanWithBox = {
      ...ssnSpan!,
      bbox: { ...bbox, pageNum: 0 },
      decision: 'accepted' as const,
    };
    doc.close();

    const outBytes = await redactDocument(buf, [ssnSpanWithBox], { mode: 'redact' });
    const outDoc = await loadPdf(outBytes);
    const outText = extractPage(outDoc.getPage(0)).text;
    expect(outText.includes(originalSsn)).toBe(false);
    outDoc.close();
  });
});

describe('redactDocument (sandbox mode)', () => {
  it('removes original SSN and adds FreeText annotation with replacement', async () => {
    if (!fs.existsSync(FIXTURE)) return;
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const ext = extractPage(doc.getPage(0));
    const detected = await detectPage(ext.text, [new RegexDetector()]);
    const ssnSpan = detected.find((s) => s.label === 'SSN')!;
    const originalSsn = ssnSpan.text;
    const replaced = '900-00-0000';
    const bbox = ext.bboxRange(ssnSpan.start, ssnSpan.end)!;
    const accepted = {
      ...ssnSpan,
      bbox: { ...bbox, pageNum: 0 },
      decision: 'accepted' as const,
      replacement: replaced,
    };
    doc.close();

    const outBytes = await redactDocument(buf, [accepted], { mode: 'sandbox' });
    const outDoc = await loadPdf(outBytes);
    const outPage = outDoc.getPage(0);
    const outText = extractPage(outPage).text;

    // Original removed from page content stream
    expect(outText.includes(originalSsn)).toBe(false);

    // Replacement text lives in a FreeText annotation (renders visibly but not in extracted text)
    const annots = (outPage as unknown as { getAnnotations(): MupdfAnnotLike[] }).getAnnotations();
    const contents = annots.map((a) => a.getContents());
    expect(contents).toContain(replaced);

    outDoc.close();
  });
});
