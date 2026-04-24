'use client';
import type { ProgressCallback } from '@/src/detection/ner/progress';

// WebLLM model IDs available in @mlc-ai/web-llm 0.2.x prebuilt catalog
export const WEBLLM_MODEL_IDS = {
  'phi-3.5-mini': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'gemma-2-2b': 'gemma-2-2b-it-q4f16_1-MLC',
  'qwen-2.5-7b': 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
} as const;

export type WebLlmModelKey = keyof typeof WEBLLM_MODEL_IDS;

interface CachedEngine {
  modelKey: WebLlmModelKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: any;
}

let cached: CachedEngine | null = null;

export async function loadWebLlmEngine(
  modelKey: WebLlmModelKey,
  onProgress?: ProgressCallback,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (cached && cached.modelKey === modelKey) {
    onProgress?.({ status: 'ready', progress: 1.0 });
    return cached.engine;
  }
  const modelId = WEBLLM_MODEL_IDS[modelKey];
  if (typeof modelId !== 'string' || modelId.length === 0) {
    throw new Error(
      `WebLLM model key "${modelKey}" has no valid model ID — likely a stale settings value. Pick a model again in Settings.`,
    );
  }
  const mlc = await import('@mlc-ai/web-llm');

  const engine = await mlc.CreateMLCEngine(modelId, {
    initProgressCallback: (p) => {
      // p.progress is 0-1, p.text describes phase
      if (!onProgress) return;
      const text = p.text ?? '';
      const isFetch = /Fetching|Downloading/i.test(text);
      const isLoad = /Loading|Initializing|GPU/i.test(text);
      onProgress({
        status: isFetch ? 'downloading' : isLoad ? 'initializing' : 'downloading',
        progress: typeof p.progress === 'number' ? p.progress : 0,
        message: text,
      });
    },
  });

  cached = { modelKey, engine };
  onProgress?.({ status: 'ready', progress: 1.0 });
  return engine;
}

export async function generateJson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: any,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  // NOTE: Intentionally no `response_format`. WebLLM's grammar-constrained JSON
  // mode requires a schema string for some model libs (e.g. Gemma 2) and throws
  // "Cannot pass non-string to std::string" at the WASM boundary if it's missing.
  // Our prompts already instruct {"entities": [...]} output and we tolerate
  // parse failures gracefully in parseEntities().
  const sys = typeof systemPrompt === 'string' ? systemPrompt : '';
  const usr = typeof userPrompt === 'string' ? userPrompt : '';
  if (sys.length === 0 || usr.length === 0) return '';
  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    temperature: 0.1,
    max_tokens: 800,
  });
  return reply.choices[0]?.message?.content ?? '';
}
