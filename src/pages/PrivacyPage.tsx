import { Container } from '../components/ui/Container';

const PLACEHOLDER = '[to be confirmed by the SuperConnector owner]';

export function PrivacyPage() {
  return (
    <section className="py-section">
      <Container className="max-w-[720px]">
        <h1 className="text-display-md text-ink">Privacy Policy</h1>
        <p className="mt-md text-body-md text-body">
          Effective date: {PLACEHOLDER}. This page is informational and is
          not legal advice.
        </p>

        <div className="mt-xl space-y-lg text-body-md text-body">
          <section>
            <h2 className="text-title-md text-ink">Who operates SuperConnector</h2>
            <p>SuperConnector is operated by {PLACEHOLDER}.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">What we collect</h2>
            <p>
              Your Google identity (name, email, profile photo), the
              profile details you add (batch, education, organizations,
              location, skills, networking interests), your monthly
              participation and feedback, job posts and event listings
              you create, and technical/security data needed to keep
              the service safe.
            </p>
            <p className="mt-sm">
              Separately, and only if you choose to add them: your date
              of birth, phone number, WhatsApp number, a personal
              contact email, and a LinkedIn profile link. These are
              stored apart from your directory profile specifically so
              they can stay private by default — see "Who can see it"
              below for exactly who can see each one.
            </p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">How we use it</h2>
            <p>
              To run the alumni directory, monthly matching, jobs and events
              features, and to keep the platform secure. We do not sell
              member data.
            </p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Who can see it</h2>
            <p>
              Approved members can see directory profile fields you choose
              to share. Your email is private by default. Admins/moderators
              can see additional fields needed for moderation.
            </p>
            <p className="mt-sm">
              Your date of birth is visible only to you — not to other
              members, and not to admins. Your phone number, WhatsApp
              number, personal contact email, and LinkedIn link are
              private by default; each one is shown to fellow approved
              members only if you individually switch it on, and stays
              hidden otherwise.
            </p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Processors we rely on</h2>
            <p>Google (Sign-In, Calendar, Meet), Firebase (Authentication, Firestore), and GitHub (Pages hosting, scheduled automation).</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Retention</h2>
            <p>We retain profile and participation data while your account is active. Retention periods: {PLACEHOLDER}.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Security</h2>
            <p>Access is controlled through authentication, database security rules, and role-based permissions.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Cookies &amp; local storage</h2>
            <p>
              We use local/session storage for sign-in state and a service
              worker for offline app-shell caching. If you enable browser
              notifications for this app, that permission is stored by your
              browser, not by us. We do not use third-party advertising
              cookies.
            </p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Your choices</h2>
            <p>You can correct your profile at any time, or request account deletion by contacting bimaasuperconnector@gmail.com.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Eligibility</h2>
            <p>SuperConnector is intended for verified alumni and is not directed at children.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">International processing</h2>
            <p>Data may be processed by Google/Firebase infrastructure in regions outside your own; details: {PLACEHOLDER}.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Changes to this policy</h2>
            <p>We'll update this page if our practices change.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">Contact</h2>
            <p>Questions about this policy: bimaasuperconnector@gmail.com.</p>
          </section>
        </div>
      </Container>
    </section>
  );
}
