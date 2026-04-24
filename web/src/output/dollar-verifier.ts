import { findDollars } from '../detection/regex';

export interface PageDiff {
  pageNum: number;
  missing: string[];
  extra: string[];
}

export interface VerificationResult {
  ok: boolean;
  diffs: PageDiff[];
}

export function verifyDollarPreservation(
  inputPages: string[],
  outputPages: string[],
): VerificationResult {
  if (inputPages.length !== outputPages.length) {
    throw new Error(
      `Page count mismatch: input has ${inputPages.length} pages, output has ${outputPages.length}`,
    );
  }
  const diffs: PageDiff[] = [];
  let allOk = true;
  for (let i = 0; i < inputPages.length; i++) {
    const inputDollars = countMultiset(Array.from(findDollars(inputPages[i])).map((m) => m.text));
    const outputDollars = countMultiset(Array.from(findDollars(outputPages[i])).map((m) => m.text));
    const missing = computeDiff(inputDollars, outputDollars);
    const extra = computeDiff(outputDollars, inputDollars);
    if (missing.length || extra.length) {
      allOk = false;
      diffs.push({ pageNum: i, missing, extra });
    }
  }
  return { ok: allOk, diffs };
}

function countMultiset(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return m;
}

function computeDiff(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = [];
  for (const [k, count] of a) {
    const bCount = b.get(k) ?? 0;
    for (let i = 0; i < count - bCount; i++) out.push(k);
  }
  return out;
}
