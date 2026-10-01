import { Link } from 'react-router-dom';
import { Bullets, LegalPage, Section } from '../components/legal/LegalPage';
import { LEGAL } from '../lib/legalConfig';

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      otherLink={{ to: '/privacy', label: 'Privacy Policy' }}
      intro={
        <>
          These Terms govern your use of {LEGAL.serviceName}, the private alumni network for{' '}
          {LEGAL.institution}, run by the {LEGAL.operatorName} ("{LEGAL.operatorShort}", "we", "us"). By
          signing in and submitting your details you confirm that you have read and accept these Terms
          and our <Link to="/privacy" className="text-link hover:text-link-active">Privacy Policy</Link>.
          If you do not accept them, please do not use the service.
        </>
      }
    >
      <Section title="1. Who can join">
        <p>
          {LEGAL.serviceName} is for alumni of {LEGAL.institution}. You sign in with a Google account, tell
          us your name and batch, and an administrator or your batch representative reviews the request.
          Until you are approved you can complete your profile, but you cannot see the member network.
          We may approve, reject or later withdraw access at our discretion, in particular if we cannot
          confirm that you are an alumnus or alumna.
        </p>
        <p>You must be at least 18 years old to use the service.</p>
      </Section>

      <Section title="2. Your account">
        <Bullets
          items={[
            'Give accurate information, and keep your profile reasonably up to date.',
            'You are responsible for your Google account and for what happens under your sign-in. Do not share access.',
            'One person, one account. Do not impersonate another person or misstate your batch, employer or qualifications.',
          ]}
        />
      </Section>

      <Section title="3. How members must behave">
        <p>This is a professional community. You agree not to:</p>
        <Bullets
          items={[
            'harass, abuse, threaten or discriminate against anyone, in the directory, jobs, events or in a monthly connection;',
            'send spam, unsolicited sales pitches, multi-level marketing or recruitment for schemes that charge candidates;',
            'post anything unlawful, misleading, defamatory or that infringes someone else\'s rights;',
            'collect, scrape, export or resell other members\' details, or use them for anything other than genuine networking with that member;',
            'contact a member through details they have chosen to share (phone, WhatsApp, email, LinkedIn) in a way they would not reasonably expect, or after they ask you to stop;',
            'try to bypass security, access areas you are not authorised for, or interfere with the service or its automation.',
          ]}
        />
      </Section>

      <Section title="4. Monthly SuperConnector connections">
        <p>
          Each month you may register for a one-to-one or small-circle conversation on the third weekend.
          Matching is done automatically from the information you provide (for example interests, skills,
          networking goals and batch) and from the history of past matches and feedback. We do not
          guarantee that you will be matched, that a match will be a good fit, or that the other person
          will attend.
        </p>
        <p>
          When you are matched, a Google Calendar invitation with a Google Meet link is sent to the email
          address you signed in with. Other people in your pair or circle are invited on the same event,
          so <strong>their email addresses and yours may be visible to each other on the invitation</strong>.
          Please be courteous: reply to the invite if you cannot attend.
        </p>
        <p>
          After a meeting you may give private feedback about how the connection went. Feedback must be
          honest and fair. It is not shown to the other person.
        </p>
      </Section>

      <Section title="5. Your content">
        <p>
          You keep ownership of what you add (profile details, photo, job posts, event listings, feedback).
          You give {LEGAL.operatorShort} a non-exclusive, royalty-free licence to store, display and use it
          to run the service, including showing it to other approved members as described in the Privacy
          Policy. You confirm that you have the right to post it, and that your photo shows you.
        </p>
        <p>
          You decide what appears on your directory profile and which contact channels are shown. Do not
          put sensitive information (such as government ID numbers, financial details or health
          information) in free-text fields such as your bio, a job post or an event description.
        </p>
      </Section>

      <Section title="6. Jobs and recruitment">
        <p>
          Job posts are submitted by members and reviewed by an administrator before they appear, but we do
          not verify employers, check claims in a listing or take part in any hiring decision.
          {' '}{LEGAL.operatorShort} is not an employer or recruitment agency. Never pay money to secure a
          job, and report anything that looks like a scam using the report button. Listings expire on the
          date set by the poster.
        </p>
      </Section>

      <Section title="7. Events and meetups">
        <p>
          Events are created and run by the member who organises them, not by {LEGAL.operatorShort}.
          The organiser decides who is invited, capacity and the RSVP deadline, and can see who has
          responded. When you RSVP, your email address may be added to the organiser's Google Calendar
          event so that you receive an invitation. Attend in-person events at your own risk and use
          your own judgement about safety.
        </p>
      </Section>

      <Section title="8. Reporting and moderation">
        <p>
          Members can report job posts and events. Administrators may remove content, reject or suspend
          accounts, and take other reasonable steps to keep the community safe. Administrators and batch
          representatives act as volunteers; decisions are made in good faith and may not always be
          explained in detail.
        </p>
      </Section>

      <Section title="9. No guarantees">
        <p>
          {LEGAL.serviceName} helps alumni meet and share opportunities. We do not promise any job,
          business, mentorship or networking outcome. The service is provided "as is" and "as available",
          is maintained by volunteers, and may change, pause or stop at any time, including when a
          third-party service it relies on changes.
        </p>
      </Section>

      <Section title="10. Third-party services">
        <p>
          The service depends on Google (sign-in, Calendar, Meet), Firebase, GitHub, Cloudflare and
          ImageKit, described in the Privacy Policy. Your use of Google services is also governed by
          Google's own terms.
        </p>
      </Section>

      <Section title="11. Intellectual property">
        <p>
          The {LEGAL.serviceName} name, design and software belong to {LEGAL.operatorName} or its
          licensors. You may not copy or reuse them except as the service allows. The names and logos of
          {' '}{LEGAL.institution} and of any employer shown on profiles belong to their owners.
        </p>
      </Section>

      <Section title="12. Limits on liability">
        <p>
          To the extent the law allows, {LEGAL.operatorName}, its administrators and volunteers are not
          liable for indirect or consequential loss, for the conduct or content of members, or for any
          decision you make based on a profile, job post or event. Nothing in these Terms limits liability
          that cannot be limited by law.
        </p>
      </Section>

      <Section title="13. Ending your membership">
        <p>
          You may stop using the service at any time and ask us to remove your account by emailing{' '}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-link hover:text-link-active">
            {LEGAL.contactEmail}
          </a>
          . We may suspend or end an account that breaks these Terms. What happens to your data is
          explained in the Privacy Policy.
        </p>
      </Section>

      <Section title="14. Changes to these Terms">
        <p>
          We may update these Terms. The date at the top shows the latest version. If you keep using the
          service after a change, you accept the updated Terms. For significant changes we will try to
          give notice inside the app.
        </p>
      </Section>

      <Section title="15. Governing law and contact">
        <p>
          These Terms are governed by {LEGAL.governingLaw}. Questions, complaints or notices:{' '}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-link hover:text-link-active">
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
