import { describe, it, expect } from 'vitest';
import { mapNerTag } from '../../src/detection/ner/label-map.js';

describe('mapNerTag', () => {
  it('maps person tags to NAME', () => {
    expect(mapNerTag('B-PER')).toBe('NAME');
    expect(mapNerTag('I-PER')).toBe('NAME');
  });
  it('maps location tags to ADDRESS', () => {
    expect(mapNerTag('B-LOC')).toBe('ADDRESS');
    expect(mapNerTag('I-LOC')).toBe('ADDRESS');
  });
  it('maps organization tags to OTHER', () => {
    expect(mapNerTag('B-ORG')).toBe('OTHER');
  });
  it('maps misc tags to OTHER', () => {
    expect(mapNerTag('B-MISC')).toBe('OTHER');
  });
  it('returns null for outside tag', () => {
    expect(mapNerTag('O')).toBeNull();
  });
  it('returns null for unknown tags', () => {
    expect(mapNerTag('B-WHAT')).toBeNull();
  });
});
