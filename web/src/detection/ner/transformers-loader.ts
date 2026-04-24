import type { NerPipelineFn } from './ner-detector.js';
import type { ProgressCallback } from './progress.js';
import type { TokenEntity } from './alignment.js';

const MODEL_ID = 'Xenova/bert-base-NER';

export async function loadTransformersNer(
  onProgress?: ProgressCallback,
): Promise<NerPipelineFn> {
  const { pipeline } = await import('@huggingface/transformers');

  const progressCallback = (data: {
    status: string;
    progress?: number;
    loaded?: number;
    total?: number;
    file?: string;
  }) => {
    if (!onProgress) return;
    if (data.status === 'progress' && data.loaded !== undefined && data.total) {
      onProgress({
        status: 'downloading',
        progress: data.loaded / data.total,
        downloaded: data.loaded,
        total: data.total,
        message: data.file,
      });
    } else if (data.status === 'ready') {
      onProgress({ status: 'ready', progress: 1.0 });
    } else if (data.status === 'initiate') {
      onProgress({ status: 'initializing', progress: 0, message: data.file });
    }
  };

  const ner = await pipeline('token-classification', MODEL_ID, {
    progress_callback: progressCallback,
  } as Parameters<typeof pipeline>[2]);

  return async (text: string): Promise<TokenEntity[]> => {
    if (!text || text.trim().length === 0) return [];
    const result = (await ner(text)) as Array<{
      word: string;
      entity: string;
      start?: number;
      end?: number;
      score: number;
      index?: number;
    }>;
    return result
      .filter((r) => r.start !== undefined && r.end !== undefined)
      .map((r) => ({
        word: r.word,
        entity: r.entity,
        start: r.start as number,
        end: r.end as number,
        score: r.score,
      }));
  };
}
