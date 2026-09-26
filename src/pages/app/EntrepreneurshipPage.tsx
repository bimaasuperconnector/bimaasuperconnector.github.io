import { useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';
import { VentureCard } from '../../components/entrepreneurship/VentureCard';
import {
  type OrganizationEntry,
  type Profile,
  queryDirectory,
} from '../../firebase/repositories/profilesRepository';

interface Venture {
  profile: Profile;
  organization: OrganizationEntry;
}

/**
 * Phase 12 (Entrepreneurship & organization history).
 *
 * FEATURE_SUPERCONNECTOR.md's spec for this phase is two sentences:
 * "Organization history is source of truth. Entrepreneurial
 * organizations automatically feed entrepreneurship views." Both are
 * satisfied structurally, not by anything new added at the data layer:
 *
 * - This page introduces ZERO new Firestore indexes and ZERO new
 *   Rules paths. It reuses `queryDirectory({ mode: 'founders' })`
 *   verbatim — the exact same indexed `hasFounderOrg == true` query,
 *   composite index, and `profiles` Rules path that Directory's
 *   "Entrepreneurs" filter has used since Phase 3.
 * - Every "venture" shown here is read directly off each founder's own
 *   `organizations[]` array (flattened client-side below) — there is
 *   no separate `ventures`/`companies` collection. This matches the
 *   Phase 2 decision to keep a per-organization `isFounder` flag
 *   instead of a top-level field specifically "to align with Phase
 *   12's stated design," and Phase 4's precedent of deriving data from
 *   what already exists rather than introducing a new collection
 *   nothing else needs yet.
 *
 * Interpretation decision flagged for owner review (same posture as
 * Phase 5's factor-mapping and Phase 9's field-splitting decisions):
 * the spec names no entrepreneurship-specific fields (e.g. industry,
 * funding stage, elevator pitch, "looking for a co-founder"). None are
 * invented here — this phase presents exactly the `organizations[]`
 * data a member already enters on their Profile page (name, title,
 * active years, founder flag). If richer venture-specific fields are
 * wanted, that is a schema addition needing its own explicit sign-off,
 * not assumed here.
 */
export function EntrepreneurshipPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(append: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await queryDirectory({ mode: 'founders', cursor: append ? cursor : null });
      setProfiles((prev) => (append ? [...prev, ...page.profiles] : page.profiles));
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      setError("Couldn't load the entrepreneurship directory. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Flattened entirely client-side from profiles already fetched above
  // — zero additional Firestore reads no matter how many founder
  // organizations a member lists (capped at 10 organizations per
  // profile by firestore.rules regardless).
  const ventures = useMemo<Venture[]>(() => {
    const all: Venture[] = [];
    for (const profile of profiles) {
      for (const organization of profile.organizations) {
        if (organization.isFounder) all.push({ profile, organization });
      }
    }
    // Active ventures first, then most recently started.
    all.sort((a, b) => {
      const aActive = a.organization.endYear === null;
      const bActive = b.organization.endYear === null;
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (b.organization.startYear ?? 0) - (a.organization.startYear ?? 0);
    });
    return all;
  }, [profiles]);

  // Same-page refine only — not a new query — matching Directory's
  // established "no free-text search service" precedent from Phase 3.
  const visibleVentures = refineText.trim()
    ? ventures.filter((v) => {
        const needle = refineText.trim().toLowerCase();
        const haystack =
          `${v.organization.name} ${v.organization.title} ${v.profile.displayName}`.toLowerCase();
        return haystack.includes(needle);
      })
    : ventures;

  return (
    <div>
      <h1 className="text-title-lg text-ink">Entrepreneurship</h1>
      <p className="mt-sm text-body-md text-body">
        Alumni-founded ventures, drawn directly from each member's own organization history. Mark
        "I founded/own this" against any organization on your Profile page to appear here.
      </p>

      {ventures.length > 0 && (
        <div className="mt-lg">
          <label className="text-body-md text-muted" htmlFor="venture-refine">
            Filter by organization or founder name
          </label>
          <input
            id="venture-refine"
            type="text"
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="e.g. a company name…"
            className="mt-xs block w-full max-w-[420px] rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>
      )}

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      {!loading && ventures.length === 0 && !error && (
        <p className="mt-lg text-body-md text-muted">
          No alumni have marked a founder/owner organization yet.
        </p>
      )}

      <div className="mt-lg grid gap-md md:grid-cols-2 lg:grid-cols-3">
        {visibleVentures.map((v) => (
          <VentureCard
            key={`${v.profile.uid}_${v.organization.name}_${v.organization.startYear ?? 'na'}`}
            profile={v.profile}
            organization={v.organization}
          />
        ))}
      </div>

      {loading && <p className="mt-lg text-body-md text-muted">Loading…</p>}

      {hasMore && !loading && (
        <div className="mt-lg">
          <Button variant="secondary" onClick={() => void load(true)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
