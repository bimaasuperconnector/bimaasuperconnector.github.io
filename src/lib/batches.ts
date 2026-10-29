/**
 * Batch mapping is derived, not hard-coded, and the list GROWS BY ITSELF.
 *
 * Known data points: BIM01 = 1984–1986, BIM35 = 2018–2020, BIM43 = 2026–2028.
 * All fit one formula (each batch starts one year after the previous and
 * spans two years):
 *
 *   startYear(N) = 1983 + N        endYear(N) = startYear(N) + 2
 *
 * One new batch is admitted every calendar year, so the newest batch
 * number is simply `currentYear - 1983` (2026 -> BIM43, 2027 -> BIM44 …).
 * On 1 January (UTC) the next batch appears everywhere at once — profile
 * and sign-up dropdowns, directory filters, event targeting, admin
 * scoping, the email Google Group list — with no code change and no
 * redeploy. Firestore Rules use the same formula on the server clock
 * (`request.time.year() - 1983`, see firestore.rules), so the app and the
 * database always agree. Do not hard-code a list or count of batches
 * anywhere; always derive from this module.
 */

const BATCH_BASE_YEAR = 1983;
/** Never report fewer batches than were admitted when this was written (guards a wrong device clock). */
const MIN_BATCH_NUMBER = 43;

/** Newest batch number on the given date (pure; used by tests). */
export function maxBatchNumberAt(date: Date): number {
  return Math.max(MIN_BATCH_NUMBER, date.getUTCFullYear() - BATCH_BASE_YEAR);
}

/** The highest batch that exists right now. Evaluated on every call, so it rolls over on 1 January by itself. */
export function currentMaxBatchNumber(): number {
  return maxBatchNumberAt(new Date());
}

export interface Batch {
  /** e.g. "BIM07" */
  id: string;
  /** e.g. "BIM07 (1990–1992)" */
  label: string;
  batchNumber: number;
  startYear: number;
  endYear: number;
}

export function batchYears(batchNumber: number): { startYear: number; endYear: number } {
  const startYear = BATCH_BASE_YEAR + batchNumber;
  return { startYear, endYear: startYear + 2 };
}

export function batchId(batchNumber: number): string {
  return `BIM${String(batchNumber).padStart(2, '0')}`;
}

export function batchLabel(batchNumber: number): string {
  const { startYear, endYear } = batchYears(batchNumber);
  return `${batchId(batchNumber)} (${startYear}\u2013${endYear})`;
}

export function isValidBatchNumber(batchNumber: number): boolean {
  return Number.isInteger(batchNumber) && batchNumber >= 1 && batchNumber <= currentMaxBatchNumber();
}

export function allBatches(): Batch[] {
  const batches: Batch[] = [];
  for (let n = 1, max = currentMaxBatchNumber(); n <= max; n++) {
    const { startYear, endYear } = batchYears(n);
    batches.push({ id: batchId(n), label: batchLabel(n), batchNumber: n, startYear, endYear });
  }
  return batches;
}

export function findBatch(batchNumber: number): Batch | undefined {
  if (!isValidBatchNumber(batchNumber)) return undefined;
  const { startYear, endYear } = batchYears(batchNumber);
  return { id: batchId(batchNumber), label: batchLabel(batchNumber), batchNumber, startYear, endYear };
}
