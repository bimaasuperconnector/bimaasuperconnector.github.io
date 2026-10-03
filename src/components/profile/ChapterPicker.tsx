import type { ProfileChapterRef } from '../../firebase/repositories/profilesRepository';
import { MAX_PROFILE_CHAPTERS } from '../../firebase/repositories/profilesRepository';
import type { Chapter } from '../../firebase/repositories/chaptersRepository';
import { useChapterCatalog } from '../../lib/useCatalog';

interface ChapterPickerProps {
  selected: ProfileChapterRef[];
  onChange: (chapters: ProfileChapterRef[]) => void;
}

/**
 * Lets a member enrol in up to MAX_PROFILE_CHAPTERS (2) chapters from the
 * super_admin-managed catalog (chaptersRepository.ts) — two because people
 * are often in one place now and return to another (e.g. Australia, and
 * Chennai once a year). Reads the shared, cached catalog only while this
 * form is open; cards and the read-only profile render the already-
 * denormalized `profile.chapters` instead (see ChapterChips.tsx).
 */
export function ChapterPicker({ selected, onChange }: ChapterPickerProps) {
  const { items: catalog, loading } = useChapterCatalog(true);

  function toggle(chapter: Chapter) {
    const isSelected = selected.some((c) => c.id === chapter.id);
    if (isSelected) {
      onChange(selected.filter((c) => c.id !== chapter.id));
      return;
    }
    if (selected.length >= MAX_PROFILE_CHAPTERS) return;
    onChange([...selected, { id: chapter.id, name: chapter.name }]);
  }

  // A chapter the admin has since deleted would otherwise stay on the
  // profile, count toward the limit and be impossible to remove, because it
  // no longer appears in the catalog. Show it so the member can drop it.
  const removed = selected.filter((s) => !catalog.some((c) => c.id === s.id));

  if (loading) {
    return <p className="text-body-md text-muted">Loading chapters…</p>;
  }
  if (catalog.length === 0 && removed.length === 0) return null;

  return (
    <div>
      <label className="text-label-md text-ink">
        Join your chapters ({selected.length}/{MAX_PROFILE_CHAPTERS})
      </label>
      <p className="mt-xs text-caption text-muted">
        Pick up to {MAX_PROFILE_CHAPTERS} — for example where you live now and where you return to.
      </p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {catalog.map((chapter) => {
          const isSelected = selected.some((c) => c.id === chapter.id);
          const disabled = !isSelected && selected.length >= MAX_PROFILE_CHAPTERS;
          return (
            <button
              key={chapter.id}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => toggle(chapter)}
              className={`rounded-full border px-md py-xs text-body-md transition-colors duration-150 ${
                isSelected
                  ? 'border-ink bg-ink text-on-primary'
                  : 'border-hairline text-body hover:border-border-strong'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {chapter.name}
            </button>
          );
        })}
        {removed.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => onChange(selected.filter((c) => c.id !== chapter.id))}
            className="rounded-full border border-dashed border-signature-coral px-md py-xs text-body-md text-signature-coral"
            title="This chapter is no longer available — click to remove it from your profile"
          >
            {chapter.name} ✕
          </button>
        ))}
      </div>
    </div>
  );
}
