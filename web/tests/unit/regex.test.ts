import { describe, it, expect } from 'vitest';
import {
  PATTERNS,
  DEFAULT_ENABLED,
  FORBIDDEN_FOR_MUTATION,
  findAll,
} from '../../src/detection/regex.js';

const test = (re: RegExp, s: string): boolean => new RegExp(re.source, re.flags.replace('g', '')).test(s);

describe('SSN pattern', () => {
  it('matches valid SSN format', () => {
    expect(test(PATTERNS.SSN, '123-45-6789')).toBe(true);
    expect(test(PATTERNS.SSN, 'Borrower SSN: 900-11-2233')).toBe(true);
  });
  it('rejects invalid formats', () => {
    expect(test(PATTERNS.SSN, '12-345-6789')).toBe(false);
    expect(test(PATTERNS.SSN, '1234567890')).toBe(false);
    expect(test(PATTERNS.SSN, '123456789')).toBe(false);
  });
});

describe('EIN pattern', () => {
  it('matches valid EIN', () => {
    expect(test(PATTERNS.EIN, '12-3456789')).toBe(true);
  });
  it('rejects invalid formats', () => {
    expect(test(PATTERNS.EIN, '123-45-6789')).toBe(false);
  });
});

describe('PHONE pattern', () => {
  it('matches several formats', () => {
    expect(test(PATTERNS.PHONE, '(555) 123-4567')).toBe(true);
    expect(test(PATTERNS.PHONE, '555-123-4567')).toBe(true);
    expect(test(PATTERNS.PHONE, '555.123.4567')).toBe(true);
    expect(test(PATTERNS.PHONE, '+1 555-123-4567')).toBe(true);
  });
  it('does not match short numbers', () => {
    expect(test(PATTERNS.PHONE, '123-456')).toBe(false);
  });
});

describe('EMAIL pattern', () => {
  it('matches valid emails', () => {
    expect(test(PATTERNS.EMAIL, 'user@example.com')).toBe(true);
    expect(test(PATTERNS.EMAIL, 'first.last+tag@sub.domain.co')).toBe(true);
  });
  it('rejects malformed', () => {
    expect(test(PATTERNS.EMAIL, 'not-an-email')).toBe(false);
    expect(test(PATTERNS.EMAIL, '@no-user.com')).toBe(false);
  });
});

describe('DATE pattern', () => {
  it('matches MM/DD/YYYY and MM-DD-YYYY', () => {
    expect(test(PATTERNS.DATE, '07/15/2024')).toBe(true);
    expect(test(PATTERNS.DATE, '7/5/2024')).toBe(true);
    expect(test(PATTERNS.DATE, '07-15-2024')).toBe(true);
  });
  it('rejects out-of-range', () => {
    expect(test(PATTERNS.DATE, '13/01/2024')).toBe(false);
    expect(test(PATTERNS.DATE, '01/32/2024')).toBe(false);
  });
});

describe('LOAN_NUM pattern', () => {
  it('matches with various prefixes', () => {
    expect(test(PATTERNS.LOAN_NUM, 'Loan No. SMH-2024-88421')).toBe(true);
    expect(test(PATTERNS.LOAN_NUM, 'Case # ABC123456')).toBe(true);
    expect(test(PATTERNS.LOAN_NUM, 'FHA: XYZ-7890123')).toBe(true);
  });
});

describe('ZIP pattern', () => {
  it('matches 5-digit and ZIP+4', () => {
    expect(test(PATTERNS.ZIP, '84341')).toBe(true);
    expect(test(PATTERNS.ZIP, '84341-1234')).toBe(true);
  });
});

describe('DOLLAR pattern', () => {
  it('matches various dollar formats', () => {
    expect(test(PATTERNS.DOLLAR, '$1,234.56')).toBe(true);
    expect(test(PATTERNS.DOLLAR, '$ 1234')).toBe(true);
    expect(test(PATTERNS.DOLLAR, '$1,000,000')).toBe(true);
  });
});

describe('DEFAULT_ENABLED', () => {
  it('does NOT include DOLLAR', () => {
    expect(DEFAULT_ENABLED).not.toContain('DOLLAR');
  });
  it('includes the standard six', () => {
    expect(DEFAULT_ENABLED).toEqual(
      expect.arrayContaining(['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM']),
    );
  });
});

describe('FORBIDDEN_FOR_MUTATION', () => {
  it('contains DOLLAR', () => {
    expect(FORBIDDEN_FOR_MUTATION.has('DOLLAR')).toBe(true);
  });
});

describe('findAll', () => {
  it('finds default patterns in mixed text', () => {
    const text = 'SSN 123-45-6789 phone 555-123-4567 email user@example.com';
    const matches = Array.from(findAll(text));
    const labels = matches.map((m) => m.label).sort();
    expect(labels).toEqual(['EMAIL', 'PHONE', 'SSN']);
  });
  it('extracts the captured group only for LOAN_NUM', () => {
    const text = 'Loan No. SMH-2024-88421';
    const matches = Array.from(findAll(text, ['LOAN_NUM']));
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('SMH-2024-88421');
  });
  it('strips DOLLAR even if explicitly enabled', () => {
    const text = '$1,234.56 was paid';
    const matches = Array.from(findAll(text, ['DOLLAR', 'SSN']));
    expect(matches.every((m) => m.label !== 'DOLLAR')).toBe(true);
  });
  it('returns positional offsets that match the text', () => {
    const text = 'see 123-45-6789 here';
    const [match] = Array.from(findAll(text, ['SSN']));
    expect(text.slice(match.start, match.end)).toBe(match.text);
  });
});
