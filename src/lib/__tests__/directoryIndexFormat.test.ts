import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_INDEX_SHARDS,
  PHOTO_URL_PREFIX,
  cleanText,
  decodeEntry,
  decodeShard,
  encodeEntry,
  encodeShard,
  entryFromProfileData,
  shardOf,
} from '../directoryIndexFormat';

const base = { uid: 'abc123', name: 'Sandeep Balaji', batch: 35, role: 'PM at Acme', photoURL: '', founder: false, openToWork: false };

describe('entry encoding', () => {
  it('round-trips every field', () => {
    const entry = { ...base, founder: true, openToWork: true, photoURL: `${PHOTO_URL_PREFIX}abc123/photo_x1.webp` };
    expect(decodeEntry(encodeEntry(entry))).toEqual(entry);
  });
  it('shortens an own-folder photo URL inside the index but restores it', () => {
    const entry = { ...base, photoURL: `${PHOTO_URL_PREFIX}abc123/photo_x1.webp` };
    const line = encodeEntry(entry);
    expect(line).toContain('photo_x1.webp');
    expect(line).not.toContain('imagekit');
    expect(decodeEntry(line)?.photoURL).toBe(entry.photoURL);
  });
  it('keeps a foreign photo URL in full', () => {
    const entry = { ...base, photoURL: 'https://example.com/p.webp' };
    expect(decodeEntry(encodeEntry(entry))?.photoURL).toBe(entry.photoURL);
  });
  it('round-trips a missing batch', () => {
    expect(decodeEntry(encodeEntry({ ...base, batch: null }))?.batch).toBeNull();
  });
  it('can never be broken by separator characters in text', () => {
    const entry = { ...base, name: 'Tab\tName\nSplit', role: 'a\tb\nc' };
    const decoded = decodeEntry(encodeEntry(entry));
    expect(decoded?.name).toBe('Tab Name Split');
    expect(decoded?.role).toBe('a b c');
  });
  it('rejects malformed lines', () => {
    expect(decodeEntry('')).toBeNull();
    expect(decodeEntry('only\tthree\tfields')).toBeNull();
    expect(decodeEntry('uid\t\t1\t\t\t')).toBeNull(); // no name
  });
});

describe('shard encoding', () => {
  it('round-trips a list and tolerates empty input', () => {
    const list = [base, { ...base, uid: 'zzz', name: 'Other Person' }];
    expect(decodeShard(encodeShard(list)).map((e) => e.uid).sort()).toEqual(['abc123', 'zzz']);
    expect(decodeShard('')).toEqual([]);
    expect(decodeShard(undefined)).toEqual([]);
  });
  it('is deterministic regardless of input order', () => {
    const a = { ...base, uid: 'a' };
    const b = { ...base, uid: 'b' };
    expect(encodeShard([a, b])).toBe(encodeShard([b, a]));
  });
});

describe('shardOf', () => {
  it('is stable and within range', () => {
    expect(shardOf('abc123')).toBe(shardOf('abc123'));
    for (let i = 0; i < 500; i++) {
      const s = shardOf(`uid-${i}`);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(DIRECTORY_INDEX_SHARDS);
    }
  });
  it('spreads members across all shards reasonably evenly', () => {
    const counts = Array.from({ length: DIRECTORY_INDEX_SHARDS }, () => 0);
    for (let i = 0; i < 4000; i++) counts[shardOf(`Xk${i}Qm${i * 7}`)]++;
    for (const c of counts) expect(c).toBeGreaterThan(300); // ideal is 500
  });
});

describe('entryFromProfileData', () => {
  const profile = {
    approved: true,
    displayName: 'Sandeep Balaji',
    batchNumber: 35,
    currentOrganizationName: 'Acme',
    currentTitle: 'Product Manager',
    headline: 'ignored while an organization exists',
    hasFounderOrg: true,
    openToWork: false,
    photoURL: `${PHOTO_URL_PREFIX}u1/photo_a.webp`,
    photoFileId: 'file123',
  };
  it('builds a searchable entry from an approved profile', () => {
    expect(entryFromProfileData('u1', profile)).toEqual({
      uid: 'u1',
      name: 'Sandeep Balaji',
      batch: 35,
      role: 'Product Manager at Acme',
      photoURL: profile.photoURL,
      founder: true,
      openToWork: false,
    });
  });
  it('falls back to the headline when there is no current organization', () => {
    const e = entryFromProfileData('u1', { ...profile, currentOrganizationName: '', currentTitle: '', headline: 'Consultant' });
    expect(e?.role).toBe('Consultant');
  });
  it('excludes a profile that is not approved or has no name', () => {
    expect(entryFromProfileData('u1', { ...profile, approved: false })).toBeNull();
    expect(entryFromProfileData('u1', { ...profile, approved: undefined })).toBeNull();
    expect(entryFromProfileData('u1', { ...profile, displayName: '  ' })).toBeNull();
  });
  it('never exposes a photo that was not uploaded (no photoFileId)', () => {
    expect(entryFromProfileData('u1', { ...profile, photoFileId: undefined })?.photoURL).toBe('');
  });
  it('shortens an over-long role', () => {
    const e = entryFromProfileData('u1', { ...profile, currentTitle: 'x'.repeat(100) });
    expect((e?.role ?? '').length).toBeLessThanOrEqual(40);
  });
});

describe('cleanText', () => {
  it('handles non-strings and trims', () => {
    expect(cleanText(undefined, 10)).toBe('');
    expect(cleanText('  hi  ', 10)).toBe('hi');
  });
});
