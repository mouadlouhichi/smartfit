import { test } from 'node:test';
import assert from 'assert/strict';
import { coachTextToPlain, parseCoachText, type CoachSpan } from '../src/lib/coach-text.ts';

/**
 * Model output is rendered as data, never as markup: these tests pin the tiny
 * subset the coach is allowed to use, and that everything else stays literal
 * text.
 */

const flat = (spans: CoachSpan[]) => spans.map((s) => s.text).join('');

function blocks(text: string) {
  return parseCoachText(text);
}

test('blank lines start a new paragraph, single newlines are kept', () => {
  const parsed = blocks('First line.\nSecond line.\n\nNew paragraph.');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].type, 'paragraph');
  assert.equal(flat((parsed[0] as { spans: CoachSpan[] }).spans), 'First line.\nSecond line.');
  assert.equal(flat((parsed[1] as { spans: CoachSpan[] }).spans), 'New paragraph.');
});

test('bullets become a list, whatever marker the model reaches for', () => {
  for (const marker of ['-', '*', '•', '1.', '2)']) {
    const parsed = blocks(`${marker} Easy 5 km\n${marker} Stretch 10 min`);
    assert.equal(parsed.length, 1, marker);
    assert.equal(parsed[0].type, 'list', marker);
    const items = (parsed[0] as { items: CoachSpan[][] }).items;
    assert.deepEqual(items.map(flat), ['Easy 5 km', 'Stretch 10 min'], marker);
  }
});

test('bold, italic and inline code survive as spans', () => {
  const parsed = blocks('Do **5 km** at *easy* pace, then `stretch`.');
  const spans = (parsed[0] as { spans: CoachSpan[] }).spans;
  assert.deepEqual(
    spans.map((s) => [s.text, s.bold ?? false, s.italic ?? false, s.code ?? false]),
    [
      ['Do ', false, false, false],
      ['5 km', true, false, false],
      [' at ', false, false, false],
      ['easy', false, true, false],
      [' pace, then ', false, false, false],
      ['stretch', false, false, true],
      ['.', false, false, false],
    ],
  );
});

test('unmatched markers are left alone instead of eaten', () => {
  const parsed = blocks('2 * 3 = 6, budget ~50**');
  assert.equal(flat((parsed[0] as { spans: CoachSpan[] }).spans), '2 * 3 = 6, budget ~50**');
});

test('headings, quotes and links are flattened to plain words', () => {
  const parsed = blocks('# Today\n> Rest well.\n\nSee [the plan](https://example.com/plan).');
  const text = coachTextToPlain(parsed);
  assert.match(text, /Today/);
  assert.match(text, /Rest well\./);
  assert.match(text, /See the plan\./);
  assert.ok(!text.includes('example.com'));
});

test('anything that looks like markup stays literal text', () => {
  const dangerous = 'Try <script>alert(1)</script> and **<b>bold</b>** ok?';
  const parsed = blocks(dangerous);
  const plain = coachTextToPlain(parsed);
  assert.match(plain, /<script>alert\(1\)<\/script>/);
  const code = (parsed[0] as { spans: CoachSpan[] }).spans.filter((s) => s.code);
  assert.equal(code.length, 0);
  // Markup is never emitted — the renderer builds nodes from these strings.
  assert.ok(!JSON.stringify(parsed).includes('"type":"html"'));
});

test('empty and whitespace-only answers produce nothing to render', () => {
  assert.deepEqual(blocks(''), []);
  assert.deepEqual(blocks('   \n\n  '), []);
});

test('a mixed answer keeps its structure end to end', () => {
  const answer = [
    'Your week is **on track** — 3 of 4 sessions.',
    '',
    'Do this next:',
    '- Easy 5 km today',
    '- Long run on Sunday',
    '',
    'Sleep is the real limiter right now.',
  ].join('\n');
  const parsed = blocks(answer);
  assert.deepEqual(
    parsed.map((b) => b.type),
    ['paragraph', 'paragraph', 'list', 'paragraph'],
  );
  assert.equal(coachTextToPlain(parsed).split('\n\n').length, 4);
});
