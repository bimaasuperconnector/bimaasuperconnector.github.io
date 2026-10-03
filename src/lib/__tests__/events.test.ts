import { describe, expect, it } from 'vitest';
import {
  canViewEvent,
  targetingSummary,
  computeAvailability,
  isRsvpWindowOpen,
  isValidCapacity,
  isValidEventTargeting,
} from '../events';

describe('canViewEvent', () => {
  const base = {
    organizerUid: 'organizer-1',
    targetBatchNumbers: [] as number[],
    targetCityLower: '',
    targetUids: [] as string[],
    targetChapterIds: [] as string[],
    targetBadgeIds: [] as string[],
    targetLabels: [] as string[],
  };

  it('organizer can always see their own event regardless of targeting', () => {
    expect(
      canViewEvent(
        { ...base, targetType: 'selected', targetUids: ['someone-else'] },
        { uid: 'organizer-1', batchNumber: null, cityCanonicalLower: '' },
      ),
    ).toBe(true);
  });

  it('everyone-targeted events are visible to any viewer', () => {
    expect(
      canViewEvent(
        { ...base, targetType: 'everyone' },
        { uid: 'viewer-1', batchNumber: null, cityCanonicalLower: '' },
      ),
    ).toBe(true);
  });

  it('batch targeting matches only a viewer whose batch is listed', () => {
    const event = { ...base, targetType: 'batch' as const, targetBatchNumbers: [12, 13] };
    expect(canViewEvent(event, { uid: 'v', batchNumber: 12, cityCanonicalLower: '' })).toBe(true);
    expect(canViewEvent(event, { uid: 'v', batchNumber: 20, cityCanonicalLower: '' })).toBe(false);
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, cityCanonicalLower: '' })).toBe(false);
  });

  it('city targeting matches on lowercase location and never on an empty city', () => {
    const event = { ...base, targetType: 'city' as const, targetCityLower: 'bengaluru' };
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, cityCanonicalLower: 'bengaluru' })).toBe(true);
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, cityCanonicalLower: 'mumbai' })).toBe(false);
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, cityCanonicalLower: '' })).toBe(false);
  });

  it('selected targeting matches only listed uids', () => {
    const event = { ...base, targetType: 'selected' as const, targetUids: ['a', 'b'] };
    expect(canViewEvent(event, { uid: 'a', batchNumber: null, cityCanonicalLower: '' })).toBe(true);
    expect(canViewEvent(event, { uid: 'z', batchNumber: null, cityCanonicalLower: '' })).toBe(false);
  });

  it('chapter targeting matches a viewer in ANY listed chapter (they may hold two)', () => {
    const event = {
      ...base,
      targetType: 'chapter' as const,
      targetChapterIds: ['chennai', 'tn'],
      targetLabels: ['Chennai Chapter', 'TN Chapter'],
    };
    const viewer = { uid: 'v', batchNumber: null, cityCanonicalLower: '' };
    expect(canViewEvent(event, { ...viewer, chapterIds: ['chennai'] })).toBe(true);
    // lives in Australia now, returns to Chennai yearly -> still sees the Chennai event
    expect(canViewEvent(event, { ...viewer, chapterIds: ['australia', 'chennai'] })).toBe(true);
    expect(canViewEvent(event, { ...viewer, chapterIds: ['australia'] })).toBe(false);
    expect(canViewEvent(event, { ...viewer, chapterIds: [] })).toBe(false);
    expect(canViewEvent(event, viewer)).toBe(false);
  });

  it('badge targeting matches only viewers who wear a listed badge, and never a chapter-only match', () => {
    const event = { ...base, targetType: 'badge' as const, targetBadgeIds: ['finclub'], targetLabels: ['Finclub'] };
    const viewer = { uid: 'v', batchNumber: null, cityCanonicalLower: '' };
    expect(canViewEvent(event, { ...viewer, badgeIds: ['messcom', 'finclub'] })).toBe(true);
    expect(canViewEvent(event, { ...viewer, badgeIds: ['messcom'] })).toBe(false);
    // the same id held as a chapter must not grant access to a badge event
    expect(canViewEvent(event, { ...viewer, chapterIds: ['finclub'] })).toBe(false);
  });
});

describe('targetingSummary', () => {
  const base = {
    targetBatchNumbers: [] as number[],
    targetCityLower: '',
    targetUids: [] as string[],
    targetChapterIds: [] as string[],
    targetBadgeIds: [] as string[],
    targetLabels: [] as string[],
  };

  it('names the chapters and badges an event is open to', () => {
    expect(
      targetingSummary({ ...base, targetType: 'chapter', targetChapterIds: ['a', 'b'], targetLabels: ['Chennai Chapter', 'India Chapter'] }),
    ).toBe('Chennai Chapter, India Chapter members');
    expect(
      targetingSummary({ ...base, targetType: 'badge', targetBadgeIds: ['a'], targetLabels: ['Finclub'] }),
    ).toBe('Finclub badge holders');
  });
});

describe('isRsvpWindowOpen', () => {
  const now = new Date('2026-10-10T00:00:00Z');

  it('is closed once the event is cancelled, regardless of dates', () => {
    expect(
      isRsvpWindowOpen(
        { status: 'cancelled', startTime: new Date('2026-12-01'), rsvpDeadline: null },
        now,
      ),
    ).toBe(false);
  });

  it('falls back to startTime when no explicit deadline is set', () => {
    expect(
      isRsvpWindowOpen(
        { status: 'scheduled', startTime: new Date('2026-10-11'), rsvpDeadline: null },
        now,
      ),
    ).toBe(true);
    expect(
      isRsvpWindowOpen(
        { status: 'scheduled', startTime: new Date('2026-10-09'), rsvpDeadline: null },
        now,
      ),
    ).toBe(false);
  });

  it('respects an explicit deadline even if the event itself is later', () => {
    expect(
      isRsvpWindowOpen(
        {
          status: 'scheduled',
          startTime: new Date('2026-12-01'),
          rsvpDeadline: new Date('2026-10-09'),
        },
        now,
      ),
    ).toBe(false);
  });
});

