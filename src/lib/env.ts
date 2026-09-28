/**
 * Typed access to build-time environment variables.
 *
 * All of these are Firebase *web client configuration* values, not secrets.
 * They are safe to ship inside the built JS bundle (this is how every
 * Firebase web app works) but are still injected at build time via GitHub
 * Actions repository variables so nothing is hard-coded in source control.
 *
 * See the chat response for Phase 0 for exact setup steps.
 */
interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

function readEnv(name: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value : '';
}

export function getFirebaseConfig(): FirebaseWebConfig {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
    measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID') || undefined,
  };
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

/**
 * Profile-photo backend configuration. The frontend never talks to
 * ImageKit directly: it sends the (already cropped/compressed) photo to
 * a Cloudflare Worker, which verifies the member's Firebase sign-in,
 * checks they are an approved alumnus, validates the file, and uploads
 * it to ImageKit using the ImageKit private key stored ONLY as a
 * Cloudflare Worker secret. The Worker's public URL is not a secret —
 * it is safe as a plain GitHub Actions Variable, like the Firebase
 * web config above. Neither the ImageKit public key nor the ImageKit
 * URL endpoint are needed in the frontend at all anymore; the Worker
 * returns the finished photo URL.
 */
export function getPhotoWorkerUrl(): string {
  // Strip any trailing slash so `${url}/upload` never produces `//upload`.
  return readEnv('VITE_PHOTO_WORKER_URL').replace(/\/+$/, '');
}

export function isPhotoUploadConfigured(): boolean {
  return getPhotoWorkerUrl() !== '';
}
