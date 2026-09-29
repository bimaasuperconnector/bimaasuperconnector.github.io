import type { EducationEntry } from '../../firebase/repositories/profilesRepository';

interface EducationEditorProps {
  education: EducationEntry[];
  onChange: (education: EducationEntry[]) => void;
}

const EMPTY_EDUCATION: EducationEntry = {
  institution: '',
  degree: '',
  field: '',
  endYear: null,
};

export function EducationEditor({ education, onChange }: EducationEditorProps) {
  function updateAt(index: number, patch: Partial<EducationEntry>) {
    onChange(education.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeAt(index: number) {
    onChange(education.filter((_, i) => i !== index));
  }

  function add() {
    if (education.length >= 10) return;
    onChange([...education, EMPTY_EDUCATION]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-label-md text-ink">Education</label>
        <button
          type="button"
          onClick={add}
          disabled={education.length >= 10}
          className="text-body-md text-link hover:text-link-active disabled:opacity-50"
        >
          + Add education
        </button>
      </div>

      <div className="mt-sm space-y-sm">
        {education.length === 0 && (
          <p className="text-body-md text-muted">No education added yet.</p>
        )}
        {education.map((entry, index) => (
          <div key={index} className="surface-card p-md">
            <div className="grid gap-sm md:grid-cols-2">
              <input
                type="text"
                placeholder="Institution"
                value={entry.institution}
                onChange={(e) => updateAt(index, { institution: e.target.value })}
                className="field"
              />
              <input
                type="text"
                placeholder="Degree"
                value={entry.degree}
                onChange={(e) => updateAt(index, { degree: e.target.value })}
                className="field"
              />
              <input
                type="text"
                placeholder="Field of study"
                value={entry.field}
                onChange={(e) => updateAt(index, { field: e.target.value })}
                className="field"
              />
              <input
                type="number"
                placeholder="Year completed"
                value={entry.endYear ?? ''}
                onChange={(e) =>
                  updateAt(index, { endYear: e.target.value ? Number(e.target.value) : null })
                }
                className="field"
              />
            </div>
            <div className="mt-sm text-right">
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
