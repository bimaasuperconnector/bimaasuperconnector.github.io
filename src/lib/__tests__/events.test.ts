import { describe, expect, it } from 'vitest';
import {
  canViewEvent,
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
  };

  it('organizer can always see their own event regardless of targeting', () => {
    expect(
      canViewEvent(
        { ...base, targetType: 'selected', targetUids: ['someone-else'] },
        { uid: 'organizer-1', batchNumber: null, locationLower: '' },
      ),
    ).toBe(true);
  });

  it('everyone-targeted events are visible to any viewer', () => {
    expect(
      canViewEvent(
        { ...base, targetType: 'everyone' },
        { uid: 'viewer-1', batchNumber: null, locationLower: '' },
      ),
    ).toBe(true);
  });

  it('batch targeting matches only a viewer whose batch is listed', () => {
    const event = { ...base, targetType: 'batch' as const, targetBatchNumbers: [12, 13] };
    expect(canViewEvent(event, { uid: 'v', batchNumber: 12, locationLower: '' })).toBe(true);
    expect(canViewEvent(event, { uid: 'v', batchNumber: 20, locationLower: '' })).toBe(false);
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, locationLower: '' })).toBe(false);
  });

  it('city targeting matches on lowercase location and never on an empty city', () => {
    const event = { ...base, targetType: 'city' as const, targetCityLower: 'bengaluru' };
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, locationLower: 'bengaluru' })).toBe(true);
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, locationLower: 'mumbai' })).toBe(false);
    expect(canViewEvent(event, { uid: 'v', batchNumber: null, locationLower: '' })).toBe(false);
  });

  it('selected targeting matches only listed uids', () => {
    const event = { ...base, targetType: 'selected' as const, targetUids: ['a', 'b'] };
    expect(canViewEvent(event, { uid: 'a', batchNumber: null, locationLower: '' })).toBe(true);
    expect(canViewEvent(event, { uid: 'z', batchNumber: null, locationLower: '' })).toBe(false);
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
  const base = { targetBatchNumbers: [] as number[], targetCityLower: '', targetUids: [] as string[] };

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
});
