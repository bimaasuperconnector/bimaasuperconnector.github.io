import { type KeyboardEvent, useState } from 'react';

interface TagInputProps {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  maxTags?: number;
  /** Optional helper line shown between the label and the field. */
  hint?: string;
}

export function TagInput({ label, placeholder, values, onChange, maxTags = 20, hint }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    if (values.length >= maxTags) return;
    onChange([...values, trimmed]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(values.filter((value) => value !== tag));
  }

  return (
    <div>
      <label className="text-label-md text-ink">{label}</label>
      {hint && <p className="mt-xxs text-caption text-muted">{hint}</p>}
      <div className="mt-xs flex flex-wrap gap-xs rounded-sm border border-hairline p-sm transition-colors duration-150 focus-within:border-info-border focus-within:ring-2 focus-within:ring-info-border/25">
        {values.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-xxs rounded-sm bg-surface-soft px-sm py-xxs text-body-md text-ink"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="text-muted hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-h-[28px] min-w-[120px] flex-1 border-none bg-transparent text-body-md text-ink outline-none focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
