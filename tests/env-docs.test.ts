import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Environment documentation must match the code.
 *
 * The env story is easy to get subtly wrong and the failure is invisible: a
 * variable read by the app but missing from `.env.example` is never mentioned
 * to the operator, and a name the README still advertises long after the code
 * moved on is a lie that survives for months (it happened: the README described
 * `NEXT_PUBLIC_AI_*` as *the* coach config after `AI_COACH_*` became the
 * recommended one).
 *
 * Rules:
 *  A. every variable the web app or its scripts read is declared in
 *     `.env.example` (or provided by the platform);
 *  B. every `EXPO_PUBLIC_*` the mobile app reads is declared in
 *     `apps/mobile/.env.example`;
 *  C. every *active* declaration is mentioned by code (a commented one is
 *     reserved for planned work and may go unread);
 *  D/E. every active declaration is in the README table, exactly or via an
 *     explicit `<PREFIX>_*` wildcard row;
 *  F. no live doc mentions a name the code has never heard of.
 */

// `import.meta.url` points at this file, so '.' is the tests/ directory.
const ROOT = join(new URL('.', import.meta.url).pathname, '..');
const WEB_DIRS = ['src', 'scripts'];
const MOBILE_DIRS = ['apps/mobile/src', 'apps/mobile/app'];
const LIVE_DOCS = [
  '.env.example',
  'apps/mobile/.env.example',
  'README.md',
  'docs/billing.md',
  'docs/firebase.md',
  'docs/ops-runbook.md',
];

/** Provided by the platform or by Node — never something an operator sets. */
const PLATFORM_PROVIDED = new Set(['NODE_ENV', 'NEXT_PUBLIC_VERCEL_URL']);

const PREFIX = '(?:NEXT_PUBLIC|EXPO_PUBLIC|AI_COACH|CMI|FIREBASE|SEED|STRIPE)';
/**
 * An env name: a known prefix, then a trailing segment. The trailing
 * `[A-Z0-9]` keeps a markdown wildcard (`NEXT_PUBLIC_AI_*`) from being read as
 * a variable whose name ends in an underscore.
 */
const ENV_NAME = new RegExp(`\\b${PREFIX}_[A-Z0-9_]*[A-Z0-9](?![A-Z0-9_])`, 'g');
/** `process.env.X` or the mobile app's `envObj.X` indirection. */
const ENV_READ = /\b(?:envObj|process\.env)(?:\.|\[['"])([A-Z][A-Z0-9_]+)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

function codeFiles(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) {
    const full = join(ROOT, dir);
    if (existsSync(full)) files.push(...walk(full)); // mobile may be absent in a trimmed checkout
  }
  return files;
}

/** Names the code actually reads, mapped to the first file that reads them. */
function readNames(dirs: string[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of codeFiles(dirs)) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(ENV_READ)) {
      if (!found.has(name)) found.set(name, file.replace(`${ROOT}/`, ''));
    }
  }
  return found;
}

/** Every env-looking name written anywhere in the code, read or not. */
function mentionedInCode(dirs: string[]): Set<string> {
  const found = new Set<string>();
  for (const file of codeFiles(dirs)) {
    for (const [name] of readFileSync(file, 'utf8').matchAll(ENV_NAME)) found.add(name);
  }
  return found;
}

function mentionedIn(text: string): string[] {
  return [...text.matchAll(ENV_NAME)].map(([name]) => name);
}

/**
 * `NAME=` is active, `# NAME=` is reserved (declared for planned work). A
 * trailing comment (`NAME=   # note`) is still a declaration.
 */
function declaredIn(file: string): { active: Set<string>; reserved: Set<string> } {
  const active = new Set<string>();
  const reserved = new Set<string>();
  const text = readFileSync(join(ROOT, file), 'utf8');
  for (const line of text.split('\n')) {
    const activeMatch = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (activeMatch) {
      active.add(activeMatch[1]);
      continue;
    }
    const reservedMatch = /^#\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (reservedMatch) reserved.add(reservedMatch[1]);
  }
  return { active, reserved };
}

const web = declaredIn('.env.example');
const mobile = declaredIn('apps/mobile/.env.example');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const envSection = readme.slice(
  readme.indexOf('## ⚙️ Environment variables'),
  readme.indexOf('## 🗂 Project structure'),
);

