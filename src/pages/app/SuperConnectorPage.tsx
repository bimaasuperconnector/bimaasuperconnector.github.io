import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOwnProfile } from '../../context/OwnProfileContext';
import { Button, RouterLinkButton } from '../../components/ui/Button';
import { CheckIcon, ClockIcon, OneToOneIcon, SmallCircleIcon } from '../../components/icons/NavIcons';
import { ErrorNote, SkeletonList } from '../../components/ui/PageHeader';
import { ChoiceTile } from '../../components/superconnector/ChoiceTile';
import { SuperConnectorPrefsCard } from '../../components/superconnector/SuperConnectorPrefsCard';
import {
  MODE_LABELS,
  SLOT_LABELS,
  SMALL_CIRCLE_MAX,
  SMALL_CIRCLE_MIN,
  computeCycleSchedule,
  currentCycle,
  type RegistrationMode,
  type RegistrationSlot,
} from '../../lib/cycles';
import { hasCompletePrefs } from '../../lib/superconnectorPrefs';
import {
  type Registration,
  getOwnRegistration,
  saveOwnRegistration,
  withdrawOwnRegistration,
} from '../../firebase/repositories/registrationsRepository';
import { getCycleState } from '../../firebase/repositories/cyclesRepository';
import { PendingFeedback } from '../../components/superconnector/PendingFeedback';

/** A numbered step: the form really is a sequence (details, day, format). */
function Step({
  number,
  title,
  hint,
  done,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`sc-step-${number}`}>
      <div className="flex items-start gap-sm">
        <span
          aria-hidden="true"
          className={`mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-md font-medium ${
            done ? 'bg-signature-mint text-ink' : 'bg-surface-strong text-ink'
          }`}
        >
          {done ? <CheckIcon width={16} height={16} strokeWidth={2.5} /> : number}
        </span>
        <div className="min-w-0">
          <h2 id={`sc-step-${number}`} className="font-haas-disp text-title-md text-ink">
            {title}
          </h2>
          {hint && <p className="mt-xxs text-body-md text-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-md md:pl-[44px]">{children}</div>
    </section>
  );
}

