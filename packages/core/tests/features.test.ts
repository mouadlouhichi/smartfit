import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  canAccessTicket,
  canReadCoaching,
  canWriteCoaching,
  coachingRole,
  activeMembership,
  DEFAULT_TRAINING_PREFERENCES,
  generateStarterWeek,
  parseTrainingPreferences,
  parseStateJSON,
  platformHome,
  ticketTransition,
  validateContent,
  validateTicket,
  type ContentDraft,
  type GymMembership,
} from '../src/index';
const draft: ContentDraft = {
  kind: 'workout',
  title: 'Test routine',
  description: 'A beginner routine',
  status: 'published',
  difficulty: 'beginner',
  durationMin: 20,
  equipment: ['bodyweight'],
  muscles: ['legs'],
  instructions: [],
  safetyNotes: 'Stop for pain.',
  videoUrl: '',
  exercises: [{ name: 'Bodyweight Squat', sets: [{ reps: 8 }] }],
  access: 'free',
};
test('specialist roles cannot inherit admin, money or unrestricted gym access', () => {
  for (const role of ['content-manager', 'support-agent', 'gym-trainer'] as const) {
    for (const cap of [
      'gym:create',
      'platform:config',
      'revenue:read',
      'member:roster:read',
      'staff:role:change',
    ] as const)
      assert.equal(can(role, cap), false, `${role} / ${cap}`);
  }
  assert.equal(can('content-manager', 'content:manage'), true);
  assert.equal(can('support-agent', 'content:manage'), false);
  assert.equal(can('content-manager', 'support:manage'), false);
  assert.equal(can('gym-trainer', 'coaching:assign'), false);
});
test('every global specialist has a dedicated home and subscriptions are not roles', () => {
  assert.equal(platformHome('platform-admin'), '/admin');
  assert.equal(platformHome('content-manager'), '/studio');
  assert.equal(platformHome('support-agent'), '/support');
  assert.equal(platformHome('premium'), null);
  assert.equal(platformHome('gym-trainer'), null);
});
test('publishing validates executable routines and preserves copies', () => {
  const item = validateContent(draft);
  assert.deepEqual(item.exercises, draft.exercises);
  assert.notEqual(item.exercises, draft.exercises);
  assert.throws(() => validateContent({ ...draft, exercises: [] }));
  assert.throws(() => validateContent({ ...draft, kind: 'exercise', instructions: [] }));
  assert.throws(() => validateContent({ ...draft, kind: 'challenge' }));
  assert.doesNotThrow(() => validateContent({ ...draft, kind: 'challenge', status: 'draft' }));
});
test('malformed content, unverified premium gates and unsafe video schemes are rejected', () => {
  for (const patch of [
    { kind: 'unknown' },
    { status: 'deleted' },
    { durationMin: NaN },
    { durationMin: 500 },
    { title: 'x' },
    { access: 'premium' },
    { videoUrl: 'javascript:alert(1)' },
    { videoUrl: 'https://user:password@example.com/video' },
    { exercises: [{ name: 'Squat', sets: [{ reps: 0 }] }] },
  ])
    assert.throws(() => validateContent({ ...draft, ...patch }));
  assert.equal(
    validateContent({ ...draft, videoUrl: 'https://example.com/video' }).videoUrl,
    'https://example.com/video',
  );
});
test('support conversations are private to requester and support/admin, never editors or trainers', () => {
  assert.equal(canAccessTicket('a', 'a', 'member'), true);
  assert.equal(canAccessTicket('b', 'a', 'member'), false);
  assert.equal(canAccessTicket('b', 'a', 'content-manager'), false);
  assert.equal(canAccessTicket('b', 'a', 'gym-trainer'), false);
  assert.equal(canAccessTicket('b', 'a', 'support-agent'), true);
  assert.equal(canAccessTicket('b', 'a', 'platform-admin'), true);
});
test('members may close/reopen but cannot impersonate internal ticket workflow', () => {
  assert.equal(ticketTransition('open', 'closed', false), true);
  assert.equal(ticketTransition('closed', 'open', false), true);
  assert.equal(ticketTransition('open', 'in-progress', false), false);
  assert.equal(ticketTransition('open', 'in-progress', true), true);
  assert.equal(ticketTransition('closed', 'in-progress', true), false);
});
test('support content is bounded and validated', () => {
  assert.deepEqual(
    validateTicket({
      category: 'technical',
      subject: ' Help please ',
      message: 'Cannot open my workout.',
    }),
    { category: 'technical', subject: 'Help please', message: 'Cannot open my workout.' },
  );
  for (const value of [
    null,
    { category: 'secrets', subject: 'Help', message: 'Hello world' },
    { category: 'account', subject: 'Help', message: 'x'.repeat(2001) },
  ])
    assert.throws(() => validateTicket(value));
});
const trainer: GymMembership = {
  uid: 'trainer-a',
  role: 'trainer',
  status: 'active',
  joinedAt: 1,
  checkins: 0,
};
test('trainer access is membership-scoped, active and never conferred by a platform claim', () => {
  assert.equal(
    coachingRole('trainer-a', 'member', { ownerUid: 'owner', status: 'active' }, trainer),
    'gym-trainer',
  );
  assert.equal(
    coachingRole('trainer-a', 'gym-trainer', { ownerUid: 'other-owner', status: 'active' }, null),
    null,
  );
  assert.equal(activeMembership({ ...trainer, status: 'cancelled' }), false);
  assert.equal(activeMembership({ ...trainer, expiresAt: 1 }), false);
  assert.equal(
    coachingRole('owner', 'member', { ownerUid: 'owner', status: 'active' }, null),
    null,
  );
});
test('trainers cannot read/write another coach’s assignment and members cannot read peers', () => {
  const assignment = {
    memberUid: 'member-a',
    trainerUid: 'trainer-a',
    consent: 'accepted' as const,
  };
  assert.equal(canReadCoaching('trainer-b', 'gym-trainer', assignment), false);
  assert.equal(canWriteCoaching('trainer-b', 'gym-trainer', assignment), false);
  assert.equal(canReadCoaching('member-b', 'member', assignment), false);
  assert.equal(canReadCoaching('trainer-a', 'gym-trainer', assignment), true);
  assert.equal(canWriteCoaching('member-a', 'member', assignment), true);
  assert.equal(canWriteCoaching('staff', 'gym-staff', assignment), false);
});
test('no one can coach through pending or declined member consent', () => {
  for (const consent of ['pending', 'declined'] as const)
    for (const [uid, role] of [
      ['trainer-a', 'gym-trainer'],
      ['owner', 'gym-owner'],
      ['admin', 'platform-admin'],
      ['member-a', 'member'],
    ] as const)
      assert.equal(
        canWriteCoaching(uid, role, { memberUid: 'member-a', trainerUid: 'trainer-a', consent }),
        false,
      );
});
test('starter generation respects exclusions/equipment, recovery and chosen weekdays', () => {
  const p = {
    ...DEFAULT_TRAINING_PREFERENCES,
    days: [0, 1, 2, 3, 4, 6] as (0 | 1 | 2 | 3 | 4 | 6)[],
    constraints: ['no-floor', 'no-overhead'] as const,
  };
  const result = generateStarterWeek({ ...p, constraints: [...p.constraints] });
  assert.ok(result.schedule.length <= 3);
  for (const s of result.schedule) {
    assert.ok(p.days.includes(s.weekday as 0));
    assert.ok(s.durationMin <= p.minutes);
    for (const e of s.exercises ?? []) assert.ok(!/Dumbbell|Bridge/.test(e.name));
  }
  for (const a of result.schedule)
    for (const b of result.schedule)
      if (a !== b) assert.ok(![1, 6].includes(Math.abs(a.weekday - b.weekday)));
});
test('clearance pauses automatic training without changing user data', () => {
  const prefs = { ...DEFAULT_TRAINING_PREFERENCES, needsClearance: true };
  assert.equal(generateStarterWeek(prefs).schedule.length, 0);
  assert.equal(prefs.needsClearance, true);
});
test('no suitable exercises returns an explicit empty plan, not an unsafe fallback', () => {
  const result = generateStarterWeek({
    ...DEFAULT_TRAINING_PREFERENCES,
    equipment: ['dumbbells'],
    constraints: ['no-overhead'],
  });
  assert.equal(result.schedule.length, 0);
  assert.match(result.explanation.join(' '), /Not enough/);
});
test('personalization parser rejects corrupt values and state remains backwards compatible', () => {
  for (const patch of [
    { days: [] },
    { minutes: 999 },
    { equipment: ['barbell'] },
    { constraints: ['injury-cure'] },
    { needsClearance: 'false' },
    { excludedExercises: ['unknown'] },
  ])
    assert.throws(() => parseTrainingPreferences({ ...DEFAULT_TRAINING_PREFERENCES, ...patch }));
  const state = parseStateJSON(
    JSON.stringify({ profile: { trainingPreferences: DEFAULT_TRAINING_PREFERENCES } }),
  );
  assert.deepEqual(state?.profile.trainingPreferences, DEFAULT_TRAINING_PREFERENCES);
  const corrupt = parseStateJSON(
    JSON.stringify({ profile: { trainingPreferences: { bad: true } } }),
  );
  assert.equal(corrupt?.profile.trainingPreferences, undefined);
});
