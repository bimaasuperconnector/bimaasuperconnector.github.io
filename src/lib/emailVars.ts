import { batchId, batchLabel } from './batches';
import { APP_URL, istDate, type IstDate, type ReminderType } from './emailConfig';
import { computeCycleSchedule, currentCycle } from './cycles';
import type { TemplateVars } from './emailTemplates';

/**
 * Builds the {{variables}} for a real email. Pure — used by the automation
 * job (and nothing else needs it in the browser; the console preview uses
 * the fixed sample values in emailTemplates.ts).
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month1to12: number): string {
  return MONTHS[month1to12 - 1];
}

function longDate(year: number, month1to12: number, day: number): string {
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month1to12 - 1, day)).getUTCDay()];
  return `${weekday}, ${day} ${MONTHS[month1to12 - 1]}`;
}

export function firstNameOf(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0];
  return first || 'there';
}

export function personVars(displayName: string, batchNumber: number | null): TemplateVars {
  const hasBatch = typeof batchNumber === 'number';
  return {
    firstName: firstNameOf(displayName),
    fullName: displayName.trim() || 'there',
    batchLabel: hasBatch ? batchLabel(batchNumber) : 'BIM',
    batchId: hasBatch ? batchId(batchNumber) : 'BIM',
    appUrl: APP_URL,
  };
}

export function reminderVars(_type: ReminderType, batchNumber: number, today: IstDate): TemplateVars {
  // currentCycle works on plain calendar dates; noon avoids any edge at midnight.
  const cycle = currentCycle(new Date(today.year, today.month - 1, today.day, 12));
  const deadline = istDate(computeCycleSchedule(cycle).registrationClosesAt);
  return {
    batchLabel: batchLabel(batchNumber),
    batchId: batchId(batchNumber),
    monthName: MONTHS[cycle.month - 1],
    year: String(cycle.year),
    saturdayDate: longDate(cycle.year, cycle.month, cycle.saturday.getDate()),
    sundayDate: longDate(cycle.sunday.getFullYear(), cycle.sunday.getMonth() + 1, cycle.sunday.getDate()),
    registrationDeadline: `${longDate(deadline.year, deadline.month, deadline.day)}, 11:59 PM IST`,
    superconnectorUrl: `${APP_URL}app/superconnector`,
    jobsUrl: `${APP_URL}app/jobs`,
    appUrl: APP_URL,
  };
}
