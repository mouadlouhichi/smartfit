/**
 * Shared env handling for the scripts in this directory.
 *
 * Two papercuts this exists for:
 *
 *  1. `node scripts/foo.mjs` does not read the repo's `.env` — Next.js loads
 *     it for the app, so it is natural to assume a script sees it too. It
 *     doesn't, and "but env has it" is exactly the confusion that follows.
 *  2. The app's server code reads FIREBASE_ADMIN_* while the scripts
 *     historically read FIREBASE_*. A .env configured for the deployed app
 *     therefore looks empty to the scripts.
 *
 * Usage at the top of a script (before any process.env read):
 *
 *   import { loadRepoEnv, scriptCreds } from './lib/load-env.mjs';
 *   loadRepoEnv();
 *   const { projectId, clientEmail, privateKey } = scriptCreds();
 *
 * Precedence: the real environment always wins over .env, so an inline
 * `FIREBASE_PROJECT_ID=... node scripts/…` still overrides the file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The repo root (this file lives in scripts/lib/). */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Load the repo-root `.env` into `process.env` for any name not already set.
 * Best-effort dotenv parsing: comments, blank lines, optional surrounding
 * quotes. Values that need newlines (service-account keys) are stored as
 * single lines with literal `\n` escapes — the same convention the scripts
 * have always unescaped themselves.
 *
 * @returns {number} how many variables were loaded
 */
export function loadRepoEnv() {
  const path = `${ROOT}/.env`;
  if (!existsSync(path)) return 0;

  let loaded = 0;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, '');
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
    }
    if (value === '' || process.env[key] !== undefined) continue;
    process.env[key] = value;
    loaded += 1;
  }
  return loaded;
}

/**
 * Resolve the service-account credentials a script needs, accepting every
 * convention this repo has ever used:
 *
 *   - the scripts' historical names: FIREBASE_PROJECT_ID / _CLIENT_EMAIL /
 *     _PRIVATE_KEY
 *   - the app's server names: FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL /
 *     _PRIVATE_KEY, or one FIREBASE_ADMIN_SERVICE_ACCOUNT JSON blob
 *   - GOOGLE_CLOUD_PROJECT (kept for parity with the app's admin config)
 *
 * `privateKey` comes back with `\n` escapes already unescaped, ready for
 * `cert()`.
 */
export function scriptCreds() {
  loadRepoEnv();

  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || '';
  let clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';

  // One JSON blob beats three loose names when both are present only in part.
  const blob = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (blob) {
    try {
      const sa = JSON.parse(blob);
      projectId = projectId || sa.project_id || '';
      clientEmail = clientEmail || sa.client_email || '';
      privateKey = privateKey || sa.private_key || '';
    } catch {
      // A malformed blob is reported as part of the missing-creds message
      // below rather than crashing here with a JSON stack trace.
    }
  }

  return {
    projectId: projectId.trim(),
    clientEmail: clientEmail.trim(),
    privateKey: privateKey.replace(/\\n/g, '\n').trim(),
  };
}

/** An operator-facing message listing what is missing and where to put it. */
export function missingCredsMessage(creds) {
  const missing = [
    !creds.projectId && 'FIREBASE_PROJECT_ID',
    !creds.clientEmail && 'FIREBASE_CLIENT_EMAIL',
    !creds.privateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean);
  return (
    `✖ Missing ${missing.join(', ')}. Scripts read these from the environment ` +
    'or the repo .env (loaded automatically), and also accept the app-side ' +
    'FIREBASE_ADMIN_* names or one FIREBASE_ADMIN_SERVICE_ACCOUNT JSON blob. ' +
    'See scripts/README.md.'
  );
}
