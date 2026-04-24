'use client';
import { ValueMapper } from '@/src/mapping/value-mapper';

/**
 * Singleton ValueMapper shared across the session so that every code path
 * (processing, manual span add, export) generates the SAME fake value for the
 * same original text. Lives in module scope; reset between batches.
 */
let mapper: ValueMapper | null = null;

export function getSandboxMapper(seed?: number): ValueMapper {
  if (!mapper) {
    mapper = new ValueMapper(seed);
  }
  return mapper;
}

export function resetSandboxMapper(): void {
  mapper = null;
}

/** Compute (and cache) the replacement value for a single span. */
export function replacementFor(label: string, original: string, seed?: number): string | undefined {
  if (label === 'DOLLAR') return undefined;
  const m = getSandboxMapper(seed);
  try {
    return m.mapValue(label as Parameters<typeof m.mapValue>[0], original);
  } catch {
    return undefined;
  }
}
