import { createHash } from 'node:crypto';

export function stableSeed(original: string, salt: string): number {
  const h = createHash('sha256').update(`${salt}::${original}`).digest('hex');
  return parseInt(h.slice(0, 13), 16);
}
