import { loadPdf } from '../pdf/load';
import type { Mode, Span } from '../types';

export interface RedactOptions {
  mode: Mode;
}

interface MupdfAnnotation {
  setRect(rect: number[]): void;
  setContents(text: string): void;
  setColor(color: number[]): void;
  update(): boolean;
  getContents(): string;
  getRect(): number[];
}

interface MupdfPage {
  createAnnotation(type: string): MupdfAnnotation;
  applyRedactions(blackBoxes?: boolean, imageMethod?: number): void;
  getAnnotations(): MupdfAnnotation[];
}

export async function redactDocument(
  inputBytes: Uint8Array | Buffer,
  spans: Span[],
  opts: RedactOptions,
): Promise<Uint8Array> {
  const doc = await loadPdf(inputBytes);

  const byPage = new Map<number, Span[]>();
  for (const s of spans) {
    if (s.decision !== 'accepted') continue;
    const arr = byPage.get(s.bbox.pageNum) ?? [];
    arr.push(s);
    byPage.set(s.bbox.pageNum, arr);
  }

  for (const [pageNum, pageSpans] of byPage) {
    const page = doc.getPage(pageNum) as unknown as MupdfPage;

    // Step 1: Add Redact annotations and apply them (removes original text from content stream)
    for (const s of pageSpans) {
      const rect = [
        s.bbox.x,
        s.bbox.y,
        s.bbox.x + s.bbox.width,
        s.bbox.y + s.bbox.height,
      ];
      const annot = page.createAnnotation('Redact');
      annot.setRect(rect);
    }
    // applyRedactions(blackBoxes, imageMethod):
    //   blackBoxes: true draws black rectangle where text was (redact mode visual)
    //   imageMethod: 0=none, 1=remove, 2=pixelate
    const drawBlackBox = opts.mode === 'redact';
    const imageMethod = opts.mode === 'redact' ? 1 : 0;
    page.applyRedactions(drawBlackBox, imageMethod);

    // Step 2 (sandbox only): Add FreeText annotations with replacement text overlaid at the same rect.
    // Note: FreeText annotations render visibly in PDF viewers but do not appear in
    // page.toStructuredText() output. Verification of sandbox replacements at integration-test
    // time uses page.getAnnotations() to read the FreeText contents back.
    if (opts.mode === 'sandbox') {
      for (const s of pageSpans) {
        if (!s.replacement) continue;
        const rect = [
          s.bbox.x,
          s.bbox.y,
          s.bbox.x + s.bbox.width,
          s.bbox.y + s.bbox.height,
        ];
        const ft = page.createAnnotation('FreeText');
        ft.setRect(rect);
        ft.setContents(s.replacement);
        ft.setColor([0, 0, 0]);
        ft.update();
      }
    }
  }

  const out = doc.save();
  doc.close();
  return out;
}
