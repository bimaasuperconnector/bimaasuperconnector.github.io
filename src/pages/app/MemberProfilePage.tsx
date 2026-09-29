import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ProfileView } from '../../components/profile/ProfileView';
import { ArrowLeftIcon } from '../../components/icons/NavIcons';
import { EmptyState, ErrorNote } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { type Profile, getMemberProfile } from '../../firebase/repositories/profilesRepository';

/**
 * Read-only full profile of another alum, opened from a search result,
 * directory card, Open to Work list or venture card.
 *
 * Read cost: 0 when the profile was already downloaded by the search that
 * produced the click (handed over through router state / the session
 * profile cache), otherwise exactly one document read on a direct link.
 * Visibility is enforced by firestore.rules (approved members only), and
 * only channels the owner switched on are present in `contactVisible`.
 */
export function MemberProfilePage() {
  const { uid = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handedOver = (location.state as { profile?: Profile } | null)?.profile;

  const [profile, setProfile] = useState<Profile | null>(handedOver && handedOver.uid === uid ? handedOver : null);
  const [loading, setLoading] = useState(!profile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || uid === user?.uid) return;
    if (handedOver && handedOver.uid === uid) {
      setProfile(handedOver);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMemberProfile(uid)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this profile. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, user?.uid, handedOver]);

  // Your own card in a result list opens your editable profile page.
  if (uid && uid === user?.uid) return <Navigate to="/app/profile" replace />;

  const goBack = () => {
    // `key === 'default'` means this is the first entry in the session (deep link).
    if (location.key !== 'default') navigate(-1);
    else navigate('/app/directory');
  };

  return (
    <div>
      <button
        type="button"
        onClick={goBack}
        className="-ml-xs mb-md inline-flex min-h-[44px] items-center gap-xs rounded-lg px-xs text-body-md text-ink active:bg-surface-strong/60"
      >
        <ArrowLeftIcon width={18} height={18} /> Back
      </button>

      {loading ? (
        <div className="space-y-lg" aria-busy="true" aria-label="Loading profile">
          <div className="skeleton h-[260px]" />
          <div className="skeleton h-40" />
        </div>
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !profile ? (
        <EmptyState title="This profile isn't available">
          It may have been removed, or this member hasn't set up their profile yet.{' '}
          <Link to="/app/directory" className="text-link">
            Back to the directory
          </Link>
        </EmptyState>
      ) : (
        <ProfileView profile={profile} />
      )}
    </div>
  );
}
