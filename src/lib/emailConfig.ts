/**
 * Shared (browser + automation) constants and pure helpers for the Email
 * Automation & Reminders module. No imports and no browser/Node APIs, so
 * the exact same file is used by the superadmin console AND by the
 * GitHub Actions job — the limits shown in the console are the limits
 * the job enforces.
 */

export const EMAIL_SENDER_ADDRESS = 'bimaasuperconnector@gmail.com';
export const EMAIL_SENDER_NAME = 'BIMAA SuperConnector';
export const APP_URL = 'https://bimaasuperconnector.github.io/';

/** Hard ceiling of individual recipients per IST day (welcome + birthday combined). Never raised by config. */
export const INDIVIDUAL_DAILY_HARD_LIMIT = 90;
/** Separate, conservative ceiling for Google Group messages per IST day (a group counts as one message). */
export const GROUP_DAILY_HARD_LIMIT = 100;
/** A failing email is retried this many times in total, then parked as "failed" until a superadmin retries it. */
export const MAX_SEND_ATTEMPTS = 5;
export const RETRY_DELAY_HOURS = 6;
/** A birthday greeting still goes out up to this many days late (e.g. after a missed run); older ones are skipped. */
export const BIRTHDAY_CATCHUP_DAYS = 2;
/** Monthly reminders are sent on the chosen day, and if a run was missed, up to this many days later. */
export const REMINDER_WINDOW_DAYS = 3;

/** Must match the cron in .github/workflows/email-automation.yml (03:30 UTC = 09:00 IST). */
export const SCHEDULE_UTC_HOUR = 3;
export const SCHEDULE_UTC_MINUTE = 30;

export const REMINDER_TYPES = ['meetup', 'jobs'] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];
export const REMINDER_LABELS: Record<ReminderType, string> = {
  meetup: 'SuperConnector meetup reminder',
  jobs: 'Job openings reminder',
};

export const EMAIL_KINDS = ['welcome', 'birthday', 'reminder'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const TEMPLATE_KEYS = ['welcome', 'birthday', 'meetup', 'jobs'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  welcome: 'Welcome email',
  birthday: 'Birthday greeting',
  meetup: 'Monthly reminder: SuperConnector meetup',
  jobs: 'Monthly reminder: job openings',
};

export const QUEUE_STATUSES = ['pending', 'sending', 'sent', 'failed', 'skipped'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export interface EmailAutomationConfig {
  /** Master switch: when true, nothing is sent and no birthday/reminder is queued. */
  paused: boolean;
  welcomeEnabled: boolean;
  birthdayEnabled: boolean;
  meetupEnabled: boolean;
  jobsEnabled: boolean;
  /** Day of the month (IST) on which monthly reminders go out. */
  monthlyDay: 1 | 2;
  /** Batches that receive the monthly reminders. Empty = every batch that has a group address. */
  targetBatches: number[];
  /** Individual emails per day, 1..INDIVIDUAL_DAILY_HARD_LIMIT. */
  dailyLimit: number;
}

export const DEFAULT_EMAIL_CONFIG: EmailAutomationConfig = {
  paused: false,
  welcomeEnabled: true,
  birthdayEnabled: true,
  meetupEnabled: true,
  jobsEnabled: true,
  monthlyDay: 1,
  targetBatches: [],
  dailyLimit: INDIVIDUAL_DAILY_HARD_LIMIT,
};

/** Tolerant reader: anything missing or malformed falls back to the safe default. */
export function normalizeEmailConfig(raw: unknown): EmailAutomationConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const limit = typeof r.dailyLimit === 'number' && Number.isInteger(r.dailyLimit) ? r.dailyLimit : DEFAULT_EMAIL_CONFIG.dailyLimit;
  const batches = Array.isArray(r.targetBatches)
    ? Array.from(new Set(r.targetBatches.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 200))).sort((a, b) => a - b)
    : [];
  return {
    paused: bool(r.paused, DEFAULT_EMAIL_CONFIG.paused),
    welcomeEnabled: bool(r.welcomeEnabled, DEFAULT_EMAIL_CONFIG.welcomeEnabled),
    birthdayEnabled: bool(r.birthdayEnabled, DEFAULT_EMAIL_CONFIG.birthdayEnabled),
    meetupEnabled: bool(r.meetupEnabled, DEFAULT_EMAIL_CONFIG.meetupEnabled),
    jobsEnabled: bool(r.jobsEnabled, DEFAULT_EMAIL_CONFIG.jobsEnabled),
    monthlyDay: r.monthlyDay === 2 ? 2 : 1,
    targetBatches: batches,
    dailyLimit: Math.min(INDIVIDUAL_DAILY_HARD_LIMIT, Math.max(1, limit)),
  };
}

// ---------------------------------------------------------------------
// Asia/Kolkata calendar helpers (IST has no DST: always UTC+5:30)
// ---------------------------------------------------------------------

export interface IstDate {
  year: number;
  month: number; // 1-12
  day: number;
  /** YYYY-MM-DD */
  key: string;
  /** YYYY-MM */
  monthKey: string;
  /** MM-DD */
  md: string;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const p2 = (n: number) => String(n).padStart(2, '0');

export function istDate(at: Date = new Date()): IstDate {
  const s = new Date(at.getTime() + IST_OFFSET_MS); // read UTC fields of the shifted instant
  const year = s.getUTCFullYear();
  const month = s.getUTCMonth() + 1;
  const day = s.getUTCDate();
  return { year, month, day, key: `${year}-${p2(month)}-${p2(day)}`, monthKey: `${year}-${p2(month)}`, md: `${p2(month)}-${p2(day)}` };
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** The `dobMD` values whose birthday falls on this IST date (29 Feb birthdays are greeted on 28 Feb in non-leap years). */
export function birthdayKeysForDate(d: IstDate): string[] {
  if (d.month === 2 && d.day === 28 && !isLeapYear(d.year)) return ['02-28', '02-29'];
  return [d.md];
}

/** Calendar date `n` days before the given IST date. */
export function istDateMinusDays(d: IstDate, n: number): IstDate {
  return istDate(new Date(Date.UTC(d.year, d.month - 1, d.day, 12) - n * 86400000 - IST_OFFSET_MS));
}

/** 'YYYY-MM-DD' (real calendar date, year 1900..today's year) -> 'MM-DD', else null. */
export function dobToMonthDay(dob: string | null | undefined): string | null {
  if (typeof dob !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return null;
  const daysInMonth = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (d > daysInMonth) return null;
  return `${m[2]}-${m[3]}`;
}

/** The next scheduled run (09:00 IST daily) after `from`. */
export function nextScheduledRun(from: Date = new Date()): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), SCHEDULE_UTC_HOUR, SCHEDULE_UTC_MINUTE));
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// ---------------------------------------------------------------------
// Validation + deterministic queue IDs (the idempotency keys)
// ---------------------------------------------------------------------

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

export const welcomeQueueId = (uid: string) => `welcome_${uid}`;
export const birthdayQueueId = (uid: string, year: number) => `birthday_${uid}_${year}`;
export const reminderQueueId = (type: ReminderType, batchNumber: number, monthKey: string) =>
  `reminder_${type}_${batchNumber}_${monthKey}`;
