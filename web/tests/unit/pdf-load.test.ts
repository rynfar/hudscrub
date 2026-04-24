import { describe, it, expect } from 'vitest';
import { loadPdf } from '../../src/pdf/load.js';
import * as fs from 'node:fs';

const FIXTURE = '/Users/rynfar/Downloads/hudscrub-project/examples/hud1_garcia_tran.pdf';

describe('loadPdf', () => {
  it('opens a PDF buffer and reports page count', async () => {
    if (!fs.existsSync(FIXTURE)) {
      console.warn('Skipping: example fixture not available');
      return;
    }
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    expect(doc.pageCount).toBeGreaterThan(0);
    doc.close();
  });

  it('save returns a non-empty Uint8Array', async () => {
    if (!fs.existsSync(FIXTURE)) return;
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const out = doc.save();
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(100);
    doc.close();
  });
});