describe('computeAvailability', () => {
  it('unlimited capacity is never full', () => {
    expect(computeAvailability(null, 999)).toEqual({ remaining: null, isFull: false });
  });

  it('reports remaining spots and flips to full at capacity', () => {
    expect(computeAvailability(10, 4)).toEqual({ remaining: 6, isFull: false });
    expect(computeAvailability(10, 10)).toEqual({ remaining: 0, isFull: true });
  });

  it('never reports negative remaining even if attendance somehow exceeds capacity', () => {
    expect(computeAvailability(5, 8)).toEqual({ remaining: 0, isFull: true });
  });
});

describe('isValidCapacity', () => {
  it('null (unlimited) is valid', () => {
    expect(isValidCapacity(null)).toBe(true);
  });

  it('rejects non-integers, zero, negatives and anything past the cap', () => {
    expect(isValidCapacity(0)).toBe(false);
    expect(isValidCapacity(-1)).toBe(false);
    expect(isValidCapacity(3.5)).toBe(false);
    expect(isValidCapacity(1001)).toBe(false);
  });

  it('accepts the boundary values', () => {
    expect(isValidCapacity(1)).toBe(true);
    expect(isValidCapacity(1000)).toBe(true);
  });
});

describe('isValidEventTargeting', () => {
  const base = {
    targetBatchNumbers: [] as number[],
    targetCityLower: '',
    targetUids: [] as string[],
    targetChapterIds: [] as string[],
    targetBadgeIds: [] as string[],
    targetLabels: [] as string[],
  };

  it('everyone must carry no type-specific data', () => {
    expect(isValidEventTargeting({ ...base, targetType: 'everyone' })).toBe(true);
    expect(isValidEventTargeting({ ...base, targetType: 'everyone', targetCityLower: 'pune' })).toBe(false);
  });

  it('batch requires a non-empty batch list and nothing else populated', () => {
    expect(isValidEventTargeting({ ...base, targetType: 'batch', targetBatchNumbers: [1] })).toBe(true);
    expect(isValidEventTargeting({ ...base, targetType: 'batch' })).toBe(false);
    expect(
      isValidEventTargeting({ ...base, targetType: 'batch', targetBatchNumbers: [1], targetUids: ['x'] }),
    ).toBe(false);
  });

  it('city requires a non-empty city and nothing else populated', () => {
    expect(isValidEventTargeting({ ...base, targetType: 'city', targetCityLower: 'pune' })).toBe(true);
    expect(isValidEventTargeting({ ...base, targetType: 'city' })).toBe(false);
  });

  it('selected requires a non-empty uid list and nothing else populated', () => {
    expect(isValidEventTargeting({ ...base, targetType: 'selected', targetUids: ['a'] })).toBe(true);
    expect(isValidEventTargeting({ ...base, targetType: 'selected' })).toBe(false);
  });

  it('rejects an oversized selected list', () => {
    const many = Array.from({ length: 51 }, (_, i) => `uid${i}`);
    expect(isValidEventTargeting({ ...base, targetType: 'selected', targetUids: many })).toBe(false);
  });
  it('chapter targeting needs at least one chapter and a matching label for each', () => {
    expect(
      isValidEventTargeting({ ...base, targetType: 'chapter', targetChapterIds: ['c1'], targetLabels: ['Chennai Chapter'] }),
    ).toBe(true);
    expect(isValidEventTargeting({ ...base, targetType: 'chapter' })).toBe(false);
    // label count must equal id count
    expect(isValidEventTargeting({ ...base, targetType: 'chapter', targetChapterIds: ['c1'], targetLabels: [] })).toBe(false);
    // chapter ids are not allowed on any other targeting type
    expect(isValidEventTargeting({ ...base, targetType: 'everyone', targetChapterIds: ['c1'], targetLabels: ['x'] })).toBe(false);
    expect(isValidEventTargeting({ ...base, targetType: 'batch', targetBatchNumbers: [1], targetChapterIds: ['c1'] })).toBe(false);
  });

  it('badge targeting needs at least one badge and a matching label for each', () => {
    expect(
      isValidEventTargeting({ ...base, targetType: 'badge', targetBadgeIds: ['b1', 'b2'], targetLabels: ['A', 'B'] }),
    ).toBe(true);
    expect(isValidEventTargeting({ ...base, targetType: 'badge' })).toBe(false);
    expect(isValidEventTargeting({ ...base, targetType: 'badge', targetBadgeIds: ['b1'], targetLabels: ['A', 'B'] })).toBe(false);
    expect(isValidEventTargeting({ ...base, targetType: 'chapter', targetChapterIds: ['c1'], targetBadgeIds: ['b1'], targetLabels: ['A'] })).toBe(false);
  });

  it('caps chapter and badge targets at 10 each', () => {
    const many = Array.from({ length: 11 }, (_, i) => `id${i}`);
    expect(isValidEventTargeting({ ...base, targetType: 'chapter', targetChapterIds: many, targetLabels: many })).toBe(false);
    expect(isValidEventTargeting({ ...base, targetType: 'badge', targetBadgeIds: many, targetLabels: many })).toBe(false);
  });
});
