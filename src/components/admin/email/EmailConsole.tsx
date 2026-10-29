import { useState } from 'react';
import { EmailActivity } from './EmailActivity';
import { EmailControls } from './EmailControls';
import { EmailGroups } from './EmailGroups';
import { EmailManualSends } from './EmailManualSends';
import { EmailTemplatesEditor } from './EmailTemplatesEditor';

const TABS = [
  ['controls', 'Controls & status'],
  ['templates', 'Templates'],
  ['groups', 'Google Groups'],
  ['manual', 'Manual send'],
  ['activity', 'Queue & history'],
] as const;
type TabId = (typeof TABS)[number][0];

/** Superadmin-only. Each tab loads its own data only while open (no background reads). */
export function EmailConsole() {
  const [tab, setTab] = useState<TabId>('controls');
  return (
    <section className="surface-card p-lg md:p-xl">
      <h2 className="font-haas-disp text-title-md text-ink">Email &amp; reminders</h2>
      <p className="copy mt-xxs">
        Welcome emails, birthday greetings and monthly Google Group reminders, sent from bimaasuperconnector@gmail.com by a daily automation.
      </p>
      <div className="-mx-md mt-md flex gap-xs overflow-x-auto px-md pb-xxs no-scrollbar md:mx-0 md:px-0" role="tablist" aria-label="Email sections">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className="tab-chip shrink-0" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-lg">
        {tab === 'controls' && <EmailControls />}
        {tab === 'templates' && <EmailTemplatesEditor />}
        {tab === 'groups' && <EmailGroups />}
        {tab === 'manual' && <EmailManualSends />}
        {tab === 'activity' && <EmailActivity />}
      </div>
    </section>
  );
}
