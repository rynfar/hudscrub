import { describe, it, expect } from 'vitest';
import { stableSeed } from '../../src/mapping/stable-seed.js';

describe('stableSeed', () => {
  it('is deterministic for the same input + salt', () => {
    expect(stableSeed('hello', 'salt')).toBe(stableSeed('hello', 'salt'));
  });
  it('differs for different input', () => {
    expect(stableSeed('hello', 'salt')).not.toBe(stableSeed('world', 'salt'));
  });
  it('differs for different salt', () => {
    expect(stableSeed('hello', 'salt1')).not.toBe(stableSeed('hello', 'salt2'));
  });
  it('returns a non-negative integer', () => {
    const v = stableSeed('test', 'salt');
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});
