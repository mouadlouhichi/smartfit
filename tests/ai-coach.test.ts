import { test } from 'node:test';
import assert from 'assert/strict';
import {
  aiCoachEnabled,
  aiHost,
  askAiCoach,
  buildCoachContext,
  completionsUrl,
  CoachAiError,
  type AiCoachConfig,
} from '../src/lib/ai-coach.ts';
import { emptyState, toISODate, type FitnessState } from '@smartfit/core';

/**
 * The AI coach is strictly opt-in and must degrade gracefully: nothing is
 * sent anywhere unless an endpoint is configured AND the athlete flips the
 * switch; any provider failure must throw CoachAiError so the UI can fall
 * back to the on-device engine.
 */

const CFG: AiCoachConfig = {
  endpoint: 'https://ai.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
};

function athlete(): FitnessState {
  const s = emptyState();
  s.profile.name = 'Sam Athlete';
  s.profile.onboardingDone = true;
  s.profile.distanceUnit = 'km';
  s.profile.weightUnit = 'kg';
  const today = toISODate(new Date());
  s.sessions.push({
    id: 'ses-1',
    date: today,
    categoryId: 'cat-strength',
    title: 'Push day',
    durationMin: 45,
    intensity: 'moderate',
    calories: 320,
    distanceKm: 2.5,
    exercises: [],
    createdAt: Date.now(),
  });
  s.goals.push({
    id: 'goal-1',
    name: 'Train this week',
    metric: 'workouts',
    cadence: 'weekly',
    target: 4,
    startDate: today,
    createdAt: Date.now(),
  });
  s.bodyLogs.push({
    id: 'body-1',
    date: today,
    unit: 'weight',
    value: 80,
    createdAt: Date.now(),
  });
  return s;
}

function mockFetch(reply: unknown, ok = true, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok, status, json: async () => reply } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('AI stays disabled unless a plausible endpoint is configured', () => {
  assert.equal(aiCoachEnabled({ endpoint: '', apiKey: '', model: '' }), false);
  assert.equal(aiCoachEnabled({ endpoint: 'not a url', apiKey: '', model: '' }), false);
  assert.equal(aiCoachEnabled(CFG), true);
  assert.equal(aiCoachEnabled({ ...CFG, apiKey: '' }), true); // keyless endpoints are fine
  assert.equal(aiHost(CFG), 'ai.example.com');
  assert.equal(aiHost({ endpoint: '', apiKey: '', model: '' }), '');
});

test('completionsUrl normalises OpenAI-compatible endpoints', () => {
  assert.equal(completionsUrl(CFG), 'https://ai.example.com/v1/chat/completions');
  assert.equal(
    completionsUrl({ ...CFG, endpoint: 'https://x.dev/openai/chat/completions/' }),
    'https://x.dev/openai/chat/completions',
  );
});

test('askAiCoach posts the question + context and trims the answer', async () => {
  const { impl, calls } = mockFetch({
    choices: [{ message: { content: '  Rest and stretch.  ' } }],
  });
  const answer = await askAiCoach('What should I do today?', athlete(), {
    cfg: CFG,
    fetchImpl: impl,
  });
  assert.equal(answer, 'Rest and stretch.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://ai.example.com/v1/chat/completions');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer test-key');
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.model, 'test-model');
  assert.equal(body.messages[1].role, 'user');
  assert.equal(body.messages[1].content, 'What should I do today?');
  const system: string = body.messages[0].content;
  assert.match(system, /SmartFit Coach/);
  assert.match(system, /Current streak/);
  assert.match(system, /Push day/);
});

test('askAiCoach refuses to run without configuration', async () => {
  await assert.rejects(
    () => askAiCoach('hi', athlete(), { cfg: { endpoint: '', apiKey: '', model: '' } }),
    CoachAiError,
  );
});

test('askAiCoach surfaces provider failures as CoachAiError', async () => {
  const down = mockFetch({}, false, 503);
  await assert.rejects(
    () => askAiCoach('hi', athlete(), { cfg: CFG, fetchImpl: down.impl }),
    /AI request failed \(503\)/,
  );
  const empty = mockFetch({ choices: [{ message: { content: '   ' } }] });
  await assert.rejects(
    () => askAiCoach('hi', athlete(), { cfg: CFG, fetchImpl: empty.impl }),
    /empty/i,
  );
});

test('the context is a summary — never raw records or identity', () => {
  const ctx = buildCoachContext(athlete());
  assert.match(ctx, /Plan: /);
  assert.match(ctx, /This week so far: 1 workout, 45 min, 320 kcal, 2\.5 km\./);
  assert.match(ctx, /"Train this week"/);
  assert.match(ctx, /Latest weight: 80 kg/);
  // The athlete's name and any record ids never leave the device.
  assert.ok(!ctx.includes('Sam Athlete'));
  assert.ok(!ctx.includes('ses-1'));
  assert.ok(!ctx.includes('goal-1'));
  assert.ok(!ctx.includes('body-1'));
});
