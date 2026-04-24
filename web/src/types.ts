export type SpanLabel =
  | 'SSN'
  | 'EIN'
  | 'PHONE'
  | 'EMAIL'
  | 'DATE'
  | 'LOAN_NUM'
  | 'ZIP'
  | 'NAME'
  | 'ADDRESS'
  | 'DOLLAR'
  | 'CUSTOM'
  | 'OTHER';

export type SpanSource =
  | 'regex'
  | 'llm-names'
  | 'llm-addresses'
  | 'llm-other'
  | 'manual';

export type SpanDecision = 'pending' | 'accepted' | 'rejected';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNum: number;
}

export interface Span {
  id: string;
  source: SpanSource;
  label: SpanLabel;
  text: string;
  start: number;
  end: number;
  bbox: BBox;
  confidence: number;
  decision: SpanDecision;
  replacement?: string;
}

export interface ProcessReport {
  counts: Record<string, number>;
  replacements: Array<{ label: string; original: string; replacement: string }>;
  dollarsSeen: number;
}

export interface Detector {
  readonly name: string;
  detect(text: string, alreadyFound: Span[]): Promise<Span[]>;
}

export type Mode = 'redact' | 'sandbox';
