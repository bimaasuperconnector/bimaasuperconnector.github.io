import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
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
    <>
      <div className="rounded-md border border-hairline p-xl">
        <h1 className="text-title-lg text-ink">SuperConnector</h1>
      <p className="mt-sm text-body-md text-body">
        This month's connections happen the weekend of{' '}
        <strong className="text-ink">{formatCycleDates(cycle)}</strong>. Register your
        availability and we'll match you with someone from the network closer to the
        date.
      </p>

      {loading ? (
        <p className="mt-lg text-body-md text-muted">Loading…</p>
      ) : (
        <div className="mt-lg space-y-lg">
          {registration && (
            <p className="rounded-sm bg-surface-soft p-md text-body-md text-body">
              You're registered for {SLOT_LABELS[registration.slot]} ·{' '}
              {MODE_LABELS[registration.mode]}.
            </p>
          )}

          {!registrationOpen && (
            <p className="rounded-sm bg-surface-soft p-md text-body-md text-body">
              Registration for this cycle has closed — matching is starting
              soon. {registration ? "You can still withdraw if you need to." : ''}
            </p>
          )}

          {error && <p className="text-body-md text-signature-coral">{error}</p>}

          <div className={registrationOpen ? '' : 'pointer-events-none opacity-50'}>
            <div>
              <p className="text-label-md text-ink">When are you available?</p>
              <div className="mt-sm space-y-xs">
                {REGISTRATION_SLOTS.map((s) => (
                  <label key={s} className="flex items-center gap-xs text-body-md text-body">
                    <input
                      type="radio"
                      name="slot"
                      checked={slot === s}
                      disabled={!registrationOpen}
                      onChange={() => setSlot(s)}
                    />
                    {SLOT_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-lg">
              <p className="text-label-md text-ink">How would you like to connect?</p>
              <div className="mt-sm space-y-xs">
                {REGISTRATION_MODES.map((m) => (
                  <label key={m} className="flex items-center gap-xs text-body-md text-body">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === m}
                      disabled={!registrationOpen}
                      onChange={() => setMode(m)}
                    />
                    {MODE_LABELS[m]}
                    {m === 'small_circle' && (
                      <span className="text-muted">
                        {' '}
                        (target {SMALL_CIRCLE_TARGET}, {SMALL_CIRCLE_MIN}–{SMALL_CIRCLE_MAX} people)
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-md">
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

      <div className="mt-lg rounded-md border border-hairline p-xl">
        <h2 className="text-title-lg text-ink">Feedback on past connections</h2>
        <p className="mt-sm text-body-md text-body">
          Your honest feedback helps future matching — it's never shown to
          the person you're rating.
        </p>
        <div className="mt-lg">
          <PendingFeedback />
        </div>
      </div>
    </>
  );
}
