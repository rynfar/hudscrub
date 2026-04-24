'use client';
import type { ModelId } from '@/src/store/settings-store';
import { loadTransformersNer } from '@/src/detection/ner/transformers-loader';
import { loadWebLlmEngine, type WebLlmModelKey } from '@/src/llm/webllm-client';

export interface InstallProgress {
  status: 'downloading' | 'unpacking' | 'initializing' | 'ready' | 'error';
  progress: number;
  message?: string;
}

const WEBLLM_MODELS: ModelId[] = ['phi-3.5-mini', 'gemma-2-2b', 'qwen-2.5-7b'];

export async function installModel(
  id: ModelId,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  if (id === 'regex-only') {
    onProgress({ status: 'ready', progress: 1.0 });
    return;
  }
  if (id === 'bert-ner') {
    await loadTransformersNer((p) => {
      if (p.status === 'downloading') {
        onProgress({ status: 'downloading', progress: p.progress, message: p.message });
      } else if (p.status === 'initializing') {
        onProgress({ status: 'initializing', progress: p.progress, message: p.message });
      } else if (p.status === 'ready') {
        onProgress({ status: 'ready', progress: 1.0 });
      }
    });
    return;
  }
  if (WEBLLM_MODELS.includes(id)) {
    await loadWebLlmEngine(id as WebLlmModelKey, (p) => {
      onProgress({
        status: p.status as InstallProgress['status'],
        progress: p.progress,
        message: p.message,
      });
    });
    return;
  }
  onProgress({ status: 'error', progress: 0, message: `Unknown model: ${id}` });
  throw new Error(`Unknown model: ${id}`);
}
