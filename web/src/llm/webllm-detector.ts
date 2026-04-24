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
        // Find character offsets via best-effort indexOf (model emits text only)
        const start = text.indexOf(e.text);
        if (start < 0) continue;
        // Filter hallucinated overlaps with already-found spans
        const end = start + e.text.length;
        out.push({
          id: randomUUID(),
          source: pass.source,
          label: pass.label,
          text: e.text,
          start,
          end,
          bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
          confidence: 0.85,
          decision: 'pending',
        });
      }
    }
    return out;
  }
}
