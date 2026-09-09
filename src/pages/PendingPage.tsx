import { Navigate } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { OnboardingForm } from '../components/onboarding/OnboardingForm';
import { useAuth } from '../context/AuthContext';
import { useUserRecord } from '../context/UserRecordContext';

export function PendingPage() {
  const { user, loading: authLoading, signOutUser } = useAuth();
  const { record, loading: recordLoading, needsOnboarding } = useUserRecord();

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!authLoading && !recordLoading && record?.status === 'approved') {
    return <Navigate to="/app" replace />;
  }

  if (authLoading || recordLoading) {
    return (
      <section className="py-section">
        <Container className="flex justify-center">
          <p className="text-body-md text-muted">Loading…</p>
        </Container>
      </section>
    );
  }

  if (needsOnboarding) {
    return (
      <section className="py-section">
        <Container className="flex justify-center">
          <OnboardingForm />
        </Container>
      </section>
    );
  }

  const isRejected = record?.status === 'rejected';

  return (
    <section className="py-section">
      <Container className="flex justify-center">
        <div className="w-full max-w-[480px] rounded-md border border-hairline p-xl text-center">
          {isRejected ? (
            <>
              <h1 className="text-title-lg text-ink">Your account wasn't approved</h1>
              <p className="mt-sm text-body-md text-body">
                An admin reviewed your sign-in and didn't approve it for the
                private alumni directory. If you believe this is a mistake,
                reach out to an admin directly.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-title-lg text-ink">Your account is pending review</h1>
              <p className="mt-sm text-body-md text-body">
                {record?.batchNumber != null
                  ? "Your batch representative (or an admin) needs to confirm your alumni status before you can see the private directory."
                  : 'An admin needs to confirm your alumni status before you can see the private directory.'}{' '}
                This usually doesn't take long — check back soon.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="mt-lg text-body-md text-link hover:text-link-active"
          >
            Sign out
          </button>
        </div>
      </Container>
    </section>
  );
}
