import { describe, it, expect, vi } from 'vitest';
import { NerDetector } from '../../src/detection/ner/ner-detector.js';
import type { TokenEntity } from '../../src/detection/ner/alignment.js';

const makePipeline = (output: TokenEntity[]) => vi.fn(async (_text: string) => output);

describe('NerDetector', () => {
  it('returns Spans built from grouped NER output', async () => {
    const stub = makePipeline([
      { word: 'Maria', entity: 'B-PER', start: 0, end: 5, score: 0.99 },
      { word: 'Garcia', entity: 'I-PER', start: 6, end: 12, score: 0.97 },
    ]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('Maria Garcia signed', []);
    expect(spans).toHaveLength(1);
    expect(spans[0].label).toBe('NAME');
    expect(spans[0].text).toBe('Maria Garcia');
    expect(spans[0].source).toBe('llm-names');
    expect(spans[0].confidence).toBeGreaterThan(0.9);
  });

  it('skips spans below the score threshold', async () => {
    const stub = makePipeline([
      { word: 'Bob', entity: 'B-PER', start: 0, end: 3, score: 0.3 },
    ]);
    const d = new NerDetector({ loader: async () => stub, minScore: 0.5 });
    await d.ensureLoaded();
    const spans = await d.detect('Bob', []);
    expect(spans).toHaveLength(0);
  });

  it('emits llm-addresses source for LOC entities', async () => {
    const stub = makePipeline([
      { word: 'Boston', entity: 'B-LOC', start: 0, end: 6, score: 0.95 },
    ]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('Boston is a city', []);
    expect(spans[0].source).toBe('llm-addresses');
    expect(spans[0].label).toBe('ADDRESS');
  });

  it('emits llm-other source for ORG entities', async () => {
    const stub = makePipeline([
      { word: 'Acme', entity: 'B-ORG', start: 0, end: 4, score: 0.95 },
    ]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('Acme Corp', []);
    expect(spans[0].source).toBe('llm-other');
    expect(spans[0].label).toBe('OTHER');
  });

  it('returns [] for empty text', async () => {
    const stub = makePipeline([]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('', []);
    expect(spans).toEqual([]);
  });

  it('reports load progress to the callback', async () => {
    const stub = makePipeline([]);
    const progressLog: number[] = [];
    const d = new NerDetector({
      loader: async (onProgress) => {
        onProgress?.({ status: 'downloading', progress: 0.5, downloaded: 50, total: 100 });
        onProgress?.({ status: 'ready', progress: 1.0, downloaded: 100, total: 100 });
        return stub;
      },
    });
    await d.ensureLoaded((p) => progressLog.push(p.progress));
    expect(progressLog).toContain(0.5);
    expect(progressLog).toContain(1.0);
  });
});
