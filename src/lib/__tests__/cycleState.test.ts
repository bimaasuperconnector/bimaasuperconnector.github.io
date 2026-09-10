import { describe, expect, it } from 'vitest';
import { currentCycle, computeCycleSchedule, determineNextStatus } from '../cycles';

describe('computeCycleSchedule', () => {
  it('closes registration 2 days before Saturday at 23:59 IST', () => {
    const cycle = currentCycle(new Date(2026, 8, 1));
    const schedule = computeCycleSchedule(cycle);
    expect(schedule.registrationClosesAt.toISOString()).toBe('2026-09-17T18:29:00.000Z');
  });

  it('feedback opens right after the Sunday meeting, closes 7 days later', () => {
    const cycle = currentCycle(new Date(2026, 8, 1));
    const schedule = computeCycleSchedule(cycle);
    expect(schedule.feedbackOpensAt.toISOString()).toBe('2026-09-20T18:29:00.000Z');
    const diffDays =
      (schedule.feedbackClosesAt.getTime() - schedule.feedbackOpensAt.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(7);
  });

  it('correctly rolls the registration-close date across a month boundary', () => {
    const cycle = {
      id: '2026-08',
      year: 2026,
      month: 8,
      saturday: new Date(2026, 7, 1),
      sunday: new Date(2026, 7, 2),
    };
    const schedule = computeCycleSchedule(cycle);
    expect(schedule.registrationClosesAt.toISOString()).toBe('2026-07-30T18:29:00.000Z');
  });
});

describe('determineNextStatus', () => {
  const cycle = currentCycle(new Date(2026, 8, 1));
  const schedule = computeCycleSchedule(cycle);

  it('stays registration_open before the close cutoff', () => {
    const before = new Date(schedule.registrationClosesAt.getTime() - 1000);
    expect(determineNextStatus('registration_open', schedule, before)).toBeNull();
  });

  it('transitions to registration_closed at/after the cutoff', () => {
    const after = new Date(schedule.registrationClosesAt.getTime() + 1000);
    expect(determineNextStatus('registration_open', schedule, after)).toBe('registration_closed');
  });

  it('never auto-transitions out of registration_closed by time alone (matching job must run first)', () => {
    const farFuture = new Date(schedule.feedbackClosesAt.getTime() + 1000 * 60 * 60 * 24 * 365);
    expect(determineNextStatus('registration_closed', schedule, farFuture)).toBeNull();
  });

  it('transitions matching_complete -> feedback_open after the Sunday meeting', () => {
    const before = new Date(schedule.feedbackOpensAt.getTime() - 1000);
    const after = new Date(schedule.feedbackOpensAt.getTime() + 1000);
    expect(determineNextStatus('matching_complete', schedule, before)).toBeNull();
    expect(determineNextStatus('matching_complete', schedule, after)).toBe('feedback_open');
  });

  it('transitions feedback_open -> archived after the feedback window closes', () => {
    const before = new Date(schedule.feedbackClosesAt.getTime() - 1000);
    const after = new Date(schedule.feedbackClosesAt.getTime() + 1000);
    expect(determineNextStatus('feedback_open', schedule, before)).toBeNull();
    expect(determineNextStatus('feedback_open', schedule, after)).toBe('archived');
  });

  it('archived never transitions further', () => {
    expect(determineNextStatus('archived', schedule, new Date(3000, 0, 1))).toBeNull();
  });
});
