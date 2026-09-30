import {
  HANDLE_PLATFORMS,
  MAX_ORG_HANDLES,
  type OrganizationEntry,
} from '../../firebase/repositories/profilesRepository';

interface OrganizationsEditorProps {
  organizations: OrganizationEntry[];
  onChange: (organizations: OrganizationEntry[]) => void;
}

const EMPTY_ORG: OrganizationEntry = {
  name: '',
  title: '',
  startYear: null,
  endYear: null,
  isFounder: false,
};

export function OrganizationsEditor({ organizations, onChange }: OrganizationsEditorProps) {
  function updateAt(index: number, patch: Partial<OrganizationEntry>) {
    onChange(organizations.map((org, i) => (i === index ? { ...org, ...patch } : org)));
  }

  function removeAt(index: number) {
    onChange(organizations.filter((_, i) => i !== index));
  }

  function addHandle(index: number) {
    const current = organizations[index].handles ?? [];
    if (current.length >= MAX_ORG_HANDLES) return;
    updateAt(index, { handles: [...current, { platform: 'linkedin', url: '' }] });
  }

  function updateHandle(index: number, hIndex: number, patch: { platform?: string; url?: string }) {
    const current = organizations[index].handles ?? [];
    updateAt(index, { handles: current.map((h, i) => (i === hIndex ? { ...h, ...patch } : h)) });
  }

  function removeHandle(index: number, hIndex: number) {
    const current = organizations[index].handles ?? [];
    updateAt(index, { handles: current.filter((_, i) => i !== hIndex) });
  }

  function add() {
    if (organizations.length >= 10) return;
    onChange([...organizations, EMPTY_ORG]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-label-md text-ink">Organizations</label>
        <button
          type="button"
          onClick={add}
          disabled={organizations.length >= 10}
          className="text-body-md text-link hover:text-link-active disabled:opacity-50"
        >
          + Add organization
        </button>
      </div>

      <div className="mt-sm space-y-sm">
        {organizations.length === 0 && (
          <p className="text-body-md text-muted">No organizations added yet.</p>
        )}
        {organizations.map((org, index) => (
          <div key={index} className="surface-card p-md">
            <div className="grid gap-sm md:grid-cols-2">
              <input
                type="text"
                placeholder="Organization name"
                value={org.name}
                onChange={(e) => updateAt(index, { name: e.target.value })}
                className="field"
              />
              <input
                type="text"
                placeholder="Title / role"
                value={org.title}
                onChange={(e) => updateAt(index, { title: e.target.value })}
                className="field"
              />
              <input
                type="number"
                placeholder="Start year"
                value={org.startYear ?? ''}
                onChange={(e) =>
                  updateAt(index, { startYear: e.target.value ? Number(e.target.value) : null })
                }
                className="field"
              />
              <input
                type="number"
                placeholder="End year (blank = current)"
                value={org.endYear ?? ''}
                onChange={(e) =>
                  updateAt(index, { endYear: e.target.value ? Number(e.target.value) : null })
                }
                className="field"
              />
            </div>
            {org.isFounder && (
              <div className="fade-enter mt-md rounded-lg bg-surface-soft p-md">
                <label className="text-label-md text-ink" htmlFor={`org-website-${index}`}>
                  Website / link
                </label>
                <input
                  id={`org-website-${index}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://yourcompany.com"
                  maxLength={300}
                  value={org.website ?? ''}
                  onChange={(e) => updateAt(index, { website: e.target.value })}
                  className="field mt-xs block w-full"
                />
                <p className="mt-xs text-caption text-muted">
                  Shown on the Entrepreneurship page so fellow alumni can find your venture.
                </p>

                {(org.handles ?? []).length > 0 && (
                  <ul className="mt-md space-y-sm">
                    {(org.handles ?? []).map((handle, hIndex) => (
                      <li key={hIndex} className="flex flex-col gap-xs sm:flex-row">
                        <select
                          aria-label="Platform"
                          value={handle.platform}
                          onChange={(e) => updateHandle(index, hIndex, { platform: e.target.value })}
                          className="field sm:w-[160px]"
                        >
                          {HANDLE_PLATFORMS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="url"
                          inputMode="url"
                          aria-label="Handle link"
                          placeholder="https://…"
                          maxLength={300}
                          value={handle.url}
                          onChange={(e) => updateHandle(index, hIndex, { url: e.target.value })}
                          className="field min-w-0 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeHandle(index, hIndex)}
                          className="inline-flex min-h-[44px] items-center px-xs text-body-md text-signature-coral hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {(org.handles ?? []).length < MAX_ORG_HANDLES && (
                  <button
                    type="button"
                    onClick={() => addHandle(index)}
                    className="mt-md inline-flex min-h-[36px] items-center text-body-md text-link hover:text-link-active"
                  >
                    + Add Handles
                  </button>
                )}
              </div>
            )}

            <div className="mt-sm flex items-center justify-between">
              <label className="flex items-center gap-xs text-body-md text-body">
                <input
                  type="checkbox"
                  checked={org.isFounder}
                  onChange={(e) => updateAt(index, { isFounder: e.target.checked })}
                />
                I founded/own this
              </label>
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="inline-flex min-h-[36px] items-center text-body-md text-signature-coral hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
