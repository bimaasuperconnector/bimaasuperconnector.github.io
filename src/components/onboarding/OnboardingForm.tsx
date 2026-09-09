import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { allBatches } from '../../lib/batches';
import { submitOnboarding } from '../../firebase/repositories/usersRepository';

const BATCHES = allBatches();

export function OnboardingForm() {
  const { user, signOutUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [batchNumber, setBatchNumber] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = displayName.trim().length > 0 && batchNumber !== '';

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitOnboarding(user, {
        displayName: displayName.trim(),
        batchNumber,
        note,
      });
    } catch {
      setError("Couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[480px] rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Tell us who you are</h1>
      <p className="mt-sm text-body-md text-body">
        An admin (or your batch representative) reviews every new sign-in
        before you can see the private directory.
      </p>

      <div className="mt-lg space-y-lg">
        <div>
          <label className="text-label-md text-ink" htmlFor="onboarding-name">
            Full name
          </label>
          <input
            id="onboarding-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={200}
            required
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>

        <div>
          <label className="text-label-md text-ink" htmlFor="onboarding-batch">
            Batch
          </label>
          <select
            id="onboarding-batch"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value ? Number(e.target.value) : '')}
            required
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          >
            <option value="">Select your batch…</option>
            {BATCHES.map((b) => (
              <option key={b.id} value={b.batchNumber}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-label-md text-ink" htmlFor="onboarding-note">
            Note for your approver <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="onboarding-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Anything that helps them recognize you"
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>

        {error && <p className="text-body-md text-signature-coral">{error}</p>}

        <Button
          variant="primary"
          className="w-full"
          disabled={!canSubmit || submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </Button>

        <button
          type="button"
          onClick={() => void signOutUser()}
          className="block w-full text-center text-body-md text-link hover:text-link-active"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
