import type { NerPipelineFn } from './ner-detector';
import type { ProgressCallback } from './progress';
import type { TokenEntity } from './alignment';

const MODEL_ID = 'Xenova/bert-base-NER';

interface RawNerToken {
  word: string;
  entity: string;
  score: number;
  index?: number;
  start?: number;
  end?: number;
}

/**
 * Compute character offsets for tokens whose pipeline output didn't include them.
 * Uses a forward-scanning cursor over the source text, accounting for BERT-style
 * subword continuations (tokens prefixed with "##").
 */
function attachOffsets(text: string, tokens: RawNerToken[]): TokenEntity[] {
  const result: TokenEntity[] = [];
  let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Already has offsets — pass through.
    if (t.start !== undefined && t.end !== undefined) {
      result.push({
        word: t.word,
        entity: t.entity,
        start: t.start,
        end: t.end,
        score: t.score,
      });
      cursor = Math.max(cursor, t.end);
      continue;
    }
    const cleanWord = t.word.startsWith('##') ? t.word.slice(2) : t.word;
    if (!cleanWord) continue;
    const idx = text.indexOf(cleanWord, cursor);
    if (idx < 0) continue;
    result.push({
      word: cleanWord,
      entity: t.entity,
      start: idx,
      end: idx + cleanWord.length,
      score: t.score,
    });
    cursor = idx + cleanWord.length;
  }
  return result;
}

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
    const result = (await ner(text)) as RawNerToken[];
    return attachOffsets(text, result);
  };
}
