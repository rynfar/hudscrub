import { loadPdf } from '../pdf/load';
import type { Mode, Span } from '../types';

export interface RedactOptions {
  mode: Mode;
}

interface MupdfAnnotation {
  setRect(rect: number[]): void;
  setContents(text: string): void;
  setColor(color: number[]): void;
  setDefaultAppearance?: (font: string, size: number, color: number[]) => void;
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
        Number(s.bbox.x),
        Number(s.bbox.y),
        Number(s.bbox.x + s.bbox.width),
        Number(s.bbox.y + s.bbox.height),
      ];
      if (rect.some((n) => !Number.isFinite(n))) {
        console.warn('Skipping span with invalid bbox:', s);
        continue;
      }
      try {
        const annot = page.createAnnotation('Redact');
        annot.setRect(rect);
      } catch (e) {
        console.error('Failed to create Redact annotation for span:', s, e);
      }
    }
    const drawBlackBox = opts.mode === 'redact';
    const imageMethod = opts.mode === 'redact' ? 1 : 0;
    try {
      page.applyRedactions(drawBlackBox, imageMethod);
    } catch (e) {
      console.error(`Failed to applyRedactions on page ${pageNum}:`, e);
      throw e;
    }

    // Step 2 (sandbox only): Add FreeText annotations with replacement text.
    if (opts.mode === 'sandbox') {
      for (const s of pageSpans) {
        // Type-guard: replacement must be a non-empty string. mupdf's setContents
        // throws "Cannot pass non-string to std::string" if anything else slips through.
        if (typeof s.replacement !== 'string' || s.replacement.length === 0) continue;
        const rect = [
          Number(s.bbox.x),
          Number(s.bbox.y),
          Number(s.bbox.x + s.bbox.width),
          Number(s.bbox.y + s.bbox.height),
        ];
        if (rect.some((n) => !Number.isFinite(n))) {
          console.warn('Skipping sandbox span with invalid bbox:', s);
          continue;
        }
        try {
          const ft = page.createAnnotation('FreeText');
          ft.setRect(rect);
          ft.setContents(String(s.replacement));
          ft.setColor([0, 0, 0]);
          // Some mupdf builds want a default appearance set explicitly so update() can render.
          if (typeof ft.setDefaultAppearance === 'function') {
            try {
              ft.setDefaultAppearance('Helv', 9, [0, 0, 0]);
            } catch {
              /* not fatal */
            }
          }
          ft.update();
        } catch (e) {
          console.error(
            'Failed to add FreeText annotation for replacement:',
            { text: s.text, replacement: s.replacement, type: typeof s.replacement },
            e,
          );
        }
      }
    }
  }

  const out = doc.save();
  doc.close();
  return out;
}
