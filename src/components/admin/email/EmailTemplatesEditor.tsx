import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { ErrorNote, SkeletonList } from '../../ui/PageHeader';
import { useAuth } from '../../../context/AuthContext';
import { TEMPLATE_KEYS, TEMPLATE_LABELS, type TemplateKey } from '../../../lib/emailConfig';
import {
  DEFAULT_TEMPLATES,
  type EmailTemplates,
  TEMPLATE_VARIABLES,
  renderEmail,
  sampleVars,
  unknownVariables,
} from '../../../lib/emailTemplates';
import { getEmailTemplates, saveEmailTemplates } from '../../../firebase/repositories/emailAutomationRepository';

export function EmailTemplatesEditor() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplates | null>(null);
  const [saved, setSaved] = useState<EmailTemplates | null>(null);
  const [active, setActive] = useState<TemplateKey>('welcome');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getEmailTemplates()
      .then((t) => {
        setTemplates(t);
        setSaved(t);
      })
      .catch(() => setError("Couldn't load the templates."));
  }, []);

  if (error && !templates) return <ErrorNote>{error}</ErrorNote>;
  if (!templates || !saved) return <SkeletonList count={2} heightClass="h-32" />;

  const current = templates[active];
  const dirty = JSON.stringify(templates) !== JSON.stringify(saved);
  const unknown = [...new Set([...unknownVariables(current.subject, active), ...unknownVariables(current.body, active)])];
  const preview = renderEmail(current, sampleVars(active));

  function edit(patch: Partial<{ subject: string; body: string }>) {
    setMessage(null);
    setTemplates((t) => (t ? { ...t, [active]: { ...t[active], ...patch } } : t));
  }

  function insertVariable(name: string) {
    const el = bodyRef.current;
    const token = `{{${name}}}`;
    if (!el) return edit({ body: `${current.body}${token}` });
    const start = el.selectionStart ?? current.body.length;
    const end = el.selectionEnd ?? start;
    edit({ body: current.body.slice(0, start) + token + current.body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    if (!user || !templates) return;
    const bad = TEMPLATE_KEYS.find((k) => !templates[k].subject.trim() || !templates[k].body.trim());
    if (bad) {
      setError(`"${TEMPLATE_LABELS[bad]}" needs both a subject and a message.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveEmailTemplates(user.uid, templates);
      setSaved(templates);
      setMessage('Templates saved. They apply from the next run.');
    } catch {
      setError("Couldn't save the templates. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap gap-xs" role="tablist" aria-label="Email templates">
        {TEMPLATE_KEYS.map((k) => (
          <button key={k} role="tab" aria-selected={active === k} className="tab-chip" onClick={() => setActive(k)}>
            {TEMPLATE_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="grid gap-lg lg:grid-cols-2">
        <div className="space-y-sm">
          <label className="block">
            <span className="text-label-md text-ink">Subject</span>
            <input className="field mt-xxs w-full" value={current.subject} maxLength={200} onChange={(e) => edit({ subject: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-label-md text-ink">Message</span>
            <textarea
              ref={bodyRef}
              className="field mt-xxs w-full font-mono text-[13px]"
              rows={15}
              maxLength={10000}
              value={current.body}
              onChange={(e) => edit({ body: e.target.value })}
            />
          </label>
          <p className="text-body-md text-muted">
            Plain text. A blank line starts a new paragraph, lines starting with "- " become a bullet list, and web addresses become links.
          </p>
          <div>
            <p className="text-caption text-muted">Click to insert a placeholder:</p>
            <div className="mt-xs flex flex-wrap gap-xs">
              {TEMPLATE_VARIABLES[active].map((v) => (
                <button key={v.name} type="button" title={v.help} className="chip" onClick={() => insertVariable(v.name)}>
                  {`{{${v.name}}}`}
                </button>
              ))}
            </div>
          </div>
          {unknown.length > 0 && (
            <ErrorNote>Unknown placeholder(s) that will be sent as-is: {unknown.map((u) => `{{${u}}}`).join(', ')}</ErrorNote>
          )}
          <button
            type="button"
            className="text-body-md text-link"
            onClick={() => {
              if (confirm('Replace this template with the original wording? (Not saved until you press Save.)')) edit(DEFAULT_TEMPLATES[active]);
            }}
          >
            Restore the original wording
          </button>
        </div>

        <div>
          <p className="text-label-md text-ink">Preview (sample details)</p>
          <div className="mt-xxs rounded-lg border border-hairline">
            <p className="border-b border-hairline px-md py-sm text-body-md text-ink">
              <span className="text-muted">Subject: </span>
              {preview.subject}
            </p>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[460px] w-full rounded-b-lg bg-canvas" />
          </div>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap items-center gap-md">
        <Button disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save templates'}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={() => setTemplates(saved)}>
            Discard changes
          </Button>
        )}
        {message && <p className="text-body-md text-success">{message}</p>}
      </div>
    </div>
  );
}
