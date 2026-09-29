import type { ReactNode } from 'react';
import {
  LinkedInIcon,
  MailIcon,
  PhoneIcon,
  WhatsAppIcon,
} from '../icons/NavIcons';
import type { ContactVisibleMap } from '../../firebase/repositories/profilesRepository';

/**
 * Renders the contact channels a profile owner has chosen to reveal (see
 * profilesRepository.ts' `ContactVisibleMap` / profileContactsRepository.ts)
 * as recognisable icon buttons — email, LinkedIn, call, WhatsApp — instead
 * of text labels. Only channels that are actually available are rendered,
 * and nothing at all if none are.
 *
 * Behaviour is unchanged from the text-button version: a raw phone number
 * or address is never printed on screen; tapping an icon opens the relevant
 * app through a `mailto:` / `tel:` / `wa.me` / LinkedIn deep link. Each icon
 * has an accessible name ("Email Priya", "Call Priya"…) and a matching
 * tooltip, and a 44px hit area.
 */
function ContactIcon({
  href,
  label,
  external,
  tone,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  tone: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border border-hairline bg-canvas transition-colors duration-150 hover:border-border-strong hover:bg-surface-soft active:bg-surface-strong ${tone}`}
    >
      {children}
    </a>
  );
}

export function ContactButtons({
  contact,
  name,
  className = 'mt-sm',
}: {
  contact: ContactVisibleMap | undefined;
  /** Used only for accessible labels, e.g. "Email Priya". */
  name?: string;
  className?: string;
}) {
  if (!contact) return null;

  const whatsappDigits = contact.whatsapp ? contact.whatsapp.replace(/[^0-9]/g, '') : '';
  const linkedinHref = contact.linkedin
    ? contact.linkedin.startsWith('http')
      ? contact.linkedin
      : `https://${contact.linkedin}`
    : '';

  const hasAny = Boolean(whatsappDigits || contact.phone || contact.email || linkedinHref);
  if (!hasAny) return null;

  const who = name ? ` ${name}` : '';

  return (
    <div className={`flex flex-wrap gap-sm ${className}`} role="group" aria-label="Contact options">
      {contact.email && (
        <ContactIcon href={`mailto:${contact.email}`} label={`Email${who}`} tone="text-ink">
          <MailIcon />
        </ContactIcon>
      )}
      {linkedinHref && (
        <ContactIcon href={linkedinHref} label={`LinkedIn${who ? ` profile of${who}` : ''}`} external tone="text-link">
          <LinkedInIcon />
        </ContactIcon>
      )}
      {contact.phone && (
        <ContactIcon href={`tel:${contact.phone}`} label={`Call${who}`} tone="text-ink">
          <PhoneIcon />
        </ContactIcon>
      )}
      {whatsappDigits && (
        <ContactIcon href={`https://wa.me/${whatsappDigits}`} label={`WhatsApp${who}`} external tone="text-success">
          <WhatsAppIcon />
        </ContactIcon>
      )}
    </div>
  );
}
