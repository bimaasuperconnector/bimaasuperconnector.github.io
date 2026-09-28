import { useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import {
  PhotoUploadError,
  compressToSquareWebp,
  loadImage,
  uploadProfilePhoto,
  validateSourceFile,
} from '../../lib/photoUpload';

const VIEWPORT = 260; // CSS px — the square crop preview size

interface CropState {
  img: HTMLImageElement;
  baseScale: number; // CSS px per natural px at zoom = 1 (covers the viewport)
  zoom: number;
  panX: number; // top-left of the image, in CSS px, relative to the viewport
  panY: number;
}

interface ProfilePhotoUploadProps {
  user: FirebaseUser;
  photoURL: string | null;
  onChange: (result: { photoURL: string | null; photoFileId: string | null }) => void;
}

function clampPan(state: CropState): CropState {
  const scale = state.baseScale * state.zoom;
  const w = state.img.naturalWidth * scale;
  const h = state.img.naturalHeight * scale;
  return {
    ...state,
    panX: Math.min(0, Math.max(VIEWPORT - w, state.panX)),
    panY: Math.min(0, Math.max(VIEWPORT - h, state.panY)),
  };
}

/**
 * Profile photo upload with a lightweight pan/zoom square crop — built
 * with plain CSS transforms + a drag handler + a zoom slider rather than
 * a cropping library, so it adds no new dependency. See
 * src/lib/photoUpload.ts for the compression/upload logic
 * this component drives.
 */
export function ProfilePhotoUpload({ user, photoURL, onChange }: ProfilePhotoUploadProps) {
  const [crop, setCrop] = useState<CropState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(file: File) {
    setError(null);
    try {
      validateSourceFile(file);
      const img = await loadImage(file);
      const baseScale = VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * baseScale;
      const h = img.naturalHeight * baseScale;
      setCrop(
        clampPan({
          img,
          baseScale,
          zoom: 1,
          panX: (VIEWPORT - w) / 2,
          panY: (VIEWPORT - h) / 2,
        }),
      );
    } catch (e) {
      setError(e instanceof PhotoUploadError ? e.message : "Couldn't read that image.");
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!crop) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: crop.panX, panY: crop.panY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!crop || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setCrop(clampPan({ ...crop, panX: dragRef.current.panX + dx, panY: dragRef.current.panY + dy }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onZoomChange(zoom: number) {
    if (!crop) return;
    setCrop(clampPan({ ...crop, zoom }));
  }

  async function saveCrop() {
    if (!crop) return;
    setBusy(true);
    setError(null);
    try {
      const scale = crop.baseScale * crop.zoom;
      const size = VIEWPORT / scale;
      const blob = await compressToSquareWebp(crop.img, {
        x: -crop.panX / scale,
        y: -crop.panY / scale,
        size,
      });
      const result = await uploadProfilePhoto(user, blob);
      // Deleting the previous ImageKit asset is deliberately NOT done
      // here: the new photo isn't part of the member's profile until
      // they press "Save profile". ProfilePage deletes superseded
      // assets only after that save succeeds, so cancelling an edit
      // never leaves the profile pointing at a deleted image.
      onChange({ photoURL: result.url, photoFileId: result.fileId });
      setCrop(null);
    } catch (e) {
      setError(e instanceof PhotoUploadError ? e.message : "Couldn't upload the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function removePhoto() {
    // Same reasoning as above: the ImageKit asset is deleted by
    // ProfilePage after "Save profile" succeeds, not on this click.
    onChange({ photoURL: null, photoFileId: null });
  }

  if (crop) {
    const scale = crop.baseScale * crop.zoom;
    return (
      <div>
        <label className="text-label-md text-ink">Crop your photo</label>
        <div
          className="mt-xs overflow-hidden rounded-full border border-hairline"
          style={{ width: VIEWPORT, height: VIEWPORT, touchAction: 'none', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <img
            src={crop.img.src}
            alt=""
            draggable={false}
            style={{
              width: crop.img.naturalWidth * scale,
              height: crop.img.naturalHeight * scale,
              transform: `translate(${crop.panX}px, ${crop.panY}px)`,
              maxWidth: 'none',
            }}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={crop.zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="mt-sm block w-[260px]"
          aria-label="Zoom"
        />
        {error && <p className="mt-sm text-body-md text-signature-coral">{error}</p>}
        <div className="mt-sm flex gap-sm">
          <Button variant="primary" className="px-md py-xs" disabled={busy} onClick={() => void saveCrop()}>
            {busy ? 'Uploading…' : 'Save photo'}
          </Button>
          <Button variant="secondary" className="px-md py-xs" disabled={busy} onClick={() => setCrop(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-label-md text-ink">Photo</label>
      <div className="mt-xs flex items-center gap-md">
        <Avatar src={photoURL} sizeClass="h-16 w-16" />
        <div className="flex flex-wrap gap-sm">
          <Button
            variant="secondary"
            className="px-md py-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            {photoURL ? 'Replace photo' : 'Add photo'}
          </Button>
          {photoURL && (
            <Button variant="secondary" className="px-md py-xs" onClick={removePhoto}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFileSelected(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="mt-sm text-body-md text-signature-coral">{error}</p>}
    </div>
  );
}
