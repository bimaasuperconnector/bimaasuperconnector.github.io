import type { User as FirebaseUser } from 'firebase/auth';
import { getPhotoWorkerUrl } from './env';

const MAX_DIMENSION = 512;
const TARGET_MIN_BYTES = 100 * 1024;
const TARGET_MAX_BYTES = 250 * 1024;
const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024; // 15MB — generous headroom before compression
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export class PhotoUploadError extends Error {}

/** Validates the raw file the person picked, before any compression work happens. */
export function validateSourceFile(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    throw new PhotoUploadError('Please choose an image file (JPEG, PNG, WebP, or HEIC).');
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new PhotoUploadError('That image is too large. Please choose a file under 15MB.');
  }
}

/**
 * Crops `source` to the square region described by `crop` (in source-image
 * pixel coordinates) and resizes it to at most MAX_DIMENSION×MAX_DIMENSION,
 * then encodes to WebP, iterating the quality down until the result lands
 * under TARGET_MAX_BYTES (never below TARGET_MIN_BYTES's worth of quality
 * loss for a small source image — a tiny source simply produces a small
 * file, which is fine). Falls back to JPEG if the browser can't encode
 * WebP (very old Safari) — still resized/cropped either way.
 */
export async function compressToSquareWebp(
  source: HTMLImageElement,
  crop: { x: number; y: number; size: number },
): Promise<Blob> {
  const outputSize = Math.min(MAX_DIMENSION, Math.round(crop.size));
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoUploadError("Couldn't process that image on this device.");
  ctx.drawImage(source, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize);

  const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  const mime = supportsWebp ? 'image/webp' : 'image/jpeg';

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, mime, quality);
  // Iterate quality down (never below 0.4) until under the target ceiling.
  // A very simple photo may already be small at quality 0.85 — that's
  // fine, we only push quality DOWN, never pad a small file up.
  while (blob.size > TARGET_MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, mime, quality);
  }
  if (blob.size < TARGET_MIN_BYTES && quality < 0.95) {
    // Small/simple source image — try a slightly higher quality once,
    // purely to land closer to the target range; still bounded above.
    const higher = await canvasToBlob(canvas, mime, Math.min(0.95, quality + 0.15));
    if (higher.size <= TARGET_MAX_BYTES) blob = higher;
  }
  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoUploadError('Image processing failed.'))),
      mime,
      quality,
    );
  });
}

export interface UploadResult {
  url: string;
  fileId: string;
}

/** Turns a Worker error response into a message a member can act on. */
function messageForStatus(status: number): string {
  if (status === 401) return 'Your sign-in has expired. Please refresh the page and try again.';
  if (status === 403) return 'Only approved alumni can upload a profile photo.';
  if (status === 413) return 'That photo is too large after processing. Please try a different image.';
  if (status === 415) return 'That image format is not supported. Please choose a JPEG, PNG or WebP photo.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return "Couldn't upload the photo. Please try again.";
}

/**
 * Sends the already cropped + compressed photo to the Cloudflare Worker
 * (see cloudflare-worker/imagekit-worker.js), authenticated with the
 * member's Firebase ID token. The Worker verifies that token, checks
 * the member is approved, re-validates size/format, chooses the upload
 * path itself (/profile-photos/{uid}/) and uploads to ImageKit with the
 * ImageKit private key, which exists only as a Cloudflare Worker
 * secret. Nothing in the browser can influence where the file lands.
 */
export async function uploadProfilePhoto(user: FirebaseUser, blob: Blob): Promise<UploadResult> {
  const workerUrl = getPhotoWorkerUrl();
  if (!workerUrl) {
    throw new PhotoUploadError('Photo upload is not configured yet.');
  }
  const idToken = await user.getIdToken();
  const form = new FormData();
  form.append('file', blob, blob.type === 'image/jpeg' ? 'profile.jpg' : 'profile.webp');

  let response: Response;
  try {
    response = await fetch(`${workerUrl}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: form,
    });
  } catch {
    throw new PhotoUploadError('Network problem while uploading. Please check your connection and try again.');
  }
  if (!response.ok) {
    throw new PhotoUploadError(messageForStatus(response.status));
  }
  const result = (await response.json()) as Partial<UploadResult>;
  if (typeof result.url !== 'string' || typeof result.fileId !== 'string') {
    throw new PhotoUploadError("Couldn't upload the photo. Please try again.");
  }
  return { url: result.url, fileId: result.fileId };
}

/**
 * Asks the Worker to delete an ImageKit asset that the member no longer
 * uses. The Worker only deletes files inside the caller's own
 * /profile-photos/{uid}/ folder. Best-effort: a failure never blocks a
 * profile save — it just leaves one orphaned image in ImageKit. Never
 * throws.
 */
export async function deleteProfilePhotoAsset(user: FirebaseUser, fileId: string): Promise<void> {
  const workerUrl = getPhotoWorkerUrl();
  if (!workerUrl) return;
  try {
    const idToken = await user.getIdToken();
    await fetch(`${workerUrl}/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });
  } catch {
    // best-effort — see doc comment above.
  }
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PhotoUploadError("Couldn't read that image."));
    img.src = url;
  });
}
