import { google } from 'googleapis';

/**
 * Authorizes as `bimaasuperconnector@gmail.com` (a standard consumer
 * Gmail account, NOT Google Workspace) via a one-time-obtained OAuth2
 * refresh token. Domain-wide delegation — impersonating arbitrary users
 * from a service account — is a Workspace-only feature and does not
 * apply here; see the Phase 8 chat response for the full architecture
 * reasoning. This account is the sole organizer of every SuperConnector
 * calendar event; matched members are added as attendees by email and
 * never need to authorize anything themselves (no password requested,
 * per AUTOMATION.md's "Never request a user's Google password").
 *
 * Three secrets, all required together to mint access tokens on demand:
 * GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET,
 * GOOGLE_CALENDAR_REFRESH_TOKEN. See the chat setup instructions for
 * how the refresh token was obtained (OAuth Playground, one-time).
 */
function loadOAuthClient() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing one of GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET / GOOGLE_CALENDAR_REFRESH_TOKEN. Calendar integration is not configured.',
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export function getCalendarClient() {
  const auth = loadOAuthClient();
  return google.calendar({ version: 'v3', auth });
}
