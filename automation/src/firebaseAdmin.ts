import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Reads the service account key from GOOGLE_APPLICATION_CREDENTIALS_JSON
 * (the full JSON key content as a string, not a file path — this is how
 * it arrives from a GitHub Actions secret). Never log this value. See
 * the chat setup instructions for how to generate and store this key —
 * it grants FULL Admin SDK access, bypassing every Firestore Rule in
 * this project, so it is treated as maximally sensitive.
 */
function loadServiceAccount() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS_JSON is not set. This must be the Firebase service account key JSON, provided as a GitHub Actions secret.',
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON.');
  }
}

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(loadServiceAccount()) });

export const db = getFirestore(app);
