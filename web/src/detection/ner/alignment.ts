import type { SpanLabel } from '../../types';
import { mapNerTag } from './label-map';

export interface TokenEntity {
  word: string;
  entity: string;
  start: number;
  end: number;
  score: number;
}

export interface GroupedEntity {
  text: string;
  label: SpanLabel;
  start: number;
  end: number;
  score: number;
}

export function groupBioTokens(tokens: TokenEntity[]): GroupedEntity[] {
  const groups: GroupedEntity[] = [];
  let cur: { tokens: TokenEntity[]; label: SpanLabel } | null = null;

  const flush = () => {
    if (!cur || cur.tokens.length === 0) return;
    const start = cur.tokens[0].start;
    const end = cur.tokens[cur.tokens.length - 1].end;
    const totalScore = cur.tokens.reduce((s, t) => s + t.score, 0);
    groups.push({
      text: cur.tokens.map((t) => t.word).join(' '),
      label: cur.label,
      start,
      end,
      score: totalScore / cur.tokens.length,
    });
    cur = null;
  };

  for (const t of tokens) {
    const label = mapNerTag(t.entity);
    if (!label) {
      flush();
      continue;
    }
    const isBegin = t.entity.startsWith('B-');
    if (isBegin || !cur || cur.label !== label) {
      flush();
      cur = { tokens: [t], label };
    } else {
      cur.tokens.push(t);
    }
  }
  flush();
  return groups;
}
