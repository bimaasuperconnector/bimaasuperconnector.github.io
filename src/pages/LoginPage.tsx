import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useUserRecord } from '../context/UserRecordContext';

export function LoginPage() {
  const { user, loading: authLoading, configured, signInWithGoogle } = useAuth();
  const { record, loading: recordLoading, needsOnboarding } = useUserRecord();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  if (configured && !authLoading && user && !recordLoading) {
    if (record?.status === 'approved') {
      return <Navigate to="/app" replace />;
    }
    if (record || needsOnboarding) {
      // pending, rejected, or needs the onboarding form — all live on /pending.
      return <Navigate to="/pending" replace />;
    }
  }

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setError('Sign-in didn\'t go through. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <section className="py-section">
      <Container className="flex justify-center">
        <div className="w-full max-w-[420px] rounded-md border border-hairline p-xl text-center">
          <h1 className="text-title-lg text-ink">Sign in to SuperConnector</h1>
          <p className="mt-sm text-body-md text-body">
            Use the Google account tied to your alumni profile.
          </p>

          {!configured && (
            <p className="mt-lg rounded-sm bg-surface-soft p-md text-body-md text-body">
              Sign-in is not configured for this deployment yet. See the
              project owner for setup status.
            </p>
          )}

          {configured && (
            <Button
              variant="primary"
              className="mt-lg w-full"
              onClick={handleSignIn}
              disabled={signingIn}
            >
              {signingIn ? 'Signing in…' : 'Continue with Google'}
            </Button>
          )}

          {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}
        </div>
      </Container>
    </section>
  );
}
