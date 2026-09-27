import { Container } from '../components/ui/Container';

const PLACEHOLDER = '[to be confirmed by the SuperConnector owner]';

export function TermsPage() {
  return (
    <section className="py-section">
      <Container className="max-w-[720px]">
        <h1 className="text-display-md text-ink">Terms of Use</h1>
        <p className="mt-md text-body-md text-body">
          Effective date: {PLACEHOLDER}. This page is informational and is
          not legal advice.
        </p>

        <div className="mt-xl space-y-lg text-body-md text-body">
          <section>
            <h2 className="text-title-md text-ink">1. Acceptance</h2>
            <p>By creating an account, you agree to these Terms.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">2. Eligibility</h2>
            <p>
              SuperConnector is intended for verified alumni of {PLACEHOLDER}.
              Access is subject to admin approval.
            </p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">3. Account responsibilities</h2>
            <p>You are responsible for the accuracy of your profile and for keeping your account secure.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">4. Acceptable use &amp; professional conduct</h2>
            <p>Members are expected to engage respectfully, both in the directory and in monthly connections.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">5. User content</h2>
            <p>You retain ownership of what you post (profile details, job posts, event listings) and grant SuperConnector permission to display it to other approved members.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">6. Jobs &amp; recruitment disclaimer</h2>
            <p>Job posts are provided by members. SuperConnector does not vet employers and makes no guarantee about any listing.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">7. Events &amp; networking disclaimer</h2>
            <p>SuperConnector facilitates introductions and events but does not guarantee any employment, business, or networking outcome.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">8. Availability</h2>
            <p>The service is provided on an as-available basis and may change or be interrupted.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">9. Moderation &amp; suspension</h2>
            <p>Accounts may be suspended for violations of these Terms at the discretion of admins/moderators.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">10. Intellectual property</h2>
            <p>The SuperConnector name, design, and platform code belong to {PLACEHOLDER}.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">11. Third-party services</h2>
            <p>SuperConnector relies on Google (Sign-In, Calendar, Meet) and Firebase. Use of those services is also subject to Google's own terms.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">12. Privacy</h2>
            <p>See the Privacy Policy for details on data handling.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">13. Liability limitations</h2>
            <p>To the extent permitted by law, SuperConnector is not liable for indirect or incidental damages arising from use of the platform.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">14. Changes to these Terms</h2>
            <p>These Terms may be updated; continued use after an update means you accept the revised Terms.</p>
          </section>
          <section>
            <h2 className="text-title-md text-ink">15. Contact</h2>
            <p>Questions about these Terms: bimaasuperconnector@gmail.com.</p>
          </section>
        </div>
      </Container>
    </section>
  );
}
