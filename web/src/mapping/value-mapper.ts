import { stableSeed } from './stable-seed.js';
import type { SpanLabel } from '../types.js';

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  intRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: ArrayLike<T>): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

const FIRST_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Jamie', 'Riley',
  'Avery', 'Quinn', 'Blake', 'Drew', 'Rowan', 'Hayden', 'Logan', 'Parker',
  'Reese', 'Sage', 'Skyler', 'Devon',
];
const LAST_NAMES = [
  'Doe', 'Roe', 'Smith', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
  'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
  'Martin', 'Walker', 'Hall', 'Young', 'King',
];
const STREETS = [
  'Maple', 'Oak', 'Cedar', 'Pine', 'Elm', 'Birch', 'Walnut', 'Cherry',
  'Sycamore', 'Willow', 'Ash', 'Hickory', 'Spruce', 'Magnolia',
];
const STREET_TYPES = ['St', 'Ave', 'Rd', 'Ln', 'Dr', 'Blvd', 'Ct', 'Way'];

const ALPHA_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export class ValueMapper {
  readonly seed: number;
  private dateOffsetDays: number;
  private cache: Record<string, Map<string, string>> = {
    SSN: new Map(),
    EIN: new Map(),
    PHONE: new Map(),
    EMAIL: new Map(),
    DATE: new Map(),
    LOAN_NUM: new Map(),
    ZIP: new Map(),
    NAME: new Map(),
    ADDRESS: new Map(),
    CUSTOM: new Map(),
  };

  constructor(seed: number = Math.floor(Math.random() * 2 ** 31)) {
    this.seed = seed;
    const rng = new SeededRng(seed);
    const sign = rng.next() < 0.5 ? -1 : 1;
    this.dateOffsetDays = rng.intRange(400, 1500) * sign;
  }

  private rng(original: string, salt: string): SeededRng {
    return new SeededRng(stableSeed(original, `${salt}::${this.seed}`));
  }

  mapSsn(original: string): string {
    const cached = this.cache.SSN.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'ssn');
    const fake = `9${pad(r.intRange(0, 99), 2)}-${pad(r.intRange(10, 99), 2)}-${pad(r.intRange(1000, 9999), 4)}`;
    this.cache.SSN.set(original, fake);
    return fake;
  }

  mapEin(original: string): string {
    const cached = this.cache.EIN.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'ein');
    const fake = `${pad(r.intRange(10, 99), 2)}-${pad(r.intRange(1000000, 9999999), 7)}`;
    this.cache.EIN.set(original, fake);
    return fake;
  }

  mapPhone(original: string): string {
    const cached = this.cache.PHONE.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'phone');
    const last4 = pad(r.intRange(0, 9999), 4);
    let fake: string;
    if (original.includes('(')) fake = `(555) 555-${last4}`;
    else if (original.includes('.')) fake = `555.555.${last4}`;
    else if (original.includes('-')) fake = `555-555-${last4}`;
    else fake = `(555) 555-${last4}`;
    this.cache.PHONE.set(original, fake);
    return fake;
  }

  mapEmail(original: string): string {
    const cached = this.cache.EMAIL.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'email');
    const fake = `user${pad(r.intRange(1000, 9999), 4)}@example.com`;
    this.cache.EMAIL.set(original, fake);
    return fake;
  }

  mapDate(original: string): string {
    const cached = this.cache.DATE.get(original);
    if (cached) return cached;
    let sep: string | null = null;
    if (original.includes('/')) sep = '/';
    else if (original.includes('-')) sep = '-';
    if (!sep) {
      this.cache.DATE.set(original, original);
      return original;
    }
    const parts = original.split(sep);
    if (parts.length !== 3) {
      this.cache.DATE.set(original, original);
      return original;
    }
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (Number.isNaN(m) || Number.isNaN(d) || Number.isNaN(y)) {
      this.cache.DATE.set(original, original);
      return original;
    }
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + this.dateOffsetDays);
    const newM = dt.getMonth() + 1;
    const newD = dt.getDate();
    const newY = dt.getFullYear();
    const monthStr = parts[0].startsWith('0') ? pad(newM, 2) : `${newM}`;
    const fake = `${monthStr}${sep}${pad(newD, 2)}${sep}${newY}`;
    this.cache.DATE.set(original, fake);
    return fake;
  }

  mapLoanNumber(original: string): string {
    const cached = this.cache.LOAN_NUM.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'loan');
    let out = '';
    for (const c of original) {
      if (/\d/.test(c)) out += String(r.intRange(0, 9));
      else if (/[A-Za-z]/.test(c)) out += r.pick(ALPHA_UPPER);
      else out += c;
    }
    this.cache.LOAN_NUM.set(original, out);
    return out;
  }

  mapZip(original: string): string {
    const cached = this.cache.ZIP.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'zip');
    const fake = original.includes('-')
      ? `${pad(r.intRange(10000, 99999), 5)}-${pad(r.intRange(1000, 9999), 4)}`
      : `${pad(r.intRange(10000, 99999), 5)}`;
    this.cache.ZIP.set(original, fake);
    return fake;
  }

  mapName(original: string): string {
    const cached = this.cache.NAME.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'name');
    const fake = `${r.pick(FIRST_NAMES)} ${r.pick(LAST_NAMES)}`;
    this.cache.NAME.set(original, fake);
    return fake;
  }

  mapAddress(original: string): string {
    const cached = this.cache.ADDRESS.get(original);
    if (cached) return cached;
    const r = this.rng(original, 'addr');
    const fake = `${r.intRange(100, 9999)} ${r.pick(STREETS)} ${r.pick(STREET_TYPES)}`;
    this.cache.ADDRESS.set(original, fake);
    return fake;
  }

  mapCustom(original: string, replacement: string): string {
    this.cache.CUSTOM.set(original, replacement);
    return replacement;
  }

  mapValue(label: SpanLabel, original: string): string {
    if (label === 'DOLLAR') {
      throw new Error(
        'Dollar amounts must never be mapped — they are financial content and must pass through unchanged.',
      );
    }
    switch (label) {
      case 'SSN': return this.mapSsn(original);
      case 'EIN': return this.mapEin(original);
      case 'PHONE': return this.mapPhone(original);
      case 'EMAIL': return this.mapEmail(original);
      case 'DATE': return this.mapDate(original);
      case 'LOAN_NUM': return this.mapLoanNumber(original);
      case 'ZIP': return this.mapZip(original);
      case 'NAME': return this.mapName(original);
      case 'ADDRESS': return this.mapAddress(original);
      case 'CUSTOM': return this.cache.CUSTOM.get(original) ?? original;
      default: return this.cache.CUSTOM.get(original) ?? original;
    }
  }

  getMappingReport(): Record<string, Record<string, string>> {
    const out: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(this.cache)) {
      if (v.size === 0) continue;
      out[k] = Object.fromEntries(v);
    }
    return out;
  }
}
