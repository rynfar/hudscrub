import type { SpanLabel } from '../../types.js';

const MAPPING: Record<string, SpanLabel> = {
  PER: 'NAME',
  LOC: 'ADDRESS',
  ORG: 'OTHER',
  MISC: 'OTHER',
};

export function mapNerTag(tag: string): SpanLabel | null {
  if (tag === 'O') return null;
  const stripped = tag.replace(/^[BI]-/, '');
  return MAPPING[stripped] ?? null;
}
