'use client';
import type { Detector, Span, SpanLabel, SpanSource } from '@/src/types';
import type { ProgressCallback } from '@/src/detection/ner/progress';
import {
  loadWebLlmEngine,
  generateJson,
  type WebLlmModelKey,
} from './webllm-client';
import {
  NAMES_SYSTEM,
  ADDRESSES_SYSTEM,
  parseEntities,
  type ExtractedEntity,
} from './prompts';

interface PassConfig {
  source: SpanSource;
  label: SpanLabel;
  systemPrompt: string;
}

const PASSES: PassConfig[] = [
  { source: 'llm-names', label: 'NAME', systemPrompt: NAMES_SYSTEM },
  { source: 'llm-addresses', label: 'ADDRESS', systemPrompt: ADDRESSES_SYSTEM },
];

const randomUUID = (): string => crypto.randomUUID();

/**
 * Find an entity's substring in source text with tolerance for whitespace differences.
 * PDF.js joins text items with spaces that may not match the model's output exactly.
 * Strategy: try exact match first, then collapse all whitespace runs to single spaces
 * on both sides and search again, then return the original-text slice at that position.
 */
function locateInText(
  source: string,
  needle: string,
): { start: number; end: number; matchedText: string } | null {
  const trimmed = needle.trim();
  if (trimmed.length < 2) return null;

  // Exact match — fastest path
  const exact = source.indexOf(trimmed);
  if (exact >= 0) {
    return { start: exact, end: exact + trimmed.length, matchedText: trimmed };
  }

  // Whitespace-tolerant match: normalize both sides and find position in the
  // original text by walking and counting non-whitespace characters.
  const needleCompact = trimmed.replace(/\s+/g, '');
  if (needleCompact.length < 2) return null;

  // Build a map: index in compact form → index in original
  const positions: number[] = [];
  let compact = '';
  for (let i = 0; i < source.length; i++) {
    if (!/\s/.test(source[i])) {
      positions.push(i);
      compact += source[i];
    }
  }
  const compactIdx = compact.indexOf(needleCompact);
  if (compactIdx < 0) return null;
  const start = positions[compactIdx];
  const endChar = positions[compactIdx + needleCompact.length - 1];
  if (endChar === undefined) return null;
  const end = endChar + 1;
  return { start, end, matchedText: source.slice(start, end) };
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
    for (const pass of PASSES) {
      let entities: ExtractedEntity[] = [];
      try {
        const json = await generateJson(this.engine, pass.systemPrompt, text);
        entities = parseEntities(json);
      } catch (e) {
        console.warn(`WebLLM ${this.modelKey} ${pass.source} pass failed:`, e);
        continue;
      }
      for (const e of entities) {
        const located = locateInText(text, e.text);
        if (!located) continue;
        out.push({
          id: randomUUID(),
          source: pass.source,
          label: pass.label,
          text: located.matchedText,
          start: located.start,
          end: located.end,
          bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
          confidence: 0.85,
          decision: 'accepted',
        });
      }
    }
    return out;
  }
}
