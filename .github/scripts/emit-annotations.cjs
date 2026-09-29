#!/usr/bin/env node
/*
 * Emits the contents of a file as GitHub Actions error annotations.
 *
 * Why: GitHub's job-log download endpoint (results-receiver.actions
 * .githubusercontent.com) intermittently returns 503s / EOF, which makes
 * `gh run view --log` useless. Annotations are served from a different API
 * and keep working, so anything we need to read from CI gets echoed here.
 *
 * Usage: node emit-annotations.js <file> [title-prefix] [max-chars]
 *
 * Note: GitHub renders at most 10 error annotations per step, so output is
 * split into at most 10 chunks.
 */
'use strict';

const fs = require('fs');

const file = process.argv[2];
const prefix = process.argv[3] || 'CI-OUT';
const maxChars = parseInt(process.argv[4] || '60000', 10);
const CHUNK = 6000;
const MAX_ANNOTATIONS = 10;

let raw = '';
try {
  raw = fs.readFileSync(file, 'utf8');
} catch (e) {
  raw = `(could not read ${file}: ${e.message})`;
}

// Strip ANSI escapes and carriage returns so the annotation renders cleanly.
const clean = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');

const limit = Math.min(clean.length, maxChars, CHUNK * MAX_ANNOTATIONS);
const parts = [];
for (let i = 0; i < limit; i += CHUNK) {
  parts.push(clean.slice(i, i + CHUNK));
}
if (parts.length === 0) {
  parts.push('(empty)');
}

parts.forEach((chunk, idx) => {
  const escaped = chunk.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=${prefix}-${idx + 1}-of-${parts.length}::${escaped}`);
});
