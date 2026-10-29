import { describe, expect, it } from 'vitest';
import {
  INDIVIDUAL_DAILY_HARD_LIMIT,
  birthdayKeysForDate,
  birthdayQueueId,
  dobToMonthDay,
  isValidEmail,
  istDate,
  istDateMinusDays,
  nextScheduledRun,
  normalizeEmailConfig,
  reminderQueueId,
  welcomeQueueId,
} from '../emailConfig';
import { DEFAULT_TEMPLATES, renderEmail, resolveTemplates, substitute, unknownVariables } from '../emailTemplates';
import { personVars, reminderVars } from '../emailVars';

describe('IST calendar helpers', () => {
  it('rolls over to the next IST day after 18:30 UTC', () => {
    expect(istDate(new Date('2026-10-31T19:00:00Z')).key).toBe('2026-11-01');
    expect(istDate(new Date('2026-10-29T03:30:00Z')).key).toBe('2026-10-29');
  });
  it('greets 29 Feb birthdays on 28 Feb in non-leap years only', () => {
    expect(birthdayKeysForDate(istDate(new Date('2027-02-28T05:00:00Z')))).toEqual(['02-28', '02-29']);
    expect(birthdayKeysForDate(istDate(new Date('2028-02-28T05:00:00Z')))).toEqual(['02-28']);
  });
  it('steps back across month boundaries', () => {
    expect(istDateMinusDays(istDate(new Date('2026-03-01T05:00:00Z')), 2).key).toBe('2026-02-27');
  });
  it('validates dates of birth', () => {
    expect(dobToMonthDay('1990-03-14')).toBe('03-14');
    expect(dobToMonthDay('1990-02-30')).toBeNull();
    expect(dobToMonthDay('1991-02-29')).toBeNull();
    expect(dobToMonthDay('1992-02-29')).toBe('02-29');
    expect(dobToMonthDay('nope')).toBeNull();
  });
  it('computes the next 09:00 IST run', () => {
    expect(nextScheduledRun(new Date('2026-10-29T04:00:00Z')).toISOString()).toBe('2026-10-30T03:30:00.000Z');
    expect(nextScheduledRun(new Date('2026-10-29T01:00:00Z')).toISOString()).toBe('2026-10-29T03:30:00.000Z');
  });
});

describe('config and idempotency keys', () => {
  it('never lets the daily limit exceed the hard cap and falls back to safe defaults', () => {
    const c = normalizeEmailConfig({ dailyLimit: 500, monthlyDay: 5, targetBatches: [3, 3, 1, 'x', 999] });
    expect(c.dailyLimit).toBe(INDIVIDUAL_DAILY_HARD_LIMIT);
    expect(c.monthlyDay).toBe(1);
    expect(c.targetBatches).toEqual([1, 3]);
    expect(normalizeEmailConfig(undefined).welcomeEnabled).toBe(true);
  });
  it('builds deterministic queue ids', () => {
    expect(welcomeQueueId('u1')).toBe('welcome_u1');
    expect(birthdayQueueId('u1', 2026)).toBe('birthday_u1_2026');
    expect(reminderQueueId('meetup', 7, '2026-11')).toBe('reminder_meetup_7_2026-11');
  });
  it('rejects malformed or header-injecting addresses', () => {
    expect(isValidEmail('a.b+c@x.co.in')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('x@y.com\nBcc: z@z.com')).toBe(false);
  });
});

describe('email templates', () => {
  it('escapes member-supplied values and renders lists and links', () => {
    const r = renderEmail(DEFAULT_TEMPLATES.welcome, personVars('<b>Asha</b> Raman', 7));
    expect(r.html).not.toContain('<b>Asha');
    expect(r.html).toContain('&lt;b&gt;');
    expect(r.html).toContain('<ul');
    expect(r.html).toContain('<a href="https://bimalumni.in/"');
  });
  it('keeps unknown placeholders visible and detects them', () => {
    expect(substitute('Hi {{nope}}', {})).toBe('Hi {{nope}}');
    expect(unknownVariables('{{firstName}} {{oops}}', 'welcome')).toEqual(['oops']);
  });
  it('strips line breaks from the subject', () => {
    expect(renderEmail({ subject: 'a{{x}}b', body: 'y' }, { x: '1\r\nBcc: z' }).subject).not.toMatch(/[\r\n]/);
  });
  it('falls back to defaults for missing stored templates', () => {
    const t = resolveTemplates({ welcome: { subject: 'S', body: 'B' }, birthday: { subject: '', body: 'x' } });
    expect(t.welcome.subject).toBe('S');
    expect(t.birthday.subject).toBe(DEFAULT_TEMPLATES.birthday.subject);
  });
  it('fills the meetup reminder with the third weekend and the Thursday deadline', () => {
    const v = reminderVars('meetup', 7, istDate(new Date('2026-10-01T04:00:00Z')));
    expect(v.saturdayDate).toBe('Saturday, 17 October');
    expect(v.sundayDate).toBe('Sunday, 18 October');
    expect(v.registrationDeadline).toBe('Thursday, 15 October, 11:59 PM IST');
  });
});

describe('batches grow automatically each year', () => {
  it('adds one batch every calendar year (BIM43 in 2026, BIM44 in 2027)', async () => {
    const { maxBatchNumberAt, batchLabel } = await import('../batches');
    expect(maxBatchNumberAt(new Date('2026-12-31T23:59:59Z'))).toBe(43);
    expect(maxBatchNumberAt(new Date('2027-01-01T00:00:00Z'))).toBe(44);
    expect(maxBatchNumberAt(new Date('2035-06-01T00:00:00Z'))).toBe(52);
    expect(maxBatchNumberAt(new Date('1970-01-01T00:00:00Z'))).toBe(43); // wrong device clock never shrinks the list
    expect(batchLabel(44)).toBe('BIM44 (2027\u20132029)');
  });
});
