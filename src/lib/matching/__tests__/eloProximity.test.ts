import { describe, expect, it } from 'vitest';
import { connectionMeterProximity, DEFAULT_CONNECTION_METER } from '../eloProximity';

describe('connectionMeterProximity', () => {
  it('is 1 for identical scores (everyone defaults to 1000 pre-Phase-6)', () => {
    expect(connectionMeterProximity(DEFAULT_CONNECTION_METER, DEFAULT_CONNECTION_METER)).toBe(1);
  });

  it('decreases as scores diverge', () => {
    const close = connectionMeterProximity(1000, 1020);
    const far = connectionMeterProximity(1000, 1200);
    expect(close).toBeGreaterThan(far);
  });

  it('is 0 at the full soft-range width (400) apart', () => {
    expect(connectionMeterProximity(800, 1200)).toBe(0);
  });

  it('clamps to 0 rather than going negative beyond the soft range', () => {
    expect(connectionMeterProximity(500, 1500)).toBe(0);
  });

  it('is symmetric', () => {
    expect(connectionMeterProximity(950, 1050)).toBe(connectionMeterProximity(1050, 950));
  });
});
