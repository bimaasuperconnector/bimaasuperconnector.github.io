import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { CheckIcon, ClockIcon, UsersIcon } from '../../components/icons/NavIcons';
import { ErrorNote, PageHeader, SkeletonList } from '../../components/ui/PageHeader';
import {
  MODE_LABELS,
  REGISTRATION_MODES,
  REGISTRATION_SLOTS,
  SLOT_LABELS,
  SMALL_CIRCLE_MAX,
  SMALL_CIRCLE_MIN,
  SMALL_CIRCLE_TARGET,
  currentCycle,
  formatCycleDates,
  type RegistrationMode,
  type RegistrationSlot,
} from '../../lib/cycles';
import {
  type Registration,
  getOwnRegistration,
  saveOwnRegistration,
  withdrawOwnRegistration,
} from '../../firebase/repositories/registrationsRepository';
import { getCycleState } from '../../firebase/repositories/cyclesRepository';
import { PendingFeedback } from '../../components/superconnector/PendingFeedback';

/** One selectable option, styled as a bordered card rather than a bare radio. */
function OptionCard({
  checked,
  disabled,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-[52px] w-full items-center justify-between gap-md rounded-lg border px-md py-sm text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-primary bg-surface-soft' : 'border-hairline bg-canvas hover:bg-surface-soft'
      }`}
    >
      <span>
        <span className="block text-label-md text-ink">{title}</span>
        {hint && <span className="block text-body-md text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          checked ? 'border-primary bg-primary text-on-primary' : 'border-border-strong'
        }`}
      >
        {checked && <CheckIcon width={12} height={12} />}
      </span>
    </button>
  );
}

export function SuperConnectorPage() {
  const { user } = useAuth();
  const cycle = currentCycle();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<RegistrationSlot>('saturday');
  const [mode, setMode] = useState<RegistrationMode>('one_to_one');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await saveOwnRegistration(user.uid, cycle.id, slot, mode);
      setRegistration({ uid: user.uid, cycleId: cycle.id, slot, mode });
    } catch {
      setError("Couldn't save your registration. Please try again.");
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

  return (
    <div className="space-y-lg">
      <div className="surface-card p-lg md:p-xl">
        <PageHeader
          title="SuperConnector"
          description={
            <>
              This month's connections happen the weekend of <strong className="text-ink">{formatCycleDates(cycle)}</strong>.
              Register your availability and we'll match you with someone from the network closer to the date.
            </>
          }
        />

        {loading ? (
          <div className="mt-lg">
            <SkeletonList count={2} heightClass="h-14" />
          </div>
        ) : (
          <div className="mt-lg space-y-lg">
            {registration && (
              <p className="flex items-center gap-xs rounded-lg bg-signature-mint p-md text-body-md text-ink">
                <CheckIcon width={16} height={16} /> You're registered for {SLOT_LABELS[registration.slot]} ·{' '}
                {MODE_LABELS[registration.mode]}.
              </p>
            )}

            {!registrationOpen && (
              <p className="flex items-start gap-xs rounded-lg bg-surface-soft p-md text-body-md text-body">
                <ClockIcon width={16} height={16} className="mt-[2px] shrink-0" />
                Registration for this cycle has closed — matching is starting soon.{' '}
                {registration ? 'You can still withdraw if you need to.' : ''}
              </p>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            <div className={registrationOpen ? '' : 'pointer-events-none opacity-50'}>
              <div role="radiogroup" aria-label="When are you available?">
                <p className="text-label-md text-ink">When are you available?</p>
                <div className="mt-sm space-y-xs">
                  {REGISTRATION_SLOTS.map((s) => (
                    <OptionCard
                      key={s}
                      checked={slot === s}
                      disabled={!registrationOpen}
                      onSelect={() => setSlot(s)}
                      title={SLOT_LABELS[s]}
                    />
                  ))}
                </div>
              </div>

              <div role="radiogroup" aria-label="How would you like to connect?" className="mt-lg">
                <p className="flex items-center gap-xs text-label-md text-ink">
                  <UsersIcon width={16} height={16} /> How would you like to connect?
                </p>
                <div className="mt-sm space-y-xs">
                  {REGISTRATION_MODES.map((m) => (
                    <OptionCard
                      key={m}
                      checked={mode === m}
                      disabled={!registrationOpen}
                      onSelect={() => setMode(m)}
                      title={MODE_LABELS[m]}
                      hint={
                        m === 'small_circle'
                          ? `Target ${SMALL_CIRCLE_TARGET}, ${SMALL_CIRCLE_MIN}–${SMALL_CIRCLE_MAX} people`
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-md">
              {registrationOpen && (
                <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Saving…' : registration ? 'Update registration' : 'Register'}
                </Button>
              )}
              {registration && (
                <Button variant="secondary" onClick={() => void handleWithdraw()} disabled={saving}>
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="surface-card p-lg md:p-xl">
        <h2 className="font-haas-disp text-title-md text-ink">Feedback on past connections</h2>
        <p className="copy mt-xs">Your honest feedback helps future matching — it's never shown to the person you're rating.</p>
        <div className="mt-lg">
          <PendingFeedback />
        </div>
      </div>
    </div>
  );
}
