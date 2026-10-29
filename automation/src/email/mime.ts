import { randomUUID } from 'node:crypto';
import { isValidEmail } from '../../../src/lib/emailConfig';

/**
 * Builds a standards-compliant multipart/alternative (plain text + HTML)
 * message for the Gmail API. Pure and unit-testable. Header values are
 * validated so a name or subject can never inject extra headers.
 */

export interface MimeInput {
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const CRLF = '\r\n';

function assertNoLineBreaks(label: string, v: string): void {
  if (/[\r\n]/.test(v)) throw new Error(`${label} contains a line break.`);
}

/** RFC 2047 encoded-word(s) for non-ASCII header text; chunks never split a character. */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const ch of Array.from(value)) {
    if (Buffer.byteLength(chunk + ch, 'utf8') > 42) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join(' ');
}

function base64Body(s: string): string {
  return (Buffer.from(s, 'utf8').toString('base64').match(/.{1,76}/g) ?? ['']).join(CRLF);
}

export function buildMime(input: MimeInput): string {
  assertNoLineBreaks('Recipient', input.to);
  assertNoLineBreaks('Subject', input.subject);
  assertNoLineBreaks('Sender name', input.fromName);
  if (!isValidEmail(input.to)) throw new Error('Recipient address is not valid.');
  const boundary = `sc_${randomUUID().replace(/-/g, '')}`;
  const lines = [
    `From: ${encodeHeader(input.fromName)} <${input.fromAddress}>`,
    `To: ${input.to.trim()}`,
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(input.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(input.html),
    `--${boundary}--`,
    '',
  ];
  return lines.join(CRLF);
}

export function toBase64Url(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
