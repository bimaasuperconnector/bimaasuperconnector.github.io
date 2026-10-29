import { APP_URL, EMAIL_SENDER_NAME, type TemplateKey } from './emailConfig';

/**
 * Email templates: default wording, {{variable}} substitution and the
 * HTML/plain-text renderer. Pure and dependency-free, so the console's
 * live preview and the automation job produce byte-identical output.
 *
 * Templates are plain text. A blank line starts a new paragraph; a run of
 * lines that all start with "- " becomes a bullet list; bare URLs become
 * links. Every substituted value is HTML-escaped, so a member's name can
 * never inject markup.
 */

export interface EmailTemplate {
  subject: string;
  body: string;
}
export type EmailTemplates = Record<TemplateKey, EmailTemplate>;

export const TEMPLATE_VARIABLES: Record<TemplateKey, { name: string; help: string }[]> = {
  welcome: [
    { name: 'firstName', help: "Member's first name" },
    { name: 'fullName', help: "Member's full name" },
    { name: 'batchLabel', help: 'e.g. BIM07 (1990–1992)' },
    { name: 'batchId', help: 'e.g. BIM07' },
    { name: 'appUrl', help: 'Link to the app' },
  ],
  birthday: [
    { name: 'firstName', help: "Member's first name" },
    { name: 'fullName', help: "Member's full name" },
    { name: 'batchLabel', help: 'e.g. BIM07 (1990–1992)' },
    { name: 'batchId', help: 'e.g. BIM07' },
    { name: 'appUrl', help: 'Link to the app' },
  ],
  meetup: [
    { name: 'batchLabel', help: 'Batch the Google Group belongs to' },
    { name: 'batchId', help: 'e.g. BIM07' },
    { name: 'monthName', help: 'e.g. September' },
    { name: 'year', help: 'e.g. 2026' },
    { name: 'saturdayDate', help: 'e.g. Saturday, 19 September' },
    { name: 'sundayDate', help: 'e.g. Sunday, 20 September' },
    { name: 'registrationDeadline', help: 'e.g. Thursday, 17 September, 11:59 PM IST' },
    { name: 'superconnectorUrl', help: 'Link to the registration page' },
    { name: 'appUrl', help: 'Link to the app' },
  ],
  jobs: [
    { name: 'batchLabel', help: 'Batch the Google Group belongs to' },
    { name: 'batchId', help: 'e.g. BIM07' },
    { name: 'monthName', help: 'e.g. September' },
    { name: 'year', help: 'e.g. 2026' },
    { name: 'jobsUrl', help: 'Link to the Jobs page' },
    { name: 'appUrl', help: 'Link to the app' },
  ],
};

export const DEFAULT_TEMPLATES: EmailTemplates = {
  welcome: {
    subject: 'Welcome to SuperConnector, {{firstName}}!',
    body: `Hi {{firstName}},

Welcome to SuperConnector. Your profile has been approved and you are now part of the {{batchLabel}} alumni community.

Here is what you can do right away:

- Complete your profile so your batchmates can find you
- Browse the alumni directory
- Join the monthly SuperConnector meetup for a one-to-one or small-circle conversation
- Discover or post job openings

Get started: {{appUrl}}

Warm regards,
Team BIMAA SuperConnector`,
  },
  birthday: {
    subject: 'Happy birthday, {{firstName}}! 🎉',
    body: `Dear {{firstName}},

Wishing you a very happy birthday from all of us at the BIM Alumni Association. May the year ahead bring you good health, great conversations and new opportunities.

Your {{batchId}} batchmates are only a message away: {{appUrl}}

Warm regards,
Team BIMAA SuperConnector`,
  },
  meetup: {
    subject: 'SuperConnector meetups this {{monthName}}: register by Thursday',
    body: `Dear {{batchId}} alumni,

This month's SuperConnector meetups are coming up:

- {{saturdayDate}}, 5:00 to 6:00 PM IST
- {{sundayDate}}, 5:00 to 6:00 PM IST

Choose one-to-one or a small circle and pick the slot that suits you. Registration closes on {{registrationDeadline}}.

Register here: {{superconnectorUrl}}

Warm regards,
Team BIMAA SuperConnector`,
  },
  jobs: {
    subject: 'Hiring at your organisation? Post it for fellow alumni',
    body: `Dear {{batchId}} alumni,

Is your organisation hiring this {{monthName}}? Share the opening with the alumni community: it takes a couple of minutes and reaches every member of the network.

Post or browse openings: {{jobsUrl}}

Know someone looking for a role? Point them to the Open to Work directory in the app.

Warm regards,
Team BIMAA SuperConnector`,
  },
};

