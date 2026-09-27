import { describe, expect, it } from 'vitest';
import { normalizeCity, normalizeCityLower } from '../geography';

describe('normalizeCity', () => {
  it('resolves known aliases to a single canonical spelling', () => {
    expect(normalizeCity('Bangalore')).toBe('Bengaluru');
    expect(normalizeCity('bangalore')).toBe('Bengaluru');
    expect(normalizeCity('Bengaluru')).toBe('Bengaluru');
    expect(normalizeCity('BENGALURU')).toBe('Bengaluru');
  });

  it('resolves several other known English-era renamings', () => {
    expect(normalizeCity('Bombay')).toBe('Mumbai');
    expect(normalizeCity('Madras')).toBe('Chennai');
    expect(normalizeCity('Calcutta')).toBe('Kolkata');
    expect(normalizeCity('New Delhi')).toBe('Delhi');
    expect(normalizeCity('Gurgaon')).toBe('Gurugram');
  });

  it('collapses internal and surrounding whitespace before matching', () => {
    expect(normalizeCity('  Bangalore  ')).toBe('Bengaluru');
    expect(normalizeCity('New   Delhi')).toBe('Delhi');
  });

  it('normalizes to empty string for blank input, never throws', () => {
    expect(normalizeCity('')).toBe('');
    expect(normalizeCity('   ')).toBe('');
  });

  it('title-cases an unrecognized city rather than rejecting it', () => {
    expect(normalizeCity('london')).toBe('London');
    expect(normalizeCity('SAN FRANCISCO')).toBe('San Francisco');
    expect(normalizeCity('new york')).toBe('New York');
  });

  it('is idempotent — normalizing an already-canonical value is a no-op', () => {
    const once = normalizeCity('bangalore');
    expect(normalizeCity(once)).toBe(once);
  });
});

describe('normalizeCityLower', () => {
  it('is the lowercase form of normalizeCity, used as the actual query key', () => {
    expect(normalizeCityLower('Bangalore')).toBe('bengaluru');
    expect(normalizeCityLower('  Bombay ')).toBe('mumbai');
    expect(normalizeCityLower('')).toBe('');
  });

  it('makes two different spellings of the same city collide on the same key', () => {
    expect(normalizeCityLower('Bangalore')).toBe(normalizeCityLower('Bengaluru'));
    expect(normalizeCityLower('bangalore')).toBe(normalizeCityLower('BENGALURU'));
  });
});
