import { Link } from 'react-router-dom';
import type { Profile } from '../../firebase/repositories/profilesRepository';
import { computeProfileCompletion } from '../../lib/profileCompletion';
import { CheckIcon, ProfileIcon } from '../icons/NavIcons';

function encouragement(percent: number, remaining: number): string {
  if (percent < 40) return 'A few details help fellow alumni recognise you and find you in the directory.';
  if (percent < 80) return `Good progress — ${remaining} more ${remaining === 1 ? 'step' : 'steps'} to go.`;
  return `Almost there — ${remaining === 1 ? 'just one more thing' : `${remaining} small things left`}.`;
}

/**
 * Minimal profile-progress card. Computed from the profile the shell already
 * holds in memory (live listener) — no Firestore read or write of its own.
 */
export function ProfileCompletionCard({ profile }: { profile: Profile | null }) {
  const { percent, missing, isComplete } = computeProfileCompletion(profile);
  const next = missing.slice(0, 3);

  return (
    <section className="surface-card p-lg md:p-xl" aria-labelledby="profile-progress-title">
      <div className="flex items-center justify-between gap-md">
        <div className="flex items-center gap-sm text-ink">
          <ProfileIcon />
          <h2 id="profile-progress-title" className="font-haas-disp text-title-md text-ink">
            Your profile
          </h2>
        </div>
        {isComplete ? (
          <span className="chip bg-signature-mint text-ink">
            <CheckIcon width={14} height={14} /> Complete
          </span>
        ) : (
          <span className="font-haas-disp text-title-md text-ink">{percent}%</span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Profile completion"
        className="mt-md h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${isComplete ? 'bg-success-border' : 'bg-ink'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {isComplete ? (
        <p className="copy mt-sm">Your profile is complete — fellow alumni can find and recognise you easily.</p>
      ) : (
        <>
          <p className="copy mt-sm">{encouragement(percent, missing.length)}</p>
          <ul className="mt-sm flex flex-wrap gap-xs">
            {next.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="inline-flex min-h-[36px] items-center gap-xxs rounded-full border border-hairline bg-canvas px-sm text-caption text-ink active:bg-surface-strong"
                >
                  <span aria-hidden="true">+</span> {item.prompt}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        to={isComplete ? '/app/profile' : '/app/profile?edit=1'}
        className="mt-lg inline-flex min-h-[44px] items-center rounded-lg border border-hairline bg-canvas px-lg text-button text-ink active:bg-surface-strong"
      >
        {isComplete ? 'View your profile' : 'Complete your profile'}
      </Link>
    </section>
  );
}
