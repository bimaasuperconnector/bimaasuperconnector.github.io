import { describe, expect, it } from 'vitest';
import {
  applyFeedback,
  connectionMeterDelta,
  DEFAULT_CONNECTION_METER,
  SOFT_RANGE_MAX,
  SOFT_RANGE_MIN,
  toHistorySentiment,
} from '../connectionMeter';

describe('connectionMeterDelta', () => {
  it('is positive for great', () => {
    expect(connectionMeterDelta('great')).toBeGreaterThan(0);
  });

  it('is negative for not_good', () => {
    expect(connectionMeterDelta('not_good')).toBeLessThan(0);
  });

  it('is zero for okay and skip', () => {
    expect(connectionMeterDelta('okay')).toBe(0);
    expect(connectionMeterDelta('skip')).toBe(0);
  });

  it('great and not_good are equal-magnitude, opposite sign (symmetric movement)', () => {
    expect(connectionMeterDelta('great')).toBe(-connectionMeterDelta('not_good'));
  });
});

describe('applyFeedback', () => {
  it('moves the score up for great, down for not_good', () => {
    expect(applyFeedback(DEFAULT_CONNECTION_METER, 'great')).toBeGreaterThan(DEFAULT_CONNECTION_METER);
    expect(applyFeedback(DEFAULT_CONNECTION_METER, 'not_good')).toBeLessThan(DEFAULT_CONNECTION_METER);
  });

  it('leaves the score unchanged for okay and skip', () => {
    expect(applyFeedback(DEFAULT_CONNECTION_METER, 'okay')).toBe(DEFAULT_CONNECTION_METER);
    expect(applyFeedback(DEFAULT_CONNECTION_METER, 'skip')).toBe(DEFAULT_CONNECTION_METER);
  });

  it('clamps at the top of the soft range', () => {
    expect(applyFeedback(SOFT_RANGE_MAX, 'great')).toBe(SOFT_RANGE_MAX);
    expect(applyFeedback(SOFT_RANGE_MAX - 1, 'great')).toBe(SOFT_RANGE_MAX);
  });

  it('clamps at the bottom of the soft range', () => {
    expect(applyFeedback(SOFT_RANGE_MIN, 'not_good')).toBe(SOFT_RANGE_MIN);
    expect(applyFeedback(SOFT_RANGE_MIN + 1, 'not_good')).toBe(SOFT_RANGE_MIN);
  });

  it('never leaves the soft range regardless of a wildly out-of-range starting score', () => {
    expect(applyFeedback(-1000, 'great')).toBeGreaterThanOrEqual(SOFT_RANGE_MIN);
    expect(applyFeedback(10000, 'not_good')).toBeLessThanOrEqual(SOFT_RANGE_MAX);
  });
});

describe('toHistorySentiment', () => {
  it('maps great -> positive, not_good -> negative, okay -> neutral', () => {
    expect(toHistorySentiment('great')).toBe('positive');
    expect(toHistorySentiment('not_good')).toBe('negative');
    expect(toHistorySentiment('okay')).toBe('neutral');
  });

  it('maps skip -> undefined (declining to answer is not a data point)', () => {
    expect(toHistorySentiment('skip')).toBeUndefined();
  });
});
