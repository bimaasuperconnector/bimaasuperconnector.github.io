/**
 * "Other" (5%) — the spec doesn't say what this is. Interpreted here as
 * a cross-batch diversity bonus: alumni from different batches likely
 * don't already know each other and benefit more from an introduction,
 * so pairing across batches scores slightly higher than pairing within
 * the same batch. This is a placeholder interpretation, not a
 * requirement — deliberately isolated in its own function so it can be
 * swapped for something else without touching the rest of the scoring
 * pipeline.
 */
export function otherFactor(batchNumberA: number | null, batchNumberB: number | null): number {
  if (batchNumberA === null || batchNumberB === null) return 0;
  return batchNumberA === batchNumberB ? 0 : 1;
}
