'use client';
import { detectPage } from '@/src/detection/index';
import { RegexDetector } from '@/src/detection/detectors/regex-detector';
import { NerDetector } from '@/src/detection/ner/ner-detector';
import { loadTransformersNer } from '@/src/detection/ner/transformers-loader';
import { WebLlmDetector } from '@/src/llm/webllm-detector';
import type { Span, Detector } from '@/src/types';
import type { RenderedPage } from '@/src/pdf/browser-renderer';
import type { ModelId } from '@/src/store/settings-store';

let nerSingleton: NerDetector | null = null;
const webllmSingletons: Partial<Record<ModelId, WebLlmDetector>> = {};

const WEBLLM_KEYS: ReadonlyArray<ModelId> = ['phi-3.5-mini', 'gemma-2-2b', 'qwen-2.5-7b'];

export async function getDetectors(opts: {
  selectedModel: ModelId;
  onLoadProgress?: (p: number) => void;
}): Promise<Detector[]> {
  const out: Detector[] = [new RegexDetector()];
  if (opts.selectedModel === 'bert-ner') {
    if (!nerSingleton) {
      nerSingleton = new NerDetector({ loader: loadTransformersNer });
    }
    await nerSingleton.ensureLoaded((p) => {
      if (p.status === 'downloading' && opts.onLoadProgress) opts.onLoadProgress(p.progress);
    });
    out.push(nerSingleton);
  } else if (WEBLLM_KEYS.includes(opts.selectedModel)) {
    let detector = webllmSingletons[opts.selectedModel];
    if (!detector) {
      detector = new WebLlmDetector({
        modelKey: opts.selectedModel as 'phi-3.5-mini' | 'gemma-2-2b' | 'qwen-2.5-7b',
      });
      webllmSingletons[opts.selectedModel] = detector;
    }
    await detector.ensureLoaded((p) => {
      if (opts.onLoadProgress) opts.onLoadProgress(p.progress);
    });
    out.push(detector);
  }
  // 'regex-only' or unknown: return regex only
  return out;
}

interface Entry {
  item: RenderedPage['textItems'][number];
  start: number;
  end: number;
}

function pageToBboxLookup(page: RenderedPage) {
  const entries: Entry[] = [];
  let cursor = 0;
  for (const it of page.textItems) {
    entries.push({ item: it, start: cursor, end: cursor + it.str.length });
    cursor += it.str.length + 1;
  }
  return (start: number, end: number) => {
    const overlapping = entries.filter((e) => e.start < end && start < e.end);
    if (overlapping.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const o of overlapping) {
      const t = o.item.transform;
      const x = t[4];
      const yBaseline = t[5];
      const w = o.item.width;
      const h = o.item.height || 12;
      const yTop = yBaseline - h;
      minX = Math.min(minX, x);
      minY = Math.min(minY, yTop);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, yTop + h);
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };
}

export async function detectDocument(
  pages: RenderedPage[],
  detectors: Detector[],
  onPageDone: (pageNum: number, spans: Span[]) => void,
): Promise<void> {
  for (const page of pages) {
    const detected = await detectPage(page.text, detectors);
    const lookup = pageToBboxLookup(page);
    const spansWithBoxes: Span[] = [];
    for (const s of detected) {
      const bb = lookup(s.start, s.end);
      if (!bb) continue;
      spansWithBoxes.push({ ...s, bbox: { ...bb, pageNum: page.pageNum } });
    }
    onPageDone(page.pageNum, spansWithBoxes);
    await new Promise((r) => setTimeout(r, 0));
  }
}
