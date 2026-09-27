/**
 * Controlled reference data for normalizing free-text city input into a
 * consistent canonical spelling — the concrete implementation of Phase
 * 14's "Normalize geography (e.g. Bengaluru/Bangalore) using controlled
 * reference data" requirement (FEATURE_SUPERCONNECTOR.md). Pure and
 * Firestore-free, same precedent as src/lib/batches.ts, src/lib/cycles.ts
 * and src/lib/events.ts, so both the profile-save path
 * (profilesRepository.ts) and the Phase 13 event-targeting path
 * (TargetingEditor.tsx / firestore.rules' canSeeEvent()) resolve a typed
 * city against the exact same table instead of duplicating it.
 *
 * Scope, flagged honestly rather than presented as exhaustive (same
 * posture as every prior phase's named-but-not-guaranteed-complete
 * reference data in this project): this starts with the exact
 * "Bengaluru/Bangalore" example ARCHITECTURE.md names, plus a handful of
 * other well-known English-era Indian city renamings, since that's this
 * alumni base's most likely source of "same city, different spelling"
 * mismatches. A city typed that ISN'T in this table is never rejected —
 * it is still canonicalized (trimmed, whitespace-collapsed, consistently
 * cased) so at least "chennai" / "Chennai " / "CHENNAI" collapse to one
 * segment/targeting key, even though it won't catch a synonym this table
 * doesn't yet know about. Extending CITY_ALIASES is a one-line,
 * non-breaking change — existing canonical spellings for already-known
 * cities are untouched, and it never requires a schema migration.
 */

// alias (lowercase, trimmed) -> canonical display spelling
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  bangaluru: 'Bengaluru', // common misspelling
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  madras: 'Chennai',
  chennai: 'Chennai',
  calcutta: 'Kolkata',
  kolkata: 'Kolkata',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  ncr: 'Delhi',
  'delhi ncr': 'Delhi',
  baroda: 'Vadodara',
  vadodara: 'Vadodara',
  poona: 'Pune',
  pune: 'Pune',
  hyderabad: 'Hyderabad',
  secunderabad: 'Hyderabad',
  cochin: 'Kochi',
  kochi: 'Kochi',
  trivandrum: 'Thiruvananthapuram',
  thiruvananthapuram: 'Thiruvananthapuram',
  mysore: 'Mysuru',
  mysuru: 'Mysuru',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
};

function collapseWhitespace(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function titleCase(cleaned: string): string {
  return cleaned
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

/**
 * Normalizes free-text city input into a canonical display spelling.
 * Empty/whitespace-only input normalizes to ''. Never throws — this
 * must be safe to call on every profile save and every event-targeting
 * edit, including on input that doesn't match anything in the table.
 */
export function normalizeCity(rawInput: string): string {
  const cleaned = collapseWhitespace(rawInput ?? '');
  if (cleaned.length === 0) return '';
  const key = cleaned.toLowerCase();
  return CITY_ALIASES[key] ?? titleCase(cleaned);
}

/** Lowercase form of normalizeCity's output — the actual stored/queried key (profiles.cityCanonicalLower, events.targetCityLower). */
export function normalizeCityLower(rawInput: string): string {
  return normalizeCity(rawInput).toLowerCase();
}
