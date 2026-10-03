import { Link } from 'react-router-dom';
import type { ProfileChapterRef } from '../../firebase/repositories/profilesRepository';
import { MapPinIcon } from '../icons/NavIcons';

/**
 * Chapter chips — outlined with a pin so they read differently from the
 * filled club/committee badge chips. Reads only the profile's own
 * denormalized data (zero extra Firestore reads). With `linkable`, each
 * chip opens the Directory already searching that chapter.
 */
export function ChapterChips({ chapters, linkable = false }: { chapters: ProfileChapterRef[]; linkable?: boolean }) {
  if (!chapters || chapters.length === 0) return null;
  const chipClass =
    'inline-flex items-center gap-xxs rounded-md border border-ink px-sm py-xxs text-caption text-ink';
  return (
    <>
      {chapters.map((chapter) =>
        linkable ? (
          <Link
            key={chapter.id}
            to={`/app/directory?mode=chapter&q=${encodeURIComponent(chapter.id)}`}
            className={`${chipClass} transition-colors duration-150 hover:bg-surface-soft`}
            title={`See other members of ${chapter.name}`}
          >
            <MapPinIcon width={12} height={12} />
            {chapter.name}
          </Link>
        ) : (
          <span key={chapter.id} className={chipClass}>
            <MapPinIcon width={12} height={12} />
            {chapter.name}
          </span>
        ),
      )}
    </>
  );
}
