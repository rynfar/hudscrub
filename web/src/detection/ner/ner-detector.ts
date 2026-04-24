import type { Detector, Span, SpanLabel, SpanSource } from '../../types';
import { groupBioTokens, type TokenEntity } from './alignment';
import type { ProgressCallback } from './progress';

const randomUUID = (): string => crypto.randomUUID();

export type NerPipelineFn = (text: string) => Promise<TokenEntity[]>;

export interface NerDetectorOptions {
  loader: (onProgress?: ProgressCallback) => Promise<NerPipelineFn>;
  minScore?: number;
}

const SOURCE_BY_LABEL: Record<SpanLabel, SpanSource> = {
  NAME: 'llm-names',
  ADDRESS: 'llm-addresses',
  OTHER: 'llm-other',
  SSN: 'llm-other',
  EIN: 'llm-other',
  PHONE: 'llm-other',
  EMAIL: 'llm-other',
  DATE: 'llm-other',
  LOAN_NUM: 'llm-other',
  ZIP: 'llm-other',
  DOLLAR: 'llm-other',
  CUSTOM: 'manual',
};

export class NerDetector implements Detector {
  readonly name = 'ner';
  private opts: Required<NerDetectorOptions>;
  private pipeline: NerPipelineFn | null = null;

  constructor(opts: NerDetectorOptions) {
    this.opts = {
      minScore: 0.5,
      ...opts,
    };
  }

  async ensureLoaded(onProgress?: ProgressCallback): Promise<void> {
    if (this.pipeline) return;
    this.pipeline = await this.opts.loader(onProgress);
  }

  async detect(text: string, _alreadyFound: Span[]): Promise<Span[]> {
    if (!text) return [];
    if (!this.pipeline) await this.ensureLoaded();
    const tokens = await this.pipeline!(text);
    const grouped = groupBioTokens(tokens);
    const out: Span[] = [];
    for (const g of grouped) {
      if (g.score < this.opts.minScore) continue;
      out.push({
        id: randomUUID(),
        source: SOURCE_BY_LABEL[g.label],
        label: g.label,
        text: g.text,
        start: g.start,
        end: g.end,
        bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
        confidence: g.score,
        decision: 'accepted',
      });
    }
    return out;
  }
}
