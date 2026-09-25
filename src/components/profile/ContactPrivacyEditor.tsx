import type { ProfileContact } from '../../firebase/repositories/profileContactsRepository';

interface RowProps {
  id: string;
  label: string;
  type: 'tel' | 'email' | 'url';
  value: string;
  placeholder: string;
  visible: boolean;
  onValueChange: (value: string) => void;
  onVisibleChange: (visible: boolean) => void;
}

function ContactRow({ id, label, type, value, placeholder, visible, onValueChange, onVisibleChange }: RowProps) {
  return (
    <div>
      <label className="text-label-md text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        maxLength={type === 'url' ? 300 : 200}
        className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
      />
      <label className="mt-xs flex items-center gap-xs text-body-md text-body">
        <input type="checkbox" checked={visible} onChange={(e) => onVisibleChange(e.target.checked)} />
        Show a {label} button on my profile to fellow alumni
      </label>
    </div>
  );
}

export function ContactPrivacyEditor({
  contact,
  onChange,
}: {
  contact: ProfileContact;
  onChange: (contact: ProfileContact) => void;
}) {
  return (
    <div className="space-y-lg rounded-md border border-hairline p-lg">
      <div>
        <h2 className="text-title-sm text-ink">Contact & privacy</h2>
        <p className="mt-xs text-body-md text-muted">
          Add these once — you choose exactly which ones fellow alumni can see. Anything you
          don't switch on stays private. If you do turn one on, it shows as a button (WhatsApp,
          Call, Email, LinkedIn) rather than as plain text — nobody sees your actual number or
          address, they just get a button that opens the right app.
        </p>
      </div>

      <div>
        <label className="text-label-md text-ink" htmlFor="dob">
          Date of birth
        </label>
        <input
          id="dob"
          type="date"
          value={contact.dob ?? ''}
          onChange={(e) => onChange({ ...contact, dob: e.target.value || null })}
          className="mt-xs block w-full max-w-[220px] rounded-sm border border-hairline px-md py-xs text-body-md"
        />
        <p className="mt-xs text-caption text-muted">
          Only ever visible to you — no one else, not even an admin. Used only to send you a
          birthday greeting.
        </p>
      </div>

      <ContactRow
        id="phone"
        label="Phone"
        type="tel"
        value={contact.phoneNumber}
        placeholder="+91 98765 43210"
        visible={contact.visibility.phone}
        onValueChange={(v) => onChange({ ...contact, phoneNumber: v })}
        onVisibleChange={(v) => onChange({ ...contact, visibility: { ...contact.visibility, phone: v } })}
      />

      <ContactRow
        id="whatsapp"
        label="WhatsApp"
        type="tel"
        value={contact.whatsappNumber}
        placeholder="+91 98765 43210 (with country code)"
        visible={contact.visibility.whatsapp}
        onValueChange={(v) => onChange({ ...contact, whatsappNumber: v })}
        onVisibleChange={(v) =>
          onChange({ ...contact, visibility: { ...contact.visibility, whatsapp: v } })
        }
      />

      <ContactRow
        id="contact-email"
        label="Email"
        type="email"
        value={contact.contactEmail}
        placeholder="you@example.com"
        visible={contact.visibility.email}
        onValueChange={(v) => onChange({ ...contact, contactEmail: v })}
        onVisibleChange={(v) => onChange({ ...contact, visibility: { ...contact.visibility, email: v } })}
      />

      <ContactRow
        id="contact-linkedin"
        label="LinkedIn"
        type="url"
        value={contact.linkedinUrl}
        placeholder="https://linkedin.com/in/…"
        visible={contact.visibility.linkedin}
        onValueChange={(v) => onChange({ ...contact, linkedinUrl: v })}
        onVisibleChange={(v) =>
          onChange({ ...contact, visibility: { ...contact.visibility, linkedin: v } })
        }
      />
    </div>
  );
}
