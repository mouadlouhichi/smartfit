#!/usr/bin/env node
/*
 * Parses the output of `eas build --no-wait --json` for one or more queued
 * builds and reports them on the GitHub run.
 *
 * Why this is a standalone script rather than an inline `node -e`:
 *  - `--platform all` returns *two* build objects, and the CLI may emit log
 *    lines before the JSON payload (warnings, "Resolved environment", …), so a
 *    naive JSON.parse of the whole file fails.
 *  - Everything a human needs (build links, the raw error when there is one)
 *    has to end up in $GITHUB_STEP_SUMMARY and in annotations, because GitHub's
 *    job-log download endpoint intermittently returns 503s.
 *
 * Usage: node parse-eas-builds.js <eas-output-file> [more-files...]
 *
 * Each platform is built by its own `eas build` invocation, so multiple output
 * files are concatenated and all payloads are merged.
 *
 * Exit code: 0 when at least one build id was found, otherwise 1.
 */
'use strict';

const fs = require('fs');

const outFiles = process.argv.slice(2);
const acct = process.env.EXPO_ACCOUNT || 'mouadlouhichi';
const proj = process.env.EXPO_PROJECT || 'smartfit';
const exitCode = process.env.EAS_EXIT || '?';

let raw = '';
for (const file of outFiles) {
  try {
    const contents = fs.readFileSync(file, 'utf8');
    if (contents.trim()) raw += contents + '\n';
  } catch (e) {
    /* missing output file — the platform never ran */
  }
}

// Drop ANSI colour codes and carriage returns so the rendered output is clean.
const clean = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');

/**
 * Finds every complete JSON value in `text` by tracking bracket depth, so we
 * can recover payloads even when they're surrounded by human-readable logging.
 */
function extractJsonValues(text) {
  const values = [];
  let i = 0;
  while (i < text.length) {
    const first = text[i];
    if (first !== '[' && first !== '{') {
      i++;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end > i) {
      try {
        values.push(JSON.parse(text.slice(i, end + 1)));
      } catch (e) {
        /* not valid JSON — keep scanning */
      }
      i = end + 1;
      continue;
    }
    i++;
  }
  return values;
}

/** Flattens every parsed value into a list of build objects that carry an id. */
function collectBuilds(values) {
  const byId = new Map();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node.id === 'string' && node.id) byId.set(node.id, node);
    if (node.build && typeof node.build === 'object') visit(node.build);
    if (node.builds) visit(node.builds);
  };
  values.forEach(visit);
  return Array.from(byId.values());
}

const builds = collectBuilds(extractJsonValues(clean));

const links = builds.map((b) => {
  const profile = b.buildProfile || b.profile || 'preview';
  const platform = (b.platform || '?').toString().toLowerCase();
  const url = `https://expo.dev/accounts/${acct}/projects/${proj}/builds/${b.id}`;
  return { platform, profile, url, id: b.id, line: `- **${platform}** \`${profile}\` — ${url}` };
});

const projectUrl = `https://expo.dev/accounts/${acct}/projects/${proj}/builds`;

if (links.length) {
  const summary =
    `## EAS builds queued\n\n${links.map((l) => l.line).join('\n')}\n\n` +
    `All builds: ${projectUrl}\n`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `build_ids=${links.map((l) => l.id).join(',')}\n` +
      `build_urls=${links.map((l) => l.url).join(',')}\n`
  );

  links.forEach((l) => {
    console.log(`QUEUED (${l.platform}): ${l.url}`);
    // A notice, not an error, so a successful run never looks failed.
    console.log(`::notice title=EAS-BUILD-QUEUED (${l.platform})::${l.url}`);
  });
  process.exit(0);
}

const tail = clean.slice(-4000) || '(no output)';
fs.appendFileSync(
  process.env.GITHUB_STEP_SUMMARY,
  `## EAS build failed\n\n- \`eas build\` exit code: \`${exitCode}\`\n\n` +
    '```\n' +
    tail +
    '\n```\n'
);
console.log(clean);
process.exit(exitCode === '0' ? 1 : parseInt(exitCode, 10) || 1);