/** README rows are an exact name or a `<PREFIX>_*` wildcard covering it. */
function documentedInReadme(name: string): boolean {
  if (envSection.includes(`\`${name}\``)) return true;
  const parts = name.split('_');
  for (let i = parts.length - 1; i >= 1; i--) {
    if (envSection.includes(`\`${parts.slice(0, i).join('_')}_*\``)) return true;
  }
  return false;
}

test('.env.example declares every variable the web app and scripts read', () => {
  const declared = new Set([...web.active, ...web.reserved]);
  const missing = [...readNames(WEB_DIRS)]
    .filter(([name]) => !PLATFORM_PROVIDED.has(name) && !declared.has(name))
    .map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(missing, [], `not declared in .env.example: ${missing.join(', ')}`);
});

test('apps/mobile/.env.example declares every EXPO_PUBLIC variable the app reads', () => {
  const declared = new Set([...mobile.active, ...mobile.reserved]);
  const missing = [...readNames(MOBILE_DIRS)]
    .filter(([name]) => name.startsWith('EXPO_PUBLIC_') && !declared.has(name))
    .map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(missing, [], `not declared in apps/mobile/.env.example: ${missing.join(', ')}`);
});

test('every active declaration is mentioned by the code that should read it', () => {
  const known = new Set([
    ...readNames(WEB_DIRS).keys(),
    ...mentionedInCode(WEB_DIRS),
    ...mentionedInCode(MOBILE_DIRS),
  ]);
  const orphans = [...web.active].filter((name) => !known.has(name));
  assert.deepEqual(orphans, [], `declared but unused: ${orphans.join(', ')}`);
});

test('the README table documents every active variable (or its whole prefix)', () => {
  // Platform-provided names are deliberately not in the table: they are not
  // something a deployment sets, only something it reads.
  const undocumented = [...web.active].filter((name) => !documentedInReadme(name));
  assert.deepEqual(
    undocumented,
    [],
    `missing from the README env table: ${undocumented.join(', ')}`,
  );
});

test('the README covers the mobile variables too', () => {
  const undocumented = [...mobile.active].filter((name) => !documentedInReadme(name));
  assert.deepEqual(
    undocumented,
    [],
    `missing from the README env table: ${undocumented.join(', ')}`,
  );
});

test('live docs never reference a variable the code has never heard of', () => {
  const known = new Set([
    ...web.active,
    ...web.reserved,
    ...mobile.active,
    ...mobile.reserved,
    ...PLATFORM_PROVIDED,
    ...readNames(WEB_DIRS).keys(),
    ...readNames(MOBILE_DIRS).keys(),
    ...mentionedInCode(WEB_DIRS),
    ...mentionedInCode(MOBILE_DIRS),
  ]);
  const stale: string[] = [];
  for (const doc of LIVE_DOCS) {
    for (const name of mentionedIn(readFileSync(join(ROOT, doc), 'utf8'))) {
      if (!known.has(name)) stale.push(`${doc}: ${name}`);
    }
  }
  assert.deepEqual(stale, [], `documented but unknown to the code: ${stale.join(', ')}`);
});

/**
 * The "AI answers" switch was removed (AI is used whenever a provider is
 * configured). Copy is part of the product here: the console, the privacy page
 * and the marketing site must not promise a control that no longer exists.
 */
test('no user-facing copy still advertises the removed AI-answers switch', () => {
  const COPIES = [
    'README.md',
    '.env.example',
    'src/app/privacy/page.tsx',
    'src/components/dashboard/coach-panel.tsx',
    'src/app/dashboard/coach/page.tsx',
  ];
  const offenders: string[] = [];
  for (const file of COPIES) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const phrase of [
      'AI answers switch',
      'AI answers” switch',
      'opt-in switch',
      'Turn the switch off',
    ]) {
      if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the guard itself would notice drift (self-check)', () => {
  // If the regexes stop matching, every rule above passes vacuously — which is
  // exactly how a broken guard behaves. Pin that they still see real names.
  assert.ok(web.active.size >= 15, `only ${web.active.size} declarations parsed`);
  assert.ok(readNames(WEB_DIRS).size >= 15, `only ${readNames(WEB_DIRS).size} reads parsed`);
  assert.ok(mentionedIn('`NEXT_PUBLIC_FIREBASE_API_KEY`').includes('NEXT_PUBLIC_FIREBASE_API_KEY'));
  assert.deepEqual(mentionedIn('`NEXT_PUBLIC_AI_*`'), [], 'a wildcard is not a variable');
});
