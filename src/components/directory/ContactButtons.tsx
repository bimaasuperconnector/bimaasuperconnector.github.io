import { LinkButton } from '../ui/Button';
import type { ContactVisibleMap } from '../../firebase/repositories/profilesRepository';

/**
 * Renders a row of contact buttons for whichever channels the profile
 * owner has chosen to reveal (see profilesRepository.ts'
 * `ContactVisibleMap` / profileContactsRepository.ts). Deliberately
 * button-style, not plain visible text/links — per the explicit product
 * requirement, a raw phone number is never printed on screen; clicking
 * "WhatsApp" or "Call" opens the relevant app directly via a `wa.me`/
 * `tel:` deep link instead. Renders nothing if the owner hasn't
 * revealed any channel.
 */
export function ContactButtons({ contact }: { contact: ContactVisibleMap | undefined }) {
  if (!contact) return null;

  const whatsappDigits = contact.whatsapp ? contact.whatsapp.replace(/[^0-9]/g, '') : '';
  const linkedinHref = contact.linkedin
    ? contact.linkedin.startsWith('http')
      ? contact.linkedin
      : `https://${contact.linkedin}`
    : '';

  const hasAny = Boolean(whatsappDigits || contact.phone || contact.email || linkedinHref);
  if (!hasAny) return null;

  return (
    <div className="mt-sm flex flex-wrap gap-xs">
      {whatsappDigits && (
        <LinkButton
          href={`https://wa.me/${whatsappDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="px-sm py-xxs text-body-md"
        >
          WhatsApp
        </LinkButton>
      )}
      {contact.phone && (
        <LinkButton href={`tel:${contact.phone}`} variant="secondary" className="px-sm py-xxs text-body-md">
          Call
        </LinkButton>
      )}
      {contact.email && (
        <LinkButton
          href={`mailto:${contact.email}`}
          variant="secondary"
          className="px-sm py-xxs text-body-md"
        >
          Email
        </LinkButton>
      )}
      {linkedinHref && (
        <LinkButton
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="px-sm py-xxs text-body-md"
        >
          LinkedIn
        </LinkButton>
      )}
    </div>
  );
}
