import type * as mupdf from 'mupdf';
import type { BBox } from '../types';

interface LineEntry {
  text: string;
  textStart: number;
  textEnd: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface PageExtraction {
  text: string;
  pageNum: number;
  bboxAt(charOffset: number): BBox | undefined;
  bboxRange(start: number, end: number): BBox | undefined;
}

export function extractPage(page: mupdf.PDFPage, pageNum = 0): PageExtraction {
  const json = (page.toStructuredText() as { asJSON(): string }).asJSON();
  const parsed = JSON.parse(json) as {
    blocks?: Array<{ type: string; lines?: Array<{ text: string; bbox: { x: number; y: number; w: number; h: number } }> }>;
  };

  const lines: LineEntry[] = [];
  let text = '';

  for (const block of parsed.blocks ?? []) {
    if (block.type !== 'text') continue;
    for (const line of block.lines ?? []) {
      const start = text.length;
      const lineText = line.text ?? '';
      lines.push({
        text: lineText,
        textStart: start,
        textEnd: start + lineText.length,
        bbox: line.bbox,
      });
      text += lineText + '\n';
    }
  }

  function findLineIndex(off: number): number {
    for (let i = 0; i < lines.length; i++) {
      if (off >= lines[i].textStart && off <= lines[i].textEnd) return i;
    }
    return -1;
  }

  function lineSubBbox(line: LineEntry, charStart: number, charEnd: number): BBox {
    const len = Math.max(line.text.length, 1);
    const relStart = Math.max(0, charStart - line.textStart);
    const relEnd = Math.min(len, charEnd - line.textStart);
    const fracStart = relStart / len;
    const fracEnd = relEnd / len;
    const x = line.bbox.x + line.bbox.w * fracStart;
    const w = Math.max(1, line.bbox.w * (fracEnd - fracStart));
    return {
      x,
      y: line.bbox.y,
      width: w,
      height: line.bbox.h,
      pageNum,
    };
  }

  return {
    text,
    pageNum,
    bboxAt(off: number): BBox | undefined {
      const idx = findLineIndex(off);
      if (idx < 0) return undefined;
      return lineSubBbox(lines[idx], off, off + 1);
    },
    bboxRange(start: number, end: number): BBox | undefined {
      const startIdx = findLineIndex(start);
      const endIdx = findLineIndex(Math.max(start, end - 1));
      if (startIdx < 0 || endIdx < 0) return undefined;
      if (startIdx === endIdx) {
        return lineSubBbox(lines[startIdx], start, end);
      }
      const a = lineSubBbox(lines[startIdx], start, lines[startIdx].textEnd);
      const b = lineSubBbox(lines[endIdx], lines[endIdx].textStart, end);
      const x1 = Math.min(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const x2 = Math.max(a.x + a.width, b.x + b.width);
      const y2 = Math.max(a.y + a.height, b.y + b.height);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, pageNum };
    },
  };
}
