import type { DirectoryEntry } from './directoryIndexFormat';

/**
 * Name matching for the local directory index. Pure and Firestore-free, so
 * it is unit-tested (src/lib/__tests__/nameSearch.test.ts) and costs no
 * reads: it runs over the member list already held in memory.
 *
 * What it understands, with no first/middle/last-name fields required:
 *  - ANY word of a name: "balaji" finds "Sandeep Balaji";
 *  - several words, in any order: "balaji sandeep", "sand bal";
 *  - the start of a word ("bal"), with weaker support for the middle of a
 *    word ("laji") once the typed piece has 3+ letters;
 *  - accents and punctuation are ignored ("Müller" / "muller", "O'Neil" / "oneil");
 *  - a single small typo ("sandep" → "Sandeep"), but ONLY when nothing
 *    matched exactly, so typo tolerance never pollutes good results.
 */

export interface IndexedEntry extends DirectoryEntry {
  /** Normalised full name (lowercase, no accents, single spaces). */
  norm: string;
  /** Normalised words of the name. */
  words: string[];
}

/** Lowercase, strip accents, turn punctuation into spaces, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '') // O'Neil → oneil
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function indexEntry(entry: DirectoryEntry): IndexedEntry {
  const norm = normalizeText(entry.name);
  return { ...entry, norm, words: norm === '' ? [] : norm.split(' ') };
}

/** Cap on how many ranked matches are kept — plenty for paging, bounded in memory. */
export const MAX_MATCHES = 300;

const SCORE_EXACT_WORD = 6;
const SCORE_WORD_PREFIX = 4;
const SCORE_SUBSTRING = 2;
const SCORE_FUZZY = 1;

/** True when `a` and `b` differ by at most one insertion, deletion, substitution or adjacent swap. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (i === la || i === lb) return true; // one string is the other plus/minus a trailing char
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true; // swap
    return false;
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Best score of one typed token against the entry's still-unused words; -1 if none. */
function matchToken(token: string, entry: IndexedEntry, used: boolean[], fuzzy: boolean): { score: number; at: number } {
  let best = -1;
  let bestAt = -1;
  for (let i = 0; i < entry.words.length; i++) {
    if (used[i]) continue;
    const word = entry.words[i];
    let score = -1;
    if (word === token) score = SCORE_EXACT_WORD;
    else if (word.startsWith(token)) score = SCORE_WORD_PREFIX;
    else if (token.length >= 3 && word.includes(token)) score = SCORE_SUBSTRING;
    else if (fuzzy && token.length >= 4) {
      // Compare against the whole word and against a same-length prefix of it, so a typo in a
      // half-typed word ("sandep" for "sandeep") is forgiven too.
      if (withinOneEdit(token, word) || withinOneEdit(token, word.slice(0, token.length))) score = SCORE_FUZZY;
    }
    if (score > best) {
      best = score;
      bestAt = i;
    }
  }
  return { score: best, at: bestAt };
}

function scoreEntry(entry: IndexedEntry, tokens: string[], fuzzy: boolean): number {
  const used = Array.from({ length: entry.words.length }, () => false);
  let total = 0;
  let inOrder = true;
  let lastAt = -1;
  for (const token of tokens) {
    const hit = matchToken(token, entry, used, fuzzy);
    if (hit.score < 0) return -1;
    used[hit.at] = true;
    total += hit.score;
    if (hit.at < lastAt) inOrder = false;
    lastAt = hit.at;
  }
  if (!fuzzy) {
    const query = tokens.join(' ');
    if (entry.norm === query) total += 20; // the whole name, exactly
    else if (entry.norm.startsWith(query)) total += 8; // typed from the very start of the name
    else if (inOrder && tokens.length > 1) total += 3; // words typed in the name's own order
    if (entry.words[0] !== undefined && entry.words[0].startsWith(tokens[0])) total += 1;
  }
  return total;
}

/**
 * Ranked entries matching `query` (best first, then alphabetical). An empty
 * query matches nothing — callers decide what an empty box means.
 */
export function searchEntries(entries: IndexedEntry[], query: string): IndexedEntry[] {
  const normalized = normalizeText(query);
  if (normalized === '') return [];
  const tokens = normalized.split(' ');

  const rank = (fuzzy: boolean): IndexedEntry[] => {
    const scored: Array<{ entry: IndexedEntry; score: number }> = [];
    for (const entry of entries) {
      const score = scoreEntry(entry, tokens, fuzzy);
      if (score >= 0) scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score || a.entry.norm.localeCompare(b.entry.norm) || a.entry.uid.localeCompare(b.entry.uid));
    return scored.slice(0, MAX_MATCHES).map((s) => s.entry);
  };

  const exact = rank(false);
  if (exact.length > 0) return exact;
  // Nothing matched as typed: forgive one typo per word (only for words of 4+ letters).
  return tokens.some((t) => t.length >= 4) ? rank(true) : [];
}
