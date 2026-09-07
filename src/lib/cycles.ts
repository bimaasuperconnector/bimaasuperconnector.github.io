/**
 * Centralized schedule/configuration for monthly SuperConnector cycles,
 * per CLAUDE.md's "Centralize all schedule/configuration values."
 *
 * A cycle happens on the "third weekend" of each month — the third
 * Saturday and the Sunday immediately after it. Everything here is a
 * pure function of the calendar; there is no Firestore-backed cycle
 * state yet (see Phase 4's completion log in FEATURE_SUPERCONNECTOR.md
 * for why that's a deliberate scope decision, not an oversight).
 */

export const REGISTRATION_SLOTS = ['saturday', 'sunday', 'both'] as const;
export type RegistrationSlot = (typeof REGISTRATION_SLOTS)[number];

export const SLOT_LABELS: Record<RegistrationSlot, string> = {
  saturday: 'Saturday, 5:00–6:00 PM',
  sunday: 'Sunday, 5:00–6:00 PM',
  both: 'Both Saturday and Sunday, 5:00–6:00 PM',
};

export const REGISTRATION_MODES = ['one_to_one', 'small_circle'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export const MODE_LABELS: Record<RegistrationMode, string> = {
  one_to_one: 'One-to-One',
  small_circle: 'Small Circle',
};

export const SMALL_CIRCLE_TARGET = 6;
export const SMALL_CIRCLE_MIN = 3;
export const SMALL_CIRCLE_MAX = 6;

export interface Cycle {
  /** "YYYY-MM", 1-indexed month, e.g. "2026-09" */
  id: string;
  year: number;
  /** 1-indexed (1 = January), unlike JS Date's 0-indexed month */
  month: number;
  saturday: Date;
  sunday: Date;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** The third Saturday and the following Sunday of the given (JS Date-style, 0-indexed) month. */
function thirdWeekendOf(year: number, jsMonth: number): { saturday: Date; sunday: Date } {
  const firstOfMonth = new Date(year, jsMonth, 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilFirstSaturday = (6 - firstDayOfWeek + 7) % 7;
  const firstSaturdayDate = 1 + daysUntilFirstSaturday;
  const thirdSaturdayDate = firstSaturdayDate + 14;
  const saturday = new Date(year, jsMonth, thirdSaturdayDate);
  const sunday = new Date(year, jsMonth, thirdSaturdayDate + 1);
  return { saturday, sunday };
}

function toCycle(year: number, jsMonth: number): Cycle {
  const { saturday, sunday } = thirdWeekendOf(year, jsMonth);
  return {
    id: `${year}-${pad2(jsMonth + 1)}`,
    year,
    month: jsMonth + 1,
    saturday,
    sunday,
  };
}

/**
 * The cycle a member should register for right now: this month's third
 * weekend if it hasn't finished yet, otherwise next month's.
 */
export function currentCycle(now: Date = new Date()): Cycle {
  const thisMonth = toCycle(now.getFullYear(), now.getMonth());
  const endOfSunday = new Date(
    thisMonth.sunday.getFullYear(),
    thisMonth.sunday.getMonth(),
    thisMonth.sunday.getDate(),
    23,
    59,
    59,
  );
  if (now <= endOfSunday) {
    return thisMonth;
  }
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return toCycle(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
}

export function formatCycleDates(cycle: Cycle): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  const satLabel = cycle.saturday.toLocaleDateString(undefined, opts);
  const sunLabel = cycle.sunday.toLocaleDateString(undefined, {
    ...opts,
    year: 'numeric',
  });
  return `${satLabel}\u2013${sunLabel}`;
}

export function isValidCycleId(id: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(id);
}
