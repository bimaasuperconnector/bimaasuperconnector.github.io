/**
 * SuperConnector profile-photo Worker (Cloudflare Workers, free plan).
 *
 * Paste this whole file into the Cloudflare dashboard's Worker code
 * editor — no command-line tools, no build step, no dependencies.
 *
 * WHAT IT DOES
 *   POST /upload  multipart form, field "file" (a cropped, compressed
 *                 WebP or JPEG). Verifies the caller's Firebase sign-in,
 *                 confirms they are an APPROVED alumnus, validates the
 *                 file, uploads it to ImageKit into that member's own
 *                 folder, and returns { url, fileId }.
 *   POST /delete  JSON { fileId }. Deletes a previous photo — only if it
 *                 lives inside the caller's own folder.
 *   GET  /health  Reports whether the Worker is configured (true/false
 *                 flags only — never any values).
 *
 * WHY THE WORKER RECEIVES THE FILE INSTEAD OF ONLY SIGNING A TOKEN
 *   ImageKit's signed-upload token does not bind to a file size, format
 *   or folder — anyone holding a token could upload anything anywhere.
 *   Because this Worker performs the upload itself, the size limit, the
 *   format check and the upload path are enforced here, server-side,
 *   and cannot be influenced by the browser.
 *
 * CONFIGURATION (Worker -> Settings -> Variables and Secrets)
 *   FIREBASE_PROJECT_ID   Text      e.g. bim-superconnector
 *   ALLOWED_ORIGINS       Text      comma-separated, e.g.
 *                                   https://bimsuperconnector.github.io
 *   IMAGEKIT_PRIVATE_KEY  SECRET    your ImageKit private key
 *
 * The ImageKit private key exists ONLY as a Cloudflare Worker secret.
 * It is never in frontend code, never in GitHub, and never logged.
 */

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const IMAGEKIT_API_URL = 'https://api.imagekit.io/v1/files';

// The browser already compresses to <= 512x512, targeting 100-250 KB.
// The server cap leaves headroom but stops anything abusive.
const MAX_FILE_BYTES = 512 * 1024;
const MAX_UPLOAD_BODY_BYTES = MAX_FILE_BYTES + 64 * 1024; // multipart overhead
const MAX_DELETE_BODY_BYTES = 2 * 1024;
const PHOTO_ROOT = '/profile-photos';
const CLOCK_SKEW_SECONDS = 60;

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function respond(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

function base64UrlToBytes(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonPart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------
// Firebase ID token verification (RS256, against Google's public keys)
// ---------------------------------------------------------------------

let jwksCache = { keys: null, expiresAt: 0 };

async function loadJwks(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && jwksCache.keys && now < jwksCache.expiresAt) return jwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) throw new HttpError(503, 'Could not load Google signing keys.');
  const body = await response.json();
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '');
  const ttlMs = (maxAge ? Number(maxAge[1]) : 3600) * 1000;
  jwksCache = { keys: body.keys || [], expiresAt: now + Math.min(ttlMs, 6 * 3600 * 1000) };
  return jwksCache.keys;
}

/** Returns the verified Firebase uid, or throws HttpError(401). */
async function verifyFirebaseIdToken(idToken, projectId) {
  const fail = () => new HttpError(401, 'Invalid or expired sign-in.');
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw fail();

  let header;
  let payload;
  try {
    header = decodeJsonPart(parts[0]);
    payload = decodeJsonPart(parts[1]);
  } catch {
    throw fail();
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw fail();

  let keys = await loadJwks(false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Google rotates keys — refresh once before rejecting.
    keys = await loadJwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw fail();

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw fail();

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw fail();
  if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_SECONDS) throw fail();
  if (typeof payload.auth_time === 'number' && payload.auth_time > now + CLOCK_SKEW_SECONDS) throw fail();
  if (payload.aud !== projectId) throw fail();
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw fail();
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) throw fail();
  return payload.sub;
}

/**
 * Confirms users/{uid}.status is "approved" OR "pending". Applicants whose
 * account is still awaiting review may upload a profile photo for their
 * pending-approval profile so approvers can recognise them; a rejected
 * account (or no account at all) may not. The lookup is made with the
 * CALLER'S OWN ID token, so Firestore's own security rules decide
 * whether it is allowed (a member can only ever read their own users
 * document) — the Worker needs no Firebase service-account key at all.
 */
async function isApprovedMember(uid, idToken, projectId) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  } catch {
    throw new HttpError(503, 'Could not check membership. Please try again.');
  }
  if (response.status === 404 || response.status === 403) return false;
  if (!response.ok) throw new HttpError(503, 'Could not check membership. Please try again.');
  const doc = await response.json();
  const status = doc?.fields?.status?.stringValue;
  return status === 'approved' || status === 'pending';
}