/** Merge stored templates over the defaults (a missing/blank stored field falls back to the default). */
export function resolveTemplates(stored: unknown): EmailTemplates {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_TEMPLATES } as EmailTemplates;
  (Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).forEach((key) => {
    const t = s[key] as { subject?: unknown; body?: unknown } | undefined;
    if (t && typeof t.subject === 'string' && t.subject.trim() && typeof t.body === 'string' && t.body.trim()) {
      out[key] = { subject: t.subject, body: t.body };
    }
  });
  return out;
}

export type TemplateVars = Record<string, string>;

const VAR_RE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

function cleanValue(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ');
}

/** Replaces {{name}} with its value. Unknown variables are left visible so a typo is obvious in the preview. */
export function substitute(text: string, vars: TemplateVars): string {
  return text.replace(VAR_RE, (whole, name: string) => (name in vars ? cleanValue(vars[name]) : whole));
}

/** Variables used in a text that are not defined for this template, for editor validation. */
export function unknownVariables(text: string, key: TemplateKey): string[] {
  const known = new Set(TEMPLATE_VARIABLES[key].map((v) => v.name));
  const found = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) if (!known.has(m[1])) found.add(m[1]);
  return [...found];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (raw) => {
    const m = /^(.*?)([.,;:!?)]*)$/.exec(raw);
    const url = m ? m[1] : raw;
    const tail = m ? m[2] : '';
    return `<a href="${url}" style="color:#1b61c9">${url}</a>${tail}`;
  });
}

function inline(text: string): string {
  return linkify(escapeHtml(text)).replace(/\n/g, '<br>');
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmail(template: EmailTemplate, vars: TemplateVars): RenderedEmail {
  const subject = substitute(template.subject, vars).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const body = substitute(template.body, vars).replace(/\r\n/g, '\n').trim();

  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const htmlBlocks = blocks.map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^-\s+/.test(l))) {
      const items = lines.map((l) => `<li style="margin:0 0 6px">${inline(l.replace(/^-\s+/, ''))}</li>`).join('');
      return `<ul style="margin:0 0 16px;padding-left:22px">${items}</ul>`;
    }
    return `<p style="margin:0 0 16px">${inline(block)}</p>`;
  });

  const footer = `${EMAIL_SENDER_NAME} · BIM Alumni Association · ${APP_URL}`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc">` +
    `<div style="padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dddddd;border-radius:12px;padding:32px;` +
    `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333840">` +
    htmlBlocks.join('') +
    `<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0 12px">` +
    `<p style="margin:0;font-size:12px;color:#41454d">${escapeHtml(footer)}</p>` +
    `</div></div></body></html>`;

  const text = `${body}\n\n--\n${footer}\n`;
  return { subject, text, html };
}

/** Sample values for the console preview. */
export function sampleVars(key: TemplateKey): TemplateVars {
  const common = { batchLabel: 'BIM07 (1990–1992)', batchId: 'BIM07', appUrl: APP_URL, year: '2026', monthName: 'September' };
  if (key === 'welcome' || key === 'birthday') return { ...common, firstName: 'Asha', fullName: 'Asha Raman' };
  if (key === 'meetup')
    return {
      ...common,
      saturdayDate: 'Saturday, 19 September',
      sundayDate: 'Sunday, 20 September',
      registrationDeadline: 'Thursday, 17 September, 11:59 PM IST',
      superconnectorUrl: `${APP_URL}app/superconnector`,
    };
  return { ...common, jobsUrl: `${APP_URL}app/jobs` };
}
