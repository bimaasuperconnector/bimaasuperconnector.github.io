import { useEffect, useState } from 'react';
import { Container } from '../components/ui/Container';
import { LinkButton } from '../components/ui/Button';
import { getPublicStats, type PublicStats } from '../firebase/repositories/publicStatsRepository';

export function LandingPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicStats().then((result) => {
      if (!cancelled) setStats(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* hero-band: white canvas, no gradient, whitespace as atmosphere */}
      <section className="py-section">
        <Container className="flex flex-col items-start gap-lg">
          <h1 className="max-w-[720px] text-display-lg text-ink">
            One alumni network. A new connection every month.
          </h1>
          <p className="max-w-[560px] text-body-md text-body">
            SuperConnector keeps the batch directory, job leads, and events in one
            place, then quietly pairs you with someone from the network each
            month — no cold outreach required.
          </p>
          <div className="flex gap-md">
            <LinkButton href="/login" variant="primary">
              Sign in with Google
            </LinkButton>
            <LinkButton href="/#how-it-works" variant="secondary">
              How it works
            </LinkButton>
          </div>

          {/* Safe aggregate stats only — ARCHITECTURE.md: "Public
              landing page exposes only safe aggregate statistics."
              Sourced from the one public systemConfig/publicStats
              document (see publicStatsRepository.ts); renders nothing
              until that document has real data, so a fresh deployment
              never shows a misleading row of zeros. Kept inside the
              same white hero band (not its own section) so the page's
              established white → coral → white → cream → dark → light
              rhythm isn't disrupted by an extra consecutive white
              band. */}
          {stats && (
            <div className="mt-md flex flex-wrap gap-xl border-t border-hairline pt-lg text-body-md text-body">
              <div>
                <p className="text-title-md text-ink">{stats.approvedMembers}+</p>
                <p>Approved alumni</p>
              </div>
              <div>
                <p className="text-title-md text-ink">{stats.connectionsMade}+</p>
                <p>Connections made</p>
              </div>
              <div>
                <p className="text-title-md text-ink">{stats.eventsHosted}+</p>
                <p>Events hosted</p>
              </div>
              <div>
                <p className="text-title-md text-ink">{stats.foundersInNetwork}+</p>
                <p>Founders in the network</p>
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* signature-coral-card */}
      <section className="py-section">
        <Container>
          <div className="rounded-lg bg-signature-coral p-xxl text-on-primary" id="how-it-works">
            <h2 className="max-w-[560px] text-display-md">
              Every third weekend, we introduce you to one alum worth knowing.
            </h2>
            <p className="mt-md max-w-[520px] text-body-md">
              Register once a month, tell us who you'd like to meet, and
              SuperConnector's matching engine handles the rest — a one-to-one
              chat or a small circle, sent straight to your calendar.
            </p>
            <LinkButton href="/login" variant="secondary-on-dark" className="mt-lg">
              Get matched next cycle
            </LinkButton>
          </div>
        </Container>
      </section>

      {/* cream-callout-card */}
      <section className="py-section" id="network">
        <Container>
          <div className="rounded-md bg-signature-cream p-lg text-ink">
            <h2 className="text-title-lg">Built around the batch, not a feed</h2>
            <p className="mt-sm max-w-[640px] text-body-md text-body">
              Search by batch, organization, city, or skill. See who's founded
              something, who's hiring, and who's open to new opportunities —
              without scrolling through noise.
            </p>
          </div>
        </Container>
      </section>

      {/* hero-card-dark */}
      <section className="py-section">
        <Container>
          <div className="rounded-lg bg-surface-dark p-xxl text-on-dark">
            <h2 className="max-w-[560px] text-display-md">
              Jobs, events, and open-to-work — kept inside the alumni circle.
            </h2>
            <p className="mt-md max-w-[520px] text-body-md">
              Post a role, host a meetup, or flag that you're exploring what's
              next. Everything here is visible only to signed-in, approved
              alumni.
            </p>
          </div>
        </Container>
      </section>

      {/* cta-band-light */}
      <section className="py-section">
        <Container>
          <div className="rounded-lg bg-surface-strong p-xxl text-ink">
            <h2 className="max-w-[520px] text-display-md">
              Sign in with your Google account to see if you're already on the
              list.
            </h2>
            <LinkButton href="/login" variant="primary" className="mt-lg">
              Sign in with Google
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
