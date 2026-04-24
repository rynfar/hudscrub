import { describe, it, expect } from 'vitest';
import { groupBioTokens, type TokenEntity } from '../../src/detection/ner/alignment.js';

describe('groupBioTokens', () => {
  it('groups consecutive same-type tokens into a single entity', () => {
    const tokens: TokenEntity[] = [
      { word: 'Maria', entity: 'B-PER', start: 0, end: 5, score: 0.99 },
      { word: 'L.', entity: 'I-PER', start: 6, end: 8, score: 0.95 },
      { word: 'Garcia', entity: 'I-PER', start: 9, end: 15, score: 0.98 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(1);
    expect(groups[0].text).toBe('Maria L. Garcia');
    expect(groups[0].label).toBe('NAME');
    expect(groups[0].start).toBe(0);
    expect(groups[0].end).toBe(15);
  });

  it('starts a new entity on B- tag even if same type follows', () => {
    const tokens: TokenEntity[] = [
      { word: 'Alice', entity: 'B-PER', start: 0, end: 5, score: 0.99 },
      { word: 'Bob', entity: 'B-PER', start: 6, end: 9, score: 0.99 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(2);
  });

  it('starts a new entity when the entity type changes', () => {
    const tokens: TokenEntity[] = [
      { word: 'John', entity: 'B-PER', start: 0, end: 4, score: 0.99 },
      { word: 'Boston', entity: 'B-LOC', start: 5, end: 11, score: 0.99 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('NAME');
    expect(groups[1].label).toBe('ADDRESS');
  });

  it('skips O tokens', () => {
    const tokens: TokenEntity[] = [
      { word: 'the', entity: 'O', start: 0, end: 3, score: 0.99 },
      { word: 'Maria', entity: 'B-PER', start: 4, end: 9, score: 0.99 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(1);
    expect(groups[0].text).toBe('Maria');
  });

  it('returns the average score for a group', () => {
    const tokens: TokenEntity[] = [
      { word: 'Alex', entity: 'B-PER', start: 0, end: 4, score: 0.9 },
      { word: 'Doe', entity: 'I-PER', start: 5, end: 8, score: 0.7 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups[0].score).toBeCloseTo(0.8, 5);
  });
});
