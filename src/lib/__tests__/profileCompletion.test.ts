import { describe, expect, it } from 'vitest';
import { computeProfileCompletion } from '../profileCompletion';
import type { Profile } from '../../firebase/repositories/profilesRepository';

const full = {
  photoURL: 'https://ik.imagekit.io/x/p.webp',
  batchNumber: 12,
  headline: 'Founder',
  bio: 'Hello',
  location: 'Chennai',
  organizations: [{ name: 'Acme', title: 'CEO', startYear: 2020, endYear: null, isFounder: true }],
  education: [{ institution: 'BIM', degree: 'PGDM', field: '', endYear: 2010 }],
  skills: ['a', 'b', 'c'],
  interests: ['x'],
  networkingPurpose: ['mentorship'],
  links: { linkedin: 'https://linkedin.com/in/x', website: '' },
} as unknown as Profile;

describe('computeProfileCompletion', () => {
  it('weights add up to 100 and a full profile is 100%', () => {
    const c = computeProfileCompletion(full);
    expect(c.items.reduce((s, i) => s + i.weight, 0)).toBe(100);
    expect(c.percent).toBe(100);
    expect(c.isComplete).toBe(true);
    expect(c.missing).toHaveLength(0);
  });

  it('a missing profile is 0% with every item outstanding', () => {
    const c = computeProfileCompletion(null);
    expect(c.percent).toBe(0);
    expect(c.isComplete).toBe(false);
    expect(c.missing).toHaveLength(c.items.length);
  });

  it('reports the missing work item first (highest weight) and scores the rest', () => {
    const c = computeProfileCompletion({ ...full, organizations: [], bio: '   ' } as Profile);
    expect(c.percent).toBe(75);
    expect(c.missing[0].id).toBe('work');
  });

  it('needs 3 skills and treats a website as a link', () => {
    const c = computeProfileCompletion({
      ...full,
      skills: ['a', 'b'],
      links: { linkedin: '', website: 'x.com' },
    } as Profile);
    expect(c.items.find((i) => i.id === 'skills')?.done).toBe(false);
    expect(c.items.find((i) => i.id === 'links')?.done).toBe(true);
  });

  it('tolerates older profile documents with missing arrays', () => {
    const c = computeProfileCompletion({ headline: 'Hi' } as unknown as Profile);
    expect(c.percent).toBe(10);
  });
});