/** Full gate shared by every route: config -> origin -> token -> approved. */
async function authenticate(request, env) {
  if (!env.FIREBASE_PROJECT_ID || !env.IMAGEKIT_PRIVATE_KEY || !env.ALLOWED_ORIGINS) {
    throw new HttpError(500, 'Worker is not configured.');
  }
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) {
    throw new HttpError(403, 'Origin not allowed.');
  }
  const match = /^Bearer (.+)$/.exec(request.headers.get('Authorization') || '');
  if (!match) throw new HttpError(401, 'Missing sign-in.');
  const idToken = match[1];

  const uid = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  // The uid becomes part of an ImageKit folder path, so refuse anything
  // that is not plain letters/digits (Google Sign-In uids always are).
  if (!/^[A-Za-z0-9]{1,128}$/.test(uid)) throw new HttpError(403, 'Not allowed.');
  if (!(await isApprovedMember(uid, idToken, env.FIREBASE_PROJECT_ID))) {
    throw new HttpError(403, 'Only alumni with an active or pending account can do this.');
  }
  return uid;
}

function imagekitAuthHeader(env) {
  return `Basic ${btoa(`${env.IMAGEKIT_PRIVATE_KEY}:`)}`;
}

// ---------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------

/** Identifies the REAL format from the file's first bytes, not its name. */
function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------

async function handleUpload(request, env) {
  const contentLength = Number(request.headers.get('Content-Length'));
  if (!request.headers.has('Content-Length') || Number.isNaN(contentLength)) {
    throw new HttpError(411, 'Content-Length required.');
  }
  if (contentLength > MAX_UPLOAD_BODY_BYTES) throw new HttpError(413, 'File too large.');
  if (!(request.headers.get('Content-Type') || '').startsWith('multipart/form-data')) {
    throw new HttpError(415, 'Expected a multipart form upload.');
  }

  // Authenticate BEFORE reading the body so unauthenticated callers cost nothing.
  const uid = await authenticate(request, env);

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'Could not read the upload.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(400, 'No file provided.');
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) throw new HttpError(413, 'File too large.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  // Both the real bytes AND the declared type must be WebP or JPEG.
  if (!kind || file.type !== kind.mime) throw new HttpError(415, 'Only WebP or JPEG photos are accepted.');

  // The browser never chooses the folder or the name.
  const folder = `${PHOTO_ROOT}/${uid}`;
  const upstream = new FormData();
  upstream.append('file', new Blob([bytes], { type: kind.mime }), `photo.${kind.ext}`);
  upstream.append('fileName', `photo.${kind.ext}`);
  upstream.append('folder', folder);
  upstream.append('useUniqueFileName', 'true');
  upstream.append('isPrivateFile', 'false');

  let response;
  try {
    response = await fetch(IMAGEKIT_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: imagekitAuthHeader(env) },
      body: upstream,
    });
  } catch {
    throw new HttpError(502, 'Photo service (ImageKit) could not be reached.');
  }
  if (!response.ok) {
    // ImageKit's own error text (e.g. "Your account cannot be authenticated"
    // for a wrong private key) is safe to pass on and makes setup
    // mistakes obvious. It never contains the key.
    let detail = '';
    try {
      detail = String((await response.json()).message || '').slice(0, 150);
    } catch {
      // non-JSON error body — status code alone is still useful
    }
    throw new HttpError(
      502,
      `ImageKit rejected the upload (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }
  const result = await response.json();
  if (
    typeof result.url !== 'string' ||
    typeof result.fileId !== 'string' ||
    !String(result.filePath || '').startsWith(`${folder}/`)
  ) {
    throw new HttpError(502, 'Unexpected response from photo service.');
  }
  return { url: result.url, fileId: result.fileId };
}

async function handleDelete(request, env) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_DELETE_BODY_BYTES) throw new HttpError(413, 'Request too large.');

  const uid = await authenticate(request, env);

  let fileId;
  try {
    fileId = (await request.json())?.fileId;
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9]{10,64}$/.test(fileId)) {
    throw new HttpError(400, 'Invalid fileId.');
  }

  const auth = imagekitAuthHeader(env);
  const details = await fetch(`${IMAGEKIT_API_URL}/${fileId}/details`, { headers: { Authorization: auth } });
  if (details.status === 404) return { deleted: false }; // already gone
  if (!details.ok) throw new HttpError(502, 'Photo service error.');
  const info = await details.json();
  // A member may only ever delete files inside their OWN folder.
  if (!String(info.filePath || '').startsWith(`${PHOTO_ROOT}/${uid}/`)) {
    throw new HttpError(403, 'That file does not belong to you.');
  }
  const removal = await fetch(`${IMAGEKIT_API_URL}/${fileId}`, { method: 'DELETE', headers: { Authorization: auth } });
  return { deleted: removal.ok };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }
      if (url.pathname === '/health' && request.method === 'GET') {
        return respond(request, env, {
          ok: true,
          firebaseProjectIdSet: Boolean(env.FIREBASE_PROJECT_ID),
          allowedOriginsSet: Boolean(env.ALLOWED_ORIGINS),
          imagekitPrivateKeySet: Boolean(env.IMAGEKIT_PRIVATE_KEY),
        });
      }
      if (url.pathname === '/upload' && request.method === 'POST') {
        return respond(request, env, await handleUpload(request, env));
      }
      if (url.pathname === '/delete' && request.method === 'POST') {
        return respond(request, env, await handleDelete(request, env));
      }
      return respond(request, env, { error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return respond(request, env, { error: error.message }, error.status);
      // Never leak internals or secrets in an error response.
      return respond(request, env, { error: 'Unexpected error.' }, 500);
    }
  },
};
