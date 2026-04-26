'use client';
import type { Detector, Span, SpanLabel, SpanSource } from '@/src/types';
import type { ProgressCallback } from '@/src/detection/ner/progress';
import {
  loadWebLlmEngine,
  generateJson,
  type WebLlmModelKey,
} from './webllm-client';
import { COMBINED_SYSTEM, parseCombined } from './prompts';

const randomUUID = (): string => crypto.randomUUID();

interface CompactIndex {
  compact: string;
  positions: number[];
}

interface Match {
  start: number;
  end: number;
  matchedText: string;
}

function buildCompactIndex(source: string): CompactIndex {
  const positions: number[] = [];
  let compact = '';
  for (let i = 0; i < source.length; i++) {
    if (!/\s/.test(source[i])) {
      positions.push(i);
      compact += source[i];
    }
  }
  return { compact, positions };
}

function findChunkInCompact(
  index: CompactIndex,
  chunk: string,
  fromCompactIdx: number,
): { start: number; end: number; compactStart: number; compactLen: number } | null {
  const compactNeedle = chunk.replace(/\s+/g, '');
  if (compactNeedle.length < 2) return null;
  const compactIdx = index.compact.indexOf(compactNeedle, fromCompactIdx);
  if (compactIdx < 0) return null;
  const start = index.positions[compactIdx];
  const endChar = index.positions[compactIdx + compactNeedle.length - 1];
  if (endChar === undefined) return null;
  return { start, end: endChar + 1, compactStart: compactIdx, compactLen: compactNeedle.length };
}

/**
 * Locate an entity in source text. Returns ALL matches.
 *
 * The model often deduplicates its output (a borrower's address that appears
 * three times — under C., under D. as the seller's, and under F. as the
 * property — is returned once). We still need to redact every occurrence.
 *
 * Strategy depends on the needle's shape:
 *
 *   - **Single-chunk needles** (names like "Robert T. Johnson"): try exact
 *     match, then whitespace-tolerant contiguous match. Both find every
 *     occurrence on the page.
 *
 *   - **Multi-chunk needles** (addresses with commas or multi-space gaps):
 *     ALWAYS use chunked matching. Each chunk is located independently and
 *     emitted as its own span. This avoids two failure modes of a single
 *     contiguous bounding match:
 *       (a) Multi-line addresses produce a bbox that unions text items
 *           across multiple visual lines — the resulting rectangle is
 *           absurdly tall and the in-place replacement text renders huge.
 *       (b) Two-column layouts interleave the columns, so the bounding
 *           range covers the other column's address too and the merge step
 *           drops one of them.
 *     Per-chunk spans are naturally bound to one line each.
 */
function locateInText(source: string, needle: string): Match[] {
  const trimmed = needle.trim();
  if (trimmed.length < 2) return [];

  // Decide shape: split on commas or runs of 2+ spaces. A name like
  // "Robert T. Johnson" has only single spaces and produces 1 chunk.
  // An address like "1428 Oak Hollow Lane Sandy, UT 84092" produces 3.
  const rawChunks = trimmed.split(/,|\s{2,}/);
  const chunks = rawChunks.map((c) => c.trim()).filter((c) => c.replace(/\s+/g, '').length >= 3);

  const index = buildCompactIndex(source);

  if (chunks.length >= 2) {
    return chunkedMatches(source, chunks, index);
  }

  // Single-chunk: exact match first (fastest), then whitespace-tolerant.
  const exactMatches: Match[] = [];
  {
    let from = 0;
    while (from <= source.length) {
      const found = source.indexOf(trimmed, from);
      if (found < 0) break;
      exactMatches.push({ start: found, end: found + trimmed.length, matchedText: trimmed });
      from = found + trimmed.length;
    }
  }
  if (exactMatches.length > 0) return exactMatches;

  const contiguousMatches: Match[] = [];
  let cursor = 0;
  while (cursor < index.compact.length) {
    const found = findChunkInCompact(index, trimmed, cursor);
    if (!found) break;
    contiguousMatches.push({
      start: found.start,
      end: found.end,
      matchedText: source.slice(found.start, found.end),
    });
    cursor = found.compactStart + found.compactLen;
  }
  return contiguousMatches;
}

/**
 * Locate every occurrence of an N-chunk needle in source. For each occurrence
 * we find chunks in sequence (cursor advances within the occurrence), then
 * restart the search from past the last chunk to find the next occurrence.
 * Each chunk becomes its own Match — they get bbox'd as separate single-line
 * spans by the caller.
 */
function chunkedMatches(source: string, chunks: string[], index: CompactIndex): Match[] {
  const out: Match[] = [];
  let occurrenceStart = 0;
  while (occurrenceStart < index.compact.length) {
    const occurrence: Match[] = [];
    let localCursor = occurrenceStart;
    let advancedTo = occurrenceStart;
    for (const chunk of chunks) {
      const found = findChunkInCompact(index, chunk, localCursor);
      if (!found) {
        occurrence.length = 0;
        break;
      }
      occurrence.push({
        start: found.start,
        end: found.end,
        matchedText: source.slice(found.start, found.end),
      });
      localCursor = found.compactStart + found.compactLen;
      advancedTo = localCursor;
    }
    if (occurrence.length === 0) break;
    // Require at least 2 chunks per occurrence; otherwise we're guessing.
    if (occurrence.length >= 2) out.push(...occurrence);
    occurrenceStart = advancedTo;
  }
  return out;
}

export interface WebLlmDetectorOptions {
  modelKey: WebLlmModelKey;
}

export class WebLlmDetector implements Detector {
  readonly name: string;
  private engine: unknown = null;
  private modelKey: WebLlmModelKey;

  constructor(opts: WebLlmDetectorOptions) {
    this.modelKey = opts.modelKey;
    this.name = `webllm:${opts.modelKey}`;
  }

  async ensureLoaded(onProgress?: ProgressCallback): Promise<void> {
    if (this.engine) return;
    this.engine = await loadWebLlmEngine(this.modelKey, onProgress);
  }

  async detect(text: string, _alreadyFound: Span[]): Promise<Span[]> {
    if (!text || text.trim().length === 0) return [];
    if (!this.engine) await this.ensureLoaded();
    const out: Span[] = [];
    let combined: { names: string[]; addresses: string[] } = { names: [], addresses: [] };
    try {
      const json = await generateJson(this.engine, COMBINED_SYSTEM, text);
      combined = parseCombined(json);
    } catch (e) {
      console.warn(`WebLLM ${this.modelKey} combined pass failed:`, e);
      return out;
    }
    const buckets: { values: string[]; source: SpanSource; label: SpanLabel }[] = [
      { values: combined.names, source: 'llm-names', label: 'NAME' },
      { values: combined.addresses, source: 'llm-addresses', label: 'ADDRESS' },
    ];
    for (const { values, source, label } of buckets) {
      for (const value of values) {
        const matches = locateInText(text, value);
        for (const m of matches) {
          out.push({
            id: randomUUID(),
            source,
            label,
            text: m.matchedText,
            start: m.start,
            end: m.end,
            bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
            confidence: 0.85,
            decision: 'accepted',
          });
        }
      }
    }
    return out;
  }
}
