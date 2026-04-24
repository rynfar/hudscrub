import { describe, it, expect } from 'vitest';
import { verifyDollarPreservation } from '../../src/output/dollar-verifier.js';

describe('verifyDollarPreservation', () => {
  it('passes when input and output have identical dollar multisets', () => {
    const input = ['fee $1,234.56 and tax $50.00'];
    const output = ['xxx $1,234.56 yyy $50.00'];
    const r = verifyDollarPreservation(input, output);
    expect(r.ok).toBe(true);
  });

  it('passes when same dollar appears multiple times', () => {
    const input = ['$100 $100 $100'];
    const output = ['xx $100 yy $100 zz $100'];
    expect(verifyDollarPreservation(input, output).ok).toBe(true);
  });

  it('fails when a dollar amount goes missing', () => {
    const input = ['fee $1,234.56'];
    const output = ['fee'];
    const r = verifyDollarPreservation(input, output);
    expect(r.ok).toBe(false);
    expect(r.diffs[0].missing).toContain('$1,234.56');
  });

  it('fails when an extra dollar appears in output', () => {
    const input = [''];
    const output = ['surprise $99.00'];
    const r = verifyDollarPreservation(input, output);
    expect(r.ok).toBe(false);
    expect(r.diffs[0].extra).toContain('$99.00');
  });

  it('reports per-page diffs', () => {
    const input = ['$1.00', '$2.00'];
    const output = ['$1.00', ''];
    const r = verifyDollarPreservation(input, output);
    expect(r.ok).toBe(false);
    expect(r.diffs.find((d) => d.pageNum === 1)?.missing).toContain('$2.00');
  });

  it('errors when page counts differ', () => {
    expect(() => verifyDollarPreservation(['a'], ['a', 'b'])).toThrow();
  });
});
