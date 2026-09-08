/**
 * Normalizes and compares sets of free-text tags (interests, skills,
 * networking purpose). This is deliberately simple string
 * normalization + set arithmetic — not semantic/NLP topic modeling.
 * True topic clustering (e.g. treating "AI" and "Artificial
 * Intelligence" as the same topic) would need a taxonomy or an ML
 * service, which is out of scope without owner approval (same "no paid
 * service without asking" reasoning as Phase 3's search decision).
 */

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizeTags(tags: string[]): Set<string> {
  return new Set(tags.map(normalizeTag).filter((t) => t.length > 0));
}

/**
 * Jaccard similarity: |intersection| / |union|, in [0, 1]. Returns 0 if
 * either set is empty — no data is treated as no evidence of shared
 * interest, not as a free neutral score. This is a deliberate fairness
 * choice: it rewards profile completion rather than papering over gaps.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * "Complementary" proxy: the fraction of the combined pool that is
 * NON-overlapping — i.e. skill diversity. This is a pragmatic
 * simplification, not true semantic complementarity (e.g. recognizing
 * that "product design" and "backend engineering" combine well) — that
 * would need a skills ontology that doesn't exist. Returns 0 if either
 * set is empty, for the same fairness reason as jaccardSimilarity.
 */
export function complementarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  const symmetricDifferenceSize = unionSize - intersectionSize;
  return unionSize === 0 ? 0 : symmetricDifferenceSize / unionSize;
}
