'use client';
import type { ModelId } from '@/src/store/settings-store';
import { loadTransformersNer } from '@/src/detection/ner/transformers-loader';

export interface InstallProgress {
  status: 'downloading' | 'unpacking' | 'ready' | 'error';
  progress: number; // 0–1
  message?: string;
}

/**
 * Download a model so it's cached locally for fast startup later.
 * Currently only `bert-ner` has a real loader; WebLLM models (phi/gemma/qwen)
 * are recognized but report "not yet implemented" rather than silently failing.
 */
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
        onProgress({
          status: 'downloading',
          progress: p.progress,
          message: p.message,
        });
      } else if (p.status === 'initializing') {
        onProgress({ status: 'unpacking', progress: p.progress, message: p.message });
      } else if (p.status === 'ready') {
        onProgress({ status: 'ready', progress: 1.0 });
      }
    });
    return;
  }
  // Phi/Gemma/Qwen: WebLLM integration deferred to Plan 4
  onProgress({
    status: 'error',
    progress: 0,
    message: `${id} requires WebLLM, which is coming in the next release. The Fast model will be used as a fallback for now.`,
  });
  throw new Error('WebLLM models not yet implemented');
}
