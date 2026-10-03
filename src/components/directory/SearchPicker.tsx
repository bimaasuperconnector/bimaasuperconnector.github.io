import { allBatches } from '../../lib/batches';
import { useBadgeCatalog, useChapterCatalog } from '../../lib/useCatalog';
import type { SearchPickerKind } from '../../lib/useDirectorySearch';

const BATCHES = allBatches();

const EMPTY_LABELS: Record<Exclude<SearchPickerKind, 'batch'>, string> = {
  badge: 'No badges have been created yet',
  chapter: 'No chapters have been created yet',
};

const PLACEHOLDERS: Record<SearchPickerKind, string> = {
  batch: 'Select a batch…',
  badge: 'Select a club or committee badge…',
  chapter: 'Select a chapter…',
};

/**
 * The drop-down used by the three "pick from a list" search types — batch,
 * badge and chapter — in both the header search and the Directory page.
 * Badge and chapter options come from the cached catalogs
 * (lib/catalogCache.ts), so opening this costs at most one catalog read per
 * 10 minutes however many times the search is opened. Choosing an option
 * calls onChange(value); choosing the blank option calls onChange('').
 */
export function SearchPicker({
  kind,
  value,
  onChange,
  id,
  className,
}: {
  kind: SearchPickerKind;
  value: string;
  onChange: (value: string) => void;
  id: string;
  className?: string;
}) {
  const badges = useBadgeCatalog(kind === 'badge');
  const chapters = useChapterCatalog(kind === 'chapter');

  let options: { value: string; label: string }[] = [];
  let loading = false;
  let failed = false;
  if (kind === 'batch') {
    options = BATCHES.map((b) => ({ value: String(b.batchNumber), label: b.label }));
  } else if (kind === 'badge') {
    options = badges.items.map((b) => ({ value: b.id, label: b.name }));
    loading = badges.loading;
    failed = badges.failed;
  } else {
    options = chapters.items.map((c) => ({ value: c.id, label: c.name }));
    loading = chapters.loading;
    failed = chapters.failed;
  }

  const empty = kind !== 'batch' && !loading && !failed && options.length === 0;
  const placeholder =
    loading
      ? 'Loading…'
      : failed
        ? "Couldn't load the list — try again"
        : kind === 'batch'
          ? PLACEHOLDERS.batch
          : empty
            ? EMPTY_LABELS[kind]
            : PLACEHOLDERS[kind];

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading || failed || empty}
      className={className ?? 'field w-full'}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
