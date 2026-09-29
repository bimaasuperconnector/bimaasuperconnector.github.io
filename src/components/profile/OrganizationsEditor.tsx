import type { OrganizationEntry } from '../../firebase/repositories/profilesRepository';

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
