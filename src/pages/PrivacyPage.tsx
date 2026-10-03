import { Bullets, LegalPage, Section } from '../components/legal/LegalPage';
import { LEGAL } from '../lib/legalConfig';

const mail = (
  <a href={`mailto:${LEGAL.contactEmail}`} className="text-link hover:text-link-active">
    {LEGAL.contactEmail}
  </a>
);

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      otherLink={{ to: '/terms', label: 'Terms of Use' }}
      intro={
        <>
          {LEGAL.serviceName} is the private alumni network for {LEGAL.institution}, run by the{' '}
          {LEGAL.operatorName}. This page explains what personal data we collect, why, who can see it, who
          processes it for us, and the choices you have. We do not sell your data and we do not show
          advertising.
        </>
      }
    >
      <Section title="1. Who is responsible">
        <p>
          The {LEGAL.operatorName} ("{LEGAL.operatorShort}", "we") decides how and why your data is used on{' '}
          {LEGAL.siteUrl.replace('https://', '')}. Contact: {mail}.
        </p>
      </Section>

      <Section title="2. What we collect">
        <p>
          <strong>When you sign in and apply.</strong> Your Google account email address and the name and
          batch you enter, plus an optional note to your approver. We do not store your Google profile
          picture; only a photo you upload yourself is used.
        </p>
        <p>
          <strong>Your profile.</strong> What you choose to add: photo, name, headline, bio, city, current
          and past organisations (including whether you founded them), education, skills, interests,
          networking goals, links, badges, chapters, and whether you are open to work with the roles and note you
          provide. Your city is also matched to a standard spelling (for example Bangalore and Bengaluru
          are treated as the same city).
        </p>
        <p>
          <strong>Optional private details.</strong> Date of birth, phone number, WhatsApp number, a
          personal contact email and a LinkedIn link. All are optional.
        </p>
        <p>
          <strong>SuperConnector activity.</strong> Your monthly registrations (format and day preference),
          the matches you are placed in, your feedback about connections, and an internal "Connection
          Meter" score that is adjusted by feedback and used only to improve future matching.
        </p>
        <p>
          <strong>Content and activity.</strong> Job posts, events you create, RSVPs, reports you file, and
          in-app notifications sent to you.
        </p>
        <p>
          <strong>Technical data.</strong> Like any website, the hosting and security providers below
          receive your IP address, browser type and request details when you load the site or upload a
          photo. We do not run analytics or advertising trackers.
        </p>
      </Section>

      <Section title="3. Why we use it">
        <Bullets
          items={[
            'to confirm that you are an alumnus or alumna and approve access;',
            'to run the member directory, jobs board, events, entrepreneurship and open-to-work features;',
            'to match you with other members each month, create the calendar invitation and Meet link, and send in-app notifications;',
            'to improve matching using your feedback and past matches, so you are not paired repeatedly with the same people;',
            'to moderate content, handle reports and keep the service secure;',
            'to show visitors a few aggregate numbers on the public home page (such as total members), which contain no personal data;',
            'if you provide your date of birth, to send you a birthday greeting. This is the only purpose for it.',
          ]}
        />
        <p>
          Matching is automated but simple and transparent: it compares interests, skills, goals, batch and
          past-match history. No one is excluded from the network by it, and administrators can review
          outcomes.
        </p>
        <p>
          We rely on your consent, which you give by signing in, submitting the form and choosing what to
          add. You can withdraw it at any time (see section 8).
        </p>
      </Section>

      <Section title="4. Who can see what">
        <p>
          <strong>The public</strong> can see the home page, these legal pages and aggregate counts only.
          Signed-out visitors cannot read any member data.
        </p>
        <p>
          <strong>Approved members</strong> can see your directory profile: name, photo, batch, headline,
          bio, city, organisations, education, skills, interests, networking goals, badges, chapters, open-to-work
          details and links you added. They can also see jobs and events you post. They cannot see the
          email address you signed in with.
        </p>
        <p>
          <strong>Contact channels are private by default.</strong> Your phone, WhatsApp, contact email and
          LinkedIn are shown to other approved members only if you switch each one on individually, and
          are then displayed as buttons on your profile. Anyone who can see a button can technically
          obtain the number or address behind it, so switch on only what you are comfortable sharing
          with the whole network.
        </p>
        <p>
          <strong>Your date of birth</strong> is never shown to other members and no administrator screen
          displays it.
        </p>
        <p>
          <strong>Your pair or circle.</strong> Matched members are invited on one Google Calendar event, and
          Google's invitation can show the invited email addresses to everyone on it. Likewise, an event
          organiser can see who RSVPed, and attendees may appear on the organiser's Calendar event.
        </p>
        <p>
          <strong>Administrators</strong> (the super administrators and the batch representatives for your
          batch) can see your sign-in email, name, batch and application note, your pending profile,
          reports, and the feedback and Connection Meter data needed to run the service. They can also
          export a list of names and emails to contact a group of members for network announcements.
          Batch representatives approve only members of their own batches. Your feedback about someone
          is never shown to that person, and the Connection Meter is never shown to members, including
          you.
        </p>
        <p>
          The people who operate the underlying database can technically access any stored data, as with
          any hosted service. We limit that access to what is needed to run and secure the service.
        </p>
      </Section>

      <Section title="5. Services that process data for us">
        <Bullets
          items={[
            <>
              <strong>Google Firebase</strong> (Authentication and Cloud Firestore): sign-in and the
              database that holds all member data.
            </>,
            <>
              <strong>Google Calendar and Meet</strong>: meeting invitations sent from the {LEGAL.serviceName}{' '}
              Google account to attendees' email addresses.
            </>,
            <>
              <strong>GitHub</strong>: hosts the website and runs our scheduled monthly automation
              (matching, calendar creation, cleanup).
            </>,
            <>
              <strong>ImageKit</strong>: stores and serves profile photos. A photo's web address is
              public: anyone who has the link can view the image, even without signing in. Photos
              are uploaded through a <strong>Cloudflare</strong> service that verifies your sign-in
              before passing the file on.
            </>,
          ]}
        />
        <p>
          These providers process data under their own terms and security practices and may do so on
          servers outside India. We do not give your data to anyone else, except where the law requires it.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <Bullets
          items={[
            'Profile, contact details and photo: while your account is active, until you change or delete them or ask us to remove your account.',
            'Account details (name, email, batch): while your account is active and, where needed, for a short period afterwards to prevent abuse or handle disputes.',
            'Job posts: shown until their expiry date, then archived and no longer visible to members.',
            'Matches, feedback, reports and automation logs: kept for service integrity, fairness of matching and moderation. When we remove an account we delete or de-identify these records where practical.',
            'Notifications: kept in your in-app inbox until cleared in a future clean-up.',
          ]}
        />
        <p>
          When you replace or remove a profile photo, the old image is deleted from ImageKit.
        </p>
      </Section>

      <Section title="7. Security">
        <p>
          Access requires Google sign-in and admin approval. Database rules restrict each record to the
          people entitled to it, protected fields such as roles and the Connection Meter cannot be edited
          from the browser, and photo uploads are checked for sign-in, file type and size on the server
          side. No system is perfectly secure. If we become aware of a breach affecting your data we will
          act promptly and notify you where the law requires.
        </p>
      </Section>

      <Section title="8. Your choices and rights">
        <Bullets
          items={[
            'View and edit your profile, contact details and photo at any time from the Profile page.',
            'Turn off Open to Work, hide any contact channel, or remove your date of birth whenever you like.',
            'Ask for a copy of your data, a correction, or the removal of your account by emailing us.',
            'Withdraw consent. Removing your account ends your access and your directory listing.',
          ]}
        />
        <p>
          Email {mail} from the address you signed in with. We will respond as soon as we reasonably can.
          Account removal is currently done by an administrator, not automatically. You may also have
          rights under applicable data-protection law, including India's Digital Personal Data Protection
          Act, 2023. If you are unhappy with our response, write to us again and we will review it.
        </p>
      </Section>

      <Section title="9. Cookies, local storage and notifications">
        <p>
          We do not use advertising or tracking cookies. Your browser stores your sign-in session (set by
          Firebase) and small items in local storage: a short-lived copy of the public home-page counts
          and the time you last viewed notifications and jobs. The installed web app uses a service worker
          that saves the app's own files (not your private data) so it loads faster and works offline.
        </p>
        <p>
          If you tap "Enable notifications", your browser asks for permission. Alerts are shown by your
          own device while the app is available; we do not run a push-message server, and you can turn
          the permission off in your browser settings.
        </p>
      </Section>

      <Section title="10. Children">
        <p>The service is for alumni aged 18 and over and is not directed at children.</p>
      </Section>

      <Section title="11. Changes to this policy">
        <p>
          If we change how we handle data we will update this page and its date, and give notice in the app
          for significant changes.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          {LEGAL.operatorName}: {mail}.
        </p>
      </Section>
    </LegalPage>
  );
}
