import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { RouterLinkButton } from '../components/ui/Button';
import { ProgramIllustration } from '../components/landing/ProgramIllustration';
import { useAuth } from '../context/AuthContext';
import { useUserRecord } from '../context/UserRecordContext';
import { getPublicStats, type PublicStats } from '../firebase/repositories/publicStatsRepository';

function GoogleMark() {
  // Official four-colour "G". Sits on a white disc so it reads on the dark button.
  return (
    <span className="mr-sm inline-flex h-6 w-6 items-center justify-center rounded-full bg-white" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-4 w-4">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </span>
  );
}

function GoogleSignInButton({ className = '' }: { className?: string }) {
  return (
    <RouterLinkButton to="/login" variant="primary" className={className}>
      <GoogleMark />
      Sign in with Google
    </RouterLinkButton>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-[3px] h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

const HOW_IT_WORKS: { term: string; detail: string }[] = [
  {
    term: 'Register by Thursday',
    detail: 'Registration for each cycle closes at 11:59 PM IST on the Thursday before the third weekend.',
  },
  {
    term: 'Pick your format',
    detail: 'One-to-one, or a small circle of 3 to 6. Choose Saturday, Sunday, or either.',
  },
  {
    term: 'We do the matching',
    detail: 'Shared interests, skills and goals drive the match, and we avoid pairing you with the same person twice.',
  },
  {
    term: 'Meet, then rate',
    detail: 'A calendar invite with a Google Meet link lands in your inbox. Afterwards, tell us how it went.',
  },
];

const FIND_BY: { term: string; detail: string }[] = [
  { term: 'Batch', detail: 'Your batchmates, and the batches around yours.' },
  { term: 'City', detail: 'Who is in your city before you travel there.' },
  { term: 'Organization', detail: 'Where alumni work today, and where they have been.' },
  { term: 'Skill', detail: 'Someone who has done what you are about to do.' },
];

const INSIDE: { term: string; detail: string }[] = [
  { term: 'Jobs', detail: 'Post a role or find one. Every listing is reviewed before it goes live.' },
  { term: 'Events', detail: 'Host a meetup, online or in person, for everyone, a batch, or a city.' },
  { term: 'Open to work', detail: 'Let alumni know you are exploring what is next, and the roles you want.' },
];

export function LandingPage() {
  const { user, loading: authLoading, configured } = useAuth();
  const { record, loading: recordLoading, needsOnboarding } = useUserRecord();
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

  // A member who is already signed in (Firebase keeps the session across
  // closed tabs and the installed app) should land in the app, not be
  // shown "Sign in with Google" again — the public landing page is for
  // signed-out visitors.
  if (configured && !authLoading && user && !recordLoading) {
    if (record?.status === 'approved') return <Navigate to="/app" replace />;
    if (record || needsOnboarding) return <Navigate to="/pending" replace />;
  }

  return (
    <>
      {/* hero-band: white canvas, no gradient — whitespace is the atmosphere */}
      <section className="pb-12 pt-10 md:pb-16 md:pt-16 lg:pb-section lg:pt-20">
        <Container>
          <div className="grid items-center gap-xxl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <h1 className="text-balance text-[clamp(2rem,5.2vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.015em] text-ink">
                <span className="block">Small circles.</span>
                <span className="block">Real conversations.</span>
                <span className="block">One weekend a month.</span>
              </h1>

              <p className="mt-lg max-w-[34rem] text-[17px] leading-relaxed text-body md:text-lg md:leading-relaxed">
                SuperConnector is the exclusive alumni network for students of BIM, Trichy. Enrol each
                month, get matched with fellow alumni in a small circle, and meet on the third weekend.
              </p>

              <div className="mt-xl flex flex-col gap-md sm:flex-row">
                <GoogleSignInButton />
                <RouterLinkButton to="/#how-it-works" variant="secondary">
                  See how it works
                </RouterLinkButton>
              </div>

              <p className="mt-lg flex max-w-[34rem] gap-xs text-[14px] leading-snug text-muted">
                <LockIcon />
                <span>Members only. Every account is approved before it can see the network.</span>
              </p>
            </div>

            <div>
              <ProgramIllustration className="mx-auto block h-auto w-full max-w-[400px] lg:ml-auto lg:mr-0 lg:max-w-[460px]" />
            </div>
          </div>

          {/* Safe aggregate stats only — ARCHITECTURE.md: "Public landing page
              exposes only safe aggregate statistics." Sourced from the one
              public systemConfig/publicStats document (see
              publicStatsRepository.ts, cached client-side); renders nothing
              until that document has real data, so a fresh deployment never
              shows a row of zeros. */}
          {stats && (
            <dl className="mt-14 grid grid-cols-2 gap-x-lg gap-y-lg border-t border-hairline pt-xl md:mt-16 md:grid-cols-4">
              {[
                { label: 'Approved alumni', value: stats.approvedMembers },
                { label: 'Connections made', value: stats.connectionsMade },
                { label: 'Events hosted', value: stats.eventsHosted },
                { label: 'Founders in the network', value: stats.foundersInNetwork },
              ].map((s) => (
                <div key={s.label}>
                  <dd className="text-[28px] font-medium leading-none tabular-nums text-ink">{s.value}+</dd>
                  <dt className="mt-xs text-[14px] text-muted">{s.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </Container>
      </section>

      {/* signature-coral-card */}
      <section id="how-it-works" className="py-md md:py-lg">
        <Container>
          <div className="grid gap-xl rounded-lg bg-signature-coral p-lg text-on-primary md:p-xxl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              {/* Heading colour is set explicitly: the global h1–h3 rule sets
                  text-ink directly on the element, which overrides anything
                  inherited from this card. */}
              <h2 className="text-balance text-[28px] font-medium leading-tight text-on-primary md:text-display-md">
                Every third weekend, we introduce you to alumni worth knowing.
              </h2>
              <p className="mt-md max-w-[30rem] text-base leading-relaxed text-white/90">
                Register once a month, tell us who you'd like to meet, and SuperConnector's matching
                engine handles the rest, sent straight to your calendar.
              </p>
              <RouterLinkButton to="/login" variant="secondary-on-dark" className="mt-lg">
                Get matched next cycle
              </RouterLinkButton>
            </div>

            <dl className="divide-y divide-white/25 border-y border-white/25">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.term} className="py-md md:grid md:grid-cols-[10rem_1fr] md:gap-lg">
                  <dt className="text-base font-medium text-on-primary">{item.term}</dt>
                  <dd className="mt-xxs text-[15px] leading-relaxed text-white/90 md:mt-0">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      {/* cream-callout-card */}
      <section id="network" className="py-md md:py-lg">
        <Container>
          <div className="grid gap-xl rounded-lg bg-signature-cream p-lg text-ink md:p-xxl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <h2 className="text-balance text-[28px] font-medium leading-tight text-ink md:text-display-md">
                Built around the batch, not a feed
              </h2>
              <p className="mt-md max-w-[30rem] text-base leading-relaxed text-body">
                Search the BIM, Trichy directory by who people are and what they do. See who has founded
                something, who is hiring, and who is open to new opportunities, without scrolling through
                noise.
              </p>
            </div>

            <dl className="grid gap-x-xl gap-y-lg sm:grid-cols-2">
              {FIND_BY.map((item) => (
                <div key={item.term} className="border-t border-ink/20 pt-md">
                  <dt className="text-base font-medium text-ink">{item.term}</dt>
                  <dd className="mt-xxs text-[15px] leading-relaxed text-body">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      {/* hero-card-dark */}
      <section className="py-md md:py-lg">
        <Container>
          <div className="rounded-lg bg-surface-dark p-lg text-on-dark md:p-xxl">
            <h2 className="max-w-[40rem] text-balance text-[28px] font-medium leading-tight text-on-dark md:text-display-md">
              Jobs, events, and open-to-work — kept inside the alumni circle.
            </h2>
            <p className="mt-md max-w-[36rem] text-base leading-relaxed text-white/80">
              Post a role, host a meetup, or flag that you're exploring what's next. Everything here is
              visible only to signed-in, approved alumni.
            </p>

            <dl className="mt-xl grid gap-lg border-t border-white/20 pt-lg md:grid-cols-3 md:gap-xl">
              {INSIDE.map((item) => (
                <div key={item.term}>
                  <dt className="text-base font-medium text-on-dark">{item.term}</dt>
                  <dd className="mt-xxs text-[15px] leading-relaxed text-white/80">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      {/* cta-band-light */}
      <section className="pb-16 pt-md md:pb-section md:pt-lg">
        <Container>
          <div className="flex flex-col gap-lg rounded-lg bg-surface-strong p-lg text-ink md:flex-row md:items-center md:justify-between md:gap-xl md:p-xxl">
            <div>
              <h2 className="max-w-[28rem] text-balance text-[28px] font-medium leading-tight text-ink md:text-display-md">
                Ready to meet your circle?
              </h2>
              <p className="mt-md max-w-[30rem] text-base leading-relaxed text-body">
                Sign in with Google to join the next cycle. New accounts are approved before they can
                see the network.
              </p>
            </div>
            <GoogleSignInButton className="shrink-0 self-start md:self-auto" />
          </div>
        </Container>
      </section>
    </>
  );
}