function DateBlock({ weekday, day }: { weekday: string; day: number }) {
  return (
    <div className="flex min-w-[96px] flex-col items-center rounded-lg bg-on-primary/10 px-lg py-md">
      <span className="text-body-md text-on-primary/80">{weekday}</span>
      <span className="font-haas-disp text-display-xl text-on-primary">{day}</span>
    </div>
  );
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

export function SuperConnectorPage() {
  const { user } = useAuth();
  const { profile, loaded: profileLoaded, failed: profileFailed } = useOwnProfile();
  const cycle = currentCycle();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<RegistrationSlot>('saturday');
  // Small Circle is the default format for a member who hasn't registered yet.
  const [mode, setMode] = useState<RegistrationMode>('small_circle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefsInitialised, setPrefsInitialised] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([getOwnRegistration(cycle.id, user.uid), getCycleState(cycle.id)])
      .then(([result, cycleState]) => {
        if (cancelled) return;
        setRegistration(result);
        if (result) {
          setSlot(result.slot);
          setMode(result.mode);
        }
        // No cycle-state doc yet (automation hasn't run for this cycleId)
        // defaults to open, same as the rules themselves default.
        setRegistrationOpen(!cycleState || cycleState.status === 'registration_open');
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your registration. Please refresh.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // cycle.id is derived from the current date at render time and won't
    // change within a session, so it's intentionally omitted here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Once the member's own profile has arrived (from the shell's single live
  // listener, so no extra read), open the details card for editing only if
  // something required is still blank.
  useEffect(() => {
    if (!profileLoaded || prefsInitialised) return;
    setEditingPrefs(!hasCompletePrefs(profile));
    setPrefsInitialised(true);
  }, [profileLoaded, prefsInitialised, profile]);

  const prefsSaved = hasCompletePrefs(profile);
  const canChoose = registrationOpen && prefsSaved && !editingPrefs;
  const dirty = !registration || registration.slot !== slot || registration.mode !== mode;

  const satDate = cycle.saturday.toLocaleDateString(undefined, DAY_FORMAT);
  const sunDate = cycle.sunday.toLocaleDateString(undefined, DAY_FORMAT);
  const monthYear = cycle.saturday.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const closesAt = computeCycleSchedule(cycle).registrationClosesAt.toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  const pickedDay =
    slot === 'saturday' ? `Saturday ${satDate}` : slot === 'sunday' ? `Sunday ${sunDate}` : 'Saturday or Sunday';

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await saveOwnRegistration(user.uid, cycle.id, slot, mode, registration !== null);
      setRegistration({ uid: user.uid, cycleId: cycle.id, slot, mode });
    } catch {
      setError("Couldn't save your registration. Please refresh and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleWithdraw() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await withdrawOwnRegistration(cycle.id, user.uid);
      setRegistration(null);
    } catch {
      setError("Couldn't withdraw your registration. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const ready = !loading && profileLoaded && prefsInitialised;

  return (
    <div className="space-y-lg">
      {/* The one bold moment: the weekend itself. */}
      <section className="rounded-lg bg-signature-forest p-lg text-on-primary md:p-xxl">
        <div className="flex flex-wrap items-end justify-between gap-lg">
          <div className="min-w-0 max-w-[46ch]">
            <h1 className="font-haas-disp text-title-lg text-on-primary md:text-display-md">SuperConnector</h1>
            <p className="mt-xs text-body-md text-on-primary/85" style={{ lineHeight: 1.55 }}>
              One conversation a month with someone new from the network. Tell us a little about yourself, choose your
              time and format, and we'll match you closer to the date.
            </p>
          </div>
          <div className="flex items-stretch gap-sm">
            <DateBlock weekday="Saturday" day={cycle.saturday.getDate()} />
            <DateBlock weekday="Sunday" day={cycle.sunday.getDate()} />
          </div>
        </div>
        <div className="mt-lg flex flex-wrap items-center gap-x-lg gap-y-xs text-body-md text-on-primary/85">
          <span>{monthYear}, 5:00–6:00 PM IST</span>
          <span className="flex items-center gap-xs">
            <ClockIcon width={16} height={16} />
            {registrationOpen ? `Registration closes ${closesAt} IST` : 'Registration has closed for this weekend'}
          </span>
        </div>
        {registration && (
          <p className="mt-md inline-flex items-center gap-xs rounded-md bg-signature-mint px-md py-sm text-body-md text-ink">
            <CheckIcon width={16} height={16} strokeWidth={2.5} />
            You're registered for {MODE_LABELS[registration.mode]}, {SLOT_LABELS[registration.slot]}.
          </p>
        )}
      </section>

      <div className="surface-card p-lg md:p-xl">
        {!ready ? (
          <SkeletonList count={3} heightClass="h-24" />
        ) : (
          <div className="space-y-xl">
            {error && <ErrorNote>{error}</ErrorNote>}
            {profileFailed && <ErrorNote>Couldn't load your profile. Please refresh.</ErrorNote>}

            <Step
              number={1}
              title="Your details"
              hint="Saved once and reused every month. Update them any time."
              done={prefsSaved && !editingPrefs}
            >
              {profile && user ? (
                <SuperConnectorPrefsCard
                  user={user}
                  profile={profile}
                  editing={editingPrefs}
                  onEditingChange={setEditingPrefs}
                />
              ) : (
                <div className="rounded-lg bg-surface-soft p-md">
                  <p className="copy">
                    SuperConnector uses your profile to find the right person for you. Set up your profile first, then
                    come back to finish these details.
                  </p>
                  <RouterLinkButton to="/app/profile" variant="secondary" className="mt-md !px-md !py-sm">
                    Set up my profile
                  </RouterLinkButton>
                </div>
              )}
            </Step>

            {!registrationOpen && (
              <p className="flex items-start gap-xs rounded-lg bg-surface-soft p-md text-body-md text-body">
                <ClockIcon width={16} height={16} className="mt-[2px] shrink-0" />
                Registration for this weekend has closed. Matching is starting soon.
                {registration ? ' You can still withdraw if you need to.' : ''}
              </p>
            )}

            <div className={canChoose ? 'space-y-xl' : 'space-y-xl opacity-50'} aria-disabled={!canChoose}>
              <Step
                number={2}
                title="When are you available?"
                hint="Every conversation runs 5:00–6:00 PM IST."
                done={Boolean(registration)}
              >
                <div role="radiogroup" aria-label="When are you available?" className="grid gap-sm sm:grid-cols-3">
                  <ChoiceTile
                    tone="pastel"
                    checked={slot === 'saturday'}
                    disabled={!canChoose}
                    onSelect={() => setSlot('saturday')}
                    title="Saturday"
                    subtitle={satDate}
                    detail="5:00–6:00 PM"
                    swatchClass="bg-signature-peach"
                    fillClass="bg-signature-peach"
                  />
                  <ChoiceTile
                    tone="pastel"
                    checked={slot === 'sunday'}
                    disabled={!canChoose}
                    onSelect={() => setSlot('sunday')}
                    title="Sunday"
                    subtitle={sunDate}
                    detail="5:00–6:00 PM"
                    swatchClass="bg-signature-mint"
                    fillClass="bg-signature-mint"
                  />
                  <ChoiceTile
                    tone="pastel"
                    checked={slot === 'both'}
                    disabled={!canChoose}
                    onSelect={() => setSlot('both')}
                    title="Both days"
                    subtitle="Flexible. We pick the day that fits."
                    detail="5:00–6:00 PM"
                    swatchClass="bg-signature-yellow"
                    fillClass="bg-signature-yellow"
                  />
                </div>
              </Step>

              <Step number={3} title="How would you like to connect?" done={Boolean(registration)}>
                <div role="radiogroup" aria-label="How would you like to connect?" className="grid gap-sm sm:grid-cols-2">
                  <ChoiceTile
                    tone="ink"
                    checked={mode === 'small_circle'}
                    disabled={!canChoose}
                    onSelect={() => setMode('small_circle')}
                    icon={<SmallCircleIcon width={22} height={22} />}
                    title={MODE_LABELS.small_circle}
                    subtitle="A relaxed group conversation"
                    detail={`${SMALL_CIRCLE_MIN}–${SMALL_CIRCLE_MAX} people`}
                  />
                  <ChoiceTile
                    tone="ink"
                    checked={mode === 'one_to_one'}
                    disabled={!canChoose}
                    onSelect={() => setMode('one_to_one')}
                    icon={<OneToOneIcon width={22} height={22} />}
                    title={MODE_LABELS.one_to_one}
                    subtitle="A focused chat with one person"
                    detail="2 people"
                  />
                </div>
              </Step>
            </div>

            {(registrationOpen || registration) && (
              <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-30 -mx-lg flex flex-wrap items-center justify-between gap-md border-t border-hairline bg-canvas px-lg py-sm md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:pl-[44px]">
                {registrationOpen && canChoose ? (
                  <p className="min-w-0 text-body-md text-body">
                    <span className="font-medium text-ink">{MODE_LABELS[mode]}</span> on {pickedDay}
                  </p>
                ) : (
                  <p className="min-w-0 text-body-md text-muted">
                    {registrationOpen ? 'Save your details in step 1 to register.' : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-sm">
                  {registration && (
                    <Button variant="secondary" onClick={() => void handleWithdraw()} disabled={saving}>
                      Withdraw
                    </Button>
                  )}
                  {registrationOpen && (
                    <Button
                      variant="primary"
                      onClick={() => void handleSave()}
                      disabled={saving || !canChoose || !dirty}
                    >
                      {saving ? 'Saving…' : registration ? 'Update registration' : 'Register'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="surface-card p-lg md:p-xl">
        <h2 className="font-haas-disp text-title-md text-ink">Feedback on past connections</h2>
        <p className="copy mt-xs">Your honest feedback helps future matching. It's never shown to the person you're rating.</p>
        <div className="mt-lg">
          <PendingFeedback />
        </div>
      </div>
    </div>
  );
}
