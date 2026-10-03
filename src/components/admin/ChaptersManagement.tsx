import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { EmptyState, ErrorNote, SkeletonList } from '../ui/PageHeader';
import { MapPinIcon } from '../icons/NavIcons';
import { useAuth } from '../../context/AuthContext';
import {
  type Chapter,
  createChapter,
  deleteChapter,
  listChapters,
} from '../../firebase/repositories/chaptersRepository';

/**
 * super_admin-only chapter-catalog management, rendered in AdminIndexPage
 * next to BadgesManagement (same trust tier — a chapter is a platform-wide
 * taxonomy decision, not batch-scoped). Members enrol in up to 2 of these
 * on their own profile (ChapterPicker.tsx), can be searched by chapter in
 * the Directory, and events can be targeted at chapters.
 */
export function ChaptersManagement() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listChapters()
      .then(setChapters)
      .catch(() => setError("Couldn't load chapters."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function submit() {
    const trimmed = name.trim();
    if (!user || !trimmed) return;
    if (chapters.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError(`There is already a chapter called "${trimmed}".`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createChapter(user, trimmed);
      setName('');
      load();
    } catch {
      setError("Couldn't create that chapter. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(chapter: Chapter) {
    const sure = window.confirm(
      `Delete "${chapter.name}"? Members who already joined it keep it on their profile until they remove it, ` +
        'but nobody new can join and it disappears from search and from event targeting.',
    );
    if (!sure) return;
    try {
      await deleteChapter(chapter.id);
      setChapters((prev) => prev.filter((c) => c.id !== chapter.id));
    } catch {
      setError("Couldn't delete that chapter. Please try again.");
    }
  }

  return (
    <div id="chapters" className="surface-card scroll-mt-20 p-lg md:p-xl">
      <h2 className="font-haas-disp text-title-md text-ink">Chapters</h2>
      <p className="copy mt-xs">
        Create chapters members can join (up to 2 each) — e.g. "Chennai Chapter", "Mumbai Chapter", "TN Chapter",
        "India Chapter", "Europe Chapter", "Americas Chapter", "Australia Chapter". Chapters are searchable in the
        Directory and can be used to target events.
      </p>

      {error && (
        <div className="mt-sm">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-md flex flex-wrap items-end gap-sm">
        <div>
          <label className="text-caption text-muted" htmlFor="chapter-name">
            Chapter name
          </label>
          <input
            id="chapter-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            maxLength={40}
            placeholder="e.g. Chennai Chapter"
            className="mt-xs block field"
          />
        </div>
        <Button variant="primary" className="px-md py-xs" disabled={saving || !name.trim()} onClick={() => void submit()}>
          {saving ? 'Adding…' : 'Add chapter'}
        </Button>
      </div>

      <div className="mt-lg">
        {loading ? (
          <SkeletonList count={1} heightClass="h-10" />
        ) : chapters.length === 0 ? (
          <EmptyState title="No chapters yet" />
        ) : (
          <ul className="flex flex-wrap gap-sm">
            {chapters.map((chapter) => (
              <li
                key={chapter.id}
                className="flex min-h-[36px] items-center gap-xs rounded-md border border-hairline px-md py-xs"
              >
                <MapPinIcon width={14} height={14} />
                <span className="text-body-md text-ink">{chapter.name}</span>
                <button
                  type="button"
                  onClick={() => void remove(chapter)}
                  className="text-caption text-muted hover:text-signature-coral"
                  aria-label={`Delete ${chapter.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
