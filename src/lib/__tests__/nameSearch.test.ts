import { describe, expect, it } from 'vitest';
import { type DirectoryEntry } from '../directoryIndexFormat';
import { type IndexedEntry, indexEntry, normalizeText, searchEntries, withinOneEdit } from '../nameSearch';

function entry(uid: string, name: string, extra: Partial<DirectoryEntry> = {}): IndexedEntry {
  return indexEntry({ uid, name, batch: 35, role: '', photoURL: '', founder: false, openToWork: false, ...extra });
}

const people = [
  entry('u1', 'Sandeep Balaji'),
  entry('u2', 'Balaji Subramanian'),
  entry('u3', 'Priya Ramachandran'),
  entry('u4', 'Anita Müller'),
  entry('u5', "Ciaran O'Neil"),
  entry('u6', 'Sandeep Kumar Rao'),
  entry('u7', 'Lakshmi Narayanan Balakrishnan'),
];

const names = (query: string) => searchEntries(people, query).map((e) => e.name);

describe('normalizeText', () => {
  it('lowercases, strips accents and punctuation, collapses spaces', () => {
    expect(normalizeText('  Anita   MÜLLER ')).toBe('anita muller');
    expect(normalizeText("O'Neil")).toBe('oneil');
    expect(normalizeText('Rao-Kumar, S.')).toBe('rao kumar s');
  });
});

describe('searchEntries — the reported bug', () => {
  it('finds a member by LAST name', () => {
    expect(names('balaji')).toContain('Sandeep Balaji');
  });
  it('finds a member by first name', () => {
    expect(names('sandeep')).toEqual(expect.arrayContaining(['Sandeep Balaji', 'Sandeep Kumar Rao']));
  });
  it('finds a member by a middle word', () => {
    expect(names('kumar')).toEqual(['Sandeep Kumar Rao']);
  });
  it('finds by the start of any word', () => {
    expect(names('bal')).toEqual(expect.arrayContaining(['Sandeep Balaji', 'Balaji Subramanian', 'Lakshmi Narayanan Balakrishnan']));
  });
});

describe('searchEntries — multiple words and ranking', () => {
  it('matches several words in any order', () => {
    expect(names('balaji sandeep')).toEqual(['Sandeep Balaji']);
    expect(names('sand bal')).toEqual(['Sandeep Balaji']);
  });
  it('does not let one word satisfy two typed words', () => {
    expect(names('sandeep sandeep')).toEqual([]);
  });
  it('ranks an exact full name first', () => {
    expect(names('sandeep balaji')[0]).toBe('Sandeep Balaji');
  });
  it('ranks a name typed from its start above a later-word match', () => {
    expect(names('balaji')[0]).toBe('Balaji Subramanian');
  });
  it('an exact word outranks a mere prefix', () => {
    const list = [entry('a', 'Rao Kumar'), entry('b', 'Raoul Smith')];
    expect(searchEntries(list, 'rao').map((e) => e.uid)).toEqual(['a', 'b']);
  });
});

describe('searchEntries — tolerance', () => {
  it('ignores accents and apostrophes both ways', () => {
    expect(names('muller')).toEqual(['Anita Müller']);
    expect(names('müller')).toEqual(['Anita Müller']);
    expect(names('oneil')).toEqual(["Ciaran O'Neil"]);
  });
  it('matches inside a word once 3+ letters are typed', () => {
    expect(names('laji')).toContain('Sandeep Balaji');
    expect(names('la')).not.toContain('Sandeep Balaji');
  });
  it('forgives one typo only when nothing matched exactly', () => {
    expect(names('sandep')).toEqual(expect.arrayContaining(['Sandeep Balaji']));
    expect(names('balaje')).toEqual(expect.arrayContaining(['Sandeep Balaji', 'Balaji Subramanian']));
  });
  it('does not apply typo tolerance when exact matches exist', () => {
    const list = [entry('a', 'Sandeep Rao'), entry('b', 'Sandip Rao')];
    expect(searchEntries(list, 'sandeep').map((e) => e.uid)).toEqual(['a']);
  });
  it('does not guess on very short words', () => {
    expect(names('zz')).toEqual([]);
    expect(names('xyz')).toEqual([]);
  });
  it('an empty or symbol-only query matches nothing', () => {
    expect(names('')).toEqual([]);
    expect(names('   ')).toEqual([]);
    expect(names('...')).toEqual([]);
  });
});

describe('searchEntries — bounds', () => {
  it('caps the number of ranked matches kept', () => {
    const many = Array.from({ length: 1000 }, (_, i) => entry(`u${i}`, `Ravi Person${i}`));
    expect(searchEntries(many, 'ravi').length).toBeLessThanOrEqual(300);
  });
});

describe('withinOneEdit', () => {
  it('accepts equal, substitution, insertion, deletion and swap', () => {
    expect(withinOneEdit('abcd', 'abcd')).toBe(true);
    expect(withinOneEdit('abcd', 'abxd')).toBe(true);
    expect(withinOneEdit('abcd', 'abcde')).toBe(true);
    expect(withinOneEdit('abcde', 'abde')).toBe(true);
    expect(withinOneEdit('abcd', 'abdc')).toBe(true);
  });
  it('rejects two edits', () => {
    expect(withinOneEdit('abcd', 'axyd')).toBe(false);
    expect(withinOneEdit('abcd', 'abcdef')).toBe(false);
  });
});
