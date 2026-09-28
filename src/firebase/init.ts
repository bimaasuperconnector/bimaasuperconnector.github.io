import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';
import { type Firestore, initializeFirestore } from 'firebase/firestore';
import { getFirebaseConfig, isFirebaseConfigured } from '../lib/env';

/**
 * Single source of Firebase initialization for the whole app.
 *
 * Nothing outside this file should call `initializeApp` / `getAuth` /
 * `getFirestore` directly — repositories and services import `auth` and
 * `db` from here instead. This keeps Firebase bootstrapping isolated and
 * easy to audit, per ARCHITECTURE.md.
 *
 * Firebase Storage is intentionally NOT initialized. Storage requires the
 * Blaze (pay-as-you-go) billing plan even at zero usage, and the owner has
 * decided not to introduce that paid dependency (CLAUDE.md section 14: no
 * paid service without explicit approval — here, explicit decline).
 * Profile photos are uploaded by members themselves (ImageKit, via a
 * Cloudflare Worker — see ProfilePhotoUpload.tsx); Google account
 * pictures are never used. If a genuine need for file storage comes up
 * later, it must be raised and approved before being added back.
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export const firebaseConfigured = isFirebaseConfigured();

if (firebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(getFirebaseConfig());
  auth = getAuth(app);
  // BUGFIX (2026-09-27), defense-in-depth alongside the profilesRepository.ts
  // fix: the default Firestore client throws ("Unsupported field value:
  // undefined") if ANY write, anywhere in the app, ever contains a
  // literal `undefined` at any nesting depth — this is exactly what
  // caused every profile save to fail (see profilesRepository.ts's
  // fromSnapshot fix for the root cause). ignoreUndefinedProperties
  // makes the SDK silently omit such fields instead of throwing, which
  // is what every write path in this codebase already assumes. This
  // does not change behavior for any well-formed write.
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} else {
  // Do not throw at import time: the landing page and static routes must
  // still render (e.g. during local development before configuration is
  // supplied, or if a build somehow ships without config). Any code path
  // that actually needs Firebase should check `firebaseConfigured` first.
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] Web app configuration is missing. Set the VITE_FIREBASE_* build variables. ' +
      'Authentication and data features are disabled until this is configured.',
  );
}

export { app, auth, db };
