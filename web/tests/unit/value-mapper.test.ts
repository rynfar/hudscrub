import { describe, it, expect, beforeEach } from 'vitest';
import { ValueMapper } from '../../src/mapping/value-mapper.js';

describe('ValueMapper', () => {
  let m: ValueMapper;
  beforeEach(() => {
    m = new ValueMapper(42);
  });

  describe('determinism', () => {
    it('same original always maps to same fake within an instance', () => {
      const a = m.mapValue('SSN', '123-45-6789');
      const b = m.mapValue('SSN', '123-45-6789');
      expect(a).toBe(b);
    });
    it('two instances with same seed produce same fakes', () => {
      const m1 = new ValueMapper(42);
      const m2 = new ValueMapper(42);
      expect(m1.mapValue('SSN', '123-45-6789')).toBe(m2.mapValue('SSN', '123-45-6789'));
    });
  });

  describe('SSN', () => {
    it('uses 900-range (test-reserved)', () => {
      const fake = m.mapValue('SSN', '123-45-6789');
      expect(fake).toMatch(/^9\d{2}-\d{2}-\d{4}$/);
    });
  });

  describe('EIN', () => {
    it('produces XX-XXXXXXX format', () => {
      const fake = m.mapValue('EIN', '12-3456789');
      expect(fake).toMatch(/^\d{2}-\d{7}$/);
    });
  });

  describe('PHONE', () => {
    it('preserves separator style with parentheses', () => {
      const fake = m.mapValue('PHONE', '(555) 123-4567');
      expect(fake).toMatch(/^\(555\) 555-\d{4}$/);
    });
    it('preserves dash style', () => {
      const fake = m.mapValue('PHONE', '555-123-4567');
      expect(fake).toMatch(/^555-555-\d{4}$/);
    });
    it('preserves dot style', () => {
      const fake = m.mapValue('PHONE', '555.123.4567');
      expect(fake).toMatch(/^555\.555\.\d{4}$/);
    });
    it('always uses 555 area code and exchange', () => {
      const fake = m.mapValue('PHONE', '(212) 555-1212');
      expect(fake).toContain('555');
    });
  });

  describe('EMAIL', () => {
    it('uses example.com', () => {
      const fake = m.mapValue('EMAIL', 'someone@gmail.com');
      expect(fake).toMatch(/^user\d{4}@example\.com$/);
    });
  });

  describe('DATE', () => {
    it('preserves separator', () => {
      const slash = m.mapValue('DATE', '07/15/2024');
      const dash = m.mapValue('DATE', '07-15-2024');
      expect(slash).toContain('/');
      expect(dash).toContain('-');
    });
    it('shifts all dates by the same offset (preserves relative order)', () => {
      const a = m.mapValue('DATE', '01/15/2024');
      const b = m.mapValue('DATE', '02/15/2024');
      const parse = (s: string) => {
        const [mm, dd, yy] = s.split(/[/-]/).map(Number);
        return new Date(yy, mm - 1, dd).getTime();
      };
      expect(parse(b) - parse(a)).toBeGreaterThan(0);
    });
  });

  describe('LOAN_NUM', () => {
    it('preserves length and character classes', () => {
      const original = 'SMH-2024-88421';
      const fake = m.mapValue('LOAN_NUM', original);
      expect(fake.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        const o = original[i];
        const f = fake[i];
        if (/\d/.test(o)) expect(/\d/.test(f)).toBe(true);
        else if (/[A-Z]/.test(o)) expect(/[A-Z]/.test(f)).toBe(true);
        else expect(f).toBe(o);
      }
    });
  });

  describe('ZIP', () => {
    it('preserves 5 vs 9 digit format', () => {
      expect(m.mapValue('ZIP', '84341')).toMatch(/^\d{5}$/);
      expect(m.mapValue('ZIP', '84341-1234')).toMatch(/^\d{5}-\d{4}$/);
    });
  });

  describe('NAME', () => {
    it('produces a non-empty fake name', () => {
      const fake = m.mapValue('NAME', 'Maria L. Garcia');
      expect(fake.length).toBeGreaterThan(0);
      expect(fake).not.toBe('Maria L. Garcia');
    });
  });

  describe('ADDRESS', () => {
    it('produces a non-empty fake address', () => {
      const fake = m.mapValue('ADDRESS', '1428 Oak Hollow Lane');
      expect(fake.length).toBeGreaterThan(0);
    });
  });

  describe('mapCustom', () => {
    it('stores and returns the user-supplied replacement', () => {
      m.mapCustom('John Smith', 'Alex Doe');
      expect(m.mapValue('CUSTOM', 'John Smith')).toBe('Alex Doe');
    });
  });

  describe('forbidden', () => {
    it('mapValue throws on DOLLAR', () => {
      expect(() => m.mapValue('DOLLAR', '$100')).toThrow(/DOLLAR/i);
    });
  });

  describe('getMappingReport', () => {
    it('returns only categories with at least one mapping', () => {
      m.mapValue('SSN', '111-11-1111');
      const r = m.getMappingReport();
      expect(r.SSN).toBeDefined();
      expect(r.EIN).toBeUndefined();
    });
  });
});
