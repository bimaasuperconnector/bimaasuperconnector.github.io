import { google, type gmail_v1 } from 'googleapis';
import { EMAIL_SENDER_ADDRESS, EMAIL_SENDER_NAME } from '../../../src/lib/emailConfig';
import { buildMime, toBase64Url } from './mime';

/**
 * Sends as bimaasuperconnector@gmail.com through the Gmail API using a
 * one-time-obtained OAuth refresh token (scope: gmail.send only — it can
 * send mail but cannot read the mailbox). It reuses the same OAuth
 * client as the Calendar integration; only the refresh token is new.
 * Secrets: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET,
 * GMAIL_REFRESH_TOKEN. Never logged.
 */

export function gmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN,
  );
}

export function getGmailClient(): gmail_v1.Gmail {
  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Returns the Gmail message id. Throws on any failure (classify with classifySendError). */
export async function sendEmail(gmail: gmail_v1.Gmail, email: OutgoingEmail): Promise<string> {
  const raw = toBase64Url(
    buildMime({ fromName: EMAIL_SENDER_NAME, fromAddress: EMAIL_SENDER_ADDRESS, ...email }),
  );
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  const id = res.data.id;
  if (!id) throw new Error('Gmail accepted the request but returned no message id.');
  return id;
}

export type SendErrorKind =
  /** Credentials are wrong/expired/missing the gmail.send scope: stop the run, do not burn the item's attempts. */
  | 'auth'
  /** Google is rate limiting or the daily sending quota is reached: stop the run, do not burn attempts. */
  | 'quota'
  /** The message itself is rejected (bad address etc.): retrying will not help. */
  | 'permanent'
  /** Network/5xx: count an attempt and try again on a later run. */
  | 'transient';

export function classifySendError(err: unknown): { kind: SendErrorKind; message: string } {
  const e = err as {
    code?: number | string;
    status?: number;
    message?: string;
    response?: { status?: number; data?: { error?: string | { errors?: { reason?: string }[]; message?: string } } };
  };
  const status = Number(e?.response?.status ?? e?.status ?? e?.code);
  const message = String(e?.message ?? 'Unknown error').slice(0, 300);
  const data = e?.response?.data?.error;
  const reasons = typeof data === 'object' && data?.errors ? data.errors.map((x) => x.reason ?? '') : [];
  const blob = `${message} ${typeof data === 'string' ? data : ''}`.toLowerCase();

  if (blob.includes('invalid_grant') || status === 401 || reasons.includes('authError')) return { kind: 'auth', message };
  if (reasons.some((r) => /insufficientPermissions|forbidden/i.test(r)) || blob.includes('insufficient permission')) {
    return { kind: 'auth', message };
  }
  if (status === 429 || reasons.some((r) => /rateLimit|dailyLimit|quota/i.test(r)) || blob.includes('rate limit')) {
    return { kind: 'quota', message };
  }
  if (status === 400) return { kind: 'permanent', message };
  return { kind: 'transient', message };
}
