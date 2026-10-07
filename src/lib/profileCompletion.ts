import type { Profile } from '../firebase/repositories/profilesRepository';

/**
 * Profile completeness for the Home dashboard.
 *
 * Pure and Firestore-free: it only inspects the member's own profile that the
 * shell's single live listener has already delivered, so showing the score
 * costs ZERO additional Firestore reads or writes. Nothing here is stored — the
 * percentage is recomputed from the profile whenever it changes.
 *
 * Weights add up to exactly 100, so 100% means every item is done.
 * (Separate from the stored `isComplete` flag, which only gates directory
 * visibility and is deliberately left untouched.)
 */
export interface CompletionItem {
  id: string;
  /** Short call to action, e.g. "Add a profile photo". */
  prompt: string;
  weight: number;
  done: boolean;
  /** Where the member goes to fix it. */
  to: string;
}

export interface ProfileCompletion {
  percent: number;
  items: CompletionItem[];
  /** Not-done items, highest weight first. */
  missing: CompletionItem[];
  isComplete: boolean;
}

const EDIT_PROFILE = '/app/profile?edit=1';
// Skills, interests and networking purpose are edited on the SuperConnector page.
const EDIT_CONNECTOR = '/app/superconnector';

const filled = (value: string | null | undefined) => (value ?? '').trim().length > 0;

export function computeProfileCompletion(profile: Profile | null): ProfileCompletion {
  const p = profile;
  const items: CompletionItem[] = [
    { id: 'photo', prompt: 'Add a profile photo', weight: 10, done: filled(p?.photoURL), to: EDIT_PROFILE },
    { id: 'batch', prompt: 'Choose your batch', weight: 10, done: p?.batchNumber != null, to: EDIT_PROFILE },
    { id: 'headline', prompt: 'Write a headline', weight: 10, done: filled(p?.headline), to: EDIT_PROFILE },
    { id: 'bio', prompt: 'Tell people about yourself', weight: 10, done: filled(p?.bio), to: EDIT_PROFILE },
    { id: 'location', prompt: 'Add your city', weight: 10, done: filled(p?.location), to: EDIT_PROFILE },
    {
      id: 'work',
      prompt: 'Add where you work',
      weight: 15,
      done: (p?.organizations ?? []).some((o) => filled(o.name)),
      to: EDIT_PROFILE,
    },
    {
      id: 'education',
      prompt: 'Add your education',
      weight: 10,
      done: (p?.education ?? []).some((e) => filled(e.institution)),
      to: EDIT_PROFILE,
    },
    { id: 'skills', prompt: 'Add at least 3 skills', weight: 10, done: (p?.skills ?? []).length >= 3, to: EDIT_CONNECTOR },
    { id: 'interests', prompt: 'Pick your interests', weight: 5, done: (p?.interests ?? []).length >= 1, to: EDIT_CONNECTOR },
    {
      id: 'purpose',
      prompt: 'Say what you’re looking for',
      weight: 5,
      done: (p?.networkingPurpose ?? []).length >= 1,
      to: EDIT_CONNECTOR,
    },
    {
      id: 'links',
      prompt: 'Link your LinkedIn or website',
      weight: 5,
      done: filled(p?.links?.linkedin) || filled(p?.links?.website),
      to: EDIT_PROFILE,
    },
  ];

  const percent = items.reduce((sum, i) => sum + (i.done ? i.weight : 0), 0);
  const missing = items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight);
  return { percent, items, missing, isComplete: missing.length === 0 };
}
