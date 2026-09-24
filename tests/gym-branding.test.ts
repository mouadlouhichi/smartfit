import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GYM_AMENITIES, type GymTenant, validateContent } from '@smartfit/core';
import {
  gymCover,
  gymLogo,
  profileFromGym,
  safeLogoData,
  gymGalleryImages,
  validateGymProfile,
} from '../src/lib/gym-profile';
import { trainingArtwork } from '../src/lib/training-art';
const gym: GymTenant = {
  id: 'test-gym',
  slug: 'test-gym',
  subdomain: 'test-gym',
  name: 'Test Gym',
  ownerUid: 'owner',
  status: 'active',
  tenantPlanId: 'starter',
  createdAt: 1,
  branding: {
    accentColor: '#8ad200',
    amenities: ['Lockers'],
    galleryUrls: ['https://example.com/gym.jpg'],
  },
};

test('branding defaults are backward compatible and nested arrays are independent drafts', () => {
  const profile = profileFromGym(gym);
  assert.deepEqual(validateGymProfile(profile), []);
  assert.equal(profile.branding?.heroLayout, 'split');
  profile.branding?.amenities?.push('Showers');
  profile.branding!.galleryUrls![0] = 'https://example.com/changed.jpg';
  assert.deepEqual(gym.branding?.amenities, ['Lockers']);
  assert.equal(gym.branding?.galleryUrls?.[0], 'https://example.com/gym.jpg');
});
test('small raster logos are supported; scripts, SVG, malformed and oversized data are rejected', () => {
  const raster = 'data:image/webp;base64,UklGRg==';
  assert.equal(safeLogoData(raster), raster);
  for (const value of [
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,PHN2Zz4=',
    'javascript:alert(1)',
    'data:image/png;base64,not base64',
    'data:image/png;base64,' + 'A'.repeat(32768),
  ])
    assert.equal(safeLogoData(value), undefined);
});
test('logo import overrides URL until removed, then falls back to the URL or monogram', () => {
  const logoData = 'data:image/png;base64,iVBORw==';
  const logoUrl = 'https://example.com/logo.png';
  assert.equal(gymLogo({ logoData, logoUrl }), logoData);
  assert.equal(gymLogo({ logoData: '', logoUrl }), logoUrl);
  assert.equal(gymLogo({ logoUrl: 'javascript:alert(1)' }), undefined);
});
test('gym covers resolve custom HTTPS images or only allowlisted bundled art', () => {
  assert.equal(gymCover({ coverPreset: 'studio' }), '/images/branding/studio-cover.webp');
  assert.equal(
    gymCover({ coverUrl: 'https://example.com/cover.png' }),
    'https://example.com/cover.png',
  );
  assert.equal(
    gymCover({ coverUrl: 'javascript:alert(1)' }),
    '/images/branding/strength-cover.webp',
  );
});
test('a gym shows more than one image, and its own photos come first', () => {
  // No branding at all still yields the preset set — a card is never a single
  // stock photo.
  assert.deepEqual(gymGalleryImages(undefined), [
    '/images/branding/strength-cover.webp',
    '/images/cat-strength.jpg',
    '/images/cat-cardio.jpg',
  ]);
  // The preset steers the set: a combat gym gets the fight floor.
  assert.equal(gymGalleryImages({ coverPreset: 'combat' })[0], '/images/cat-sports.jpg');
  // Uploaded photos outrank the bundled ones, after the cover.
  assert.deepEqual(
    gymGalleryImages({
      coverPreset: 'studio',
      galleryUrls: ['https://example.com/one.jpg', 'javascript:alert(1)'],
    }),
    [
      '/images/branding/studio-cover.webp',
      'https://example.com/one.jpg',
      '/images/cat-mobility.jpg',
    ],
  );
  // Never longer than asked, never the same image twice, and never repeating a
  // bundled image to pad the count.
  assert.equal(gymGalleryImages({ coverPreset: 'combat' }, 2).length, 2);
  const all = gymGalleryImages({ coverPreset: 'combat' }, 10);
  assert.equal(all.length, 3);
  assert.equal(new Set(all).size, 3);
});

test('branding validation bounds layout, amenities, gallery and raster data', () => {
  const profile = profileFromGym(gym);
  for (const patch of [
    { logoData: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { heroLayout: 'unknown' },
    { logoShape: 'triangle' },
    { coverPosition: '123' },
    { ctaLabel: 'x'.repeat(33) },
    { amenities: [...GYM_AMENITIES, 'Unknown'] },
    { galleryUrls: ['http://example.com/private.jpg'] },
    { galleryUrls: Array(4).fill('https://example.com/p.jpg') },
  ])
    assert.ok(
      validateGymProfile({
        ...profile,
        branding: { ...profile.branding, ...patch } as typeof profile.branding,
      }).length > 0,
    );
});
test('training artwork is decorative, predictable and uses validated cover URLs', () => {
  const base = { title: 'Mobility flow', kind: 'workout' as const, muscles: [] };
  assert.equal(trainingArtwork(base), '/images/branding/studio-cover.webp');
  assert.equal(
    trainingArtwork({ ...base, coverUrl: 'https://example.com/workout.jpg' }),
    'https://example.com/workout.jpg',
  );
  assert.equal(
    trainingArtwork({ ...base, coverUrl: 'data:text/html,bad' }),
    '/images/branding/studio-cover.webp',
  );
});
test('editorial cover URL is persisted and unsafe schemes/embedded credentials are rejected', () => {
  const draft = {
    kind: 'exercise',
    status: 'draft',
    title: 'Test exercise',
    difficulty: 'beginner',
    durationMin: 20,
    equipment: [],
    muscles: [],
    exercises: [],
    instructions: [],
    description: '',
  };
  assert.equal(
    validateContent({ ...draft, coverUrl: 'https://example.com/photo.jpg' }).coverUrl,
    'https://example.com/photo.jpg',
  );
  for (const coverUrl of [
    'javascript:alert(1)',
    'http://example.com/image.png',
    'https://user:pass@example.com/image.png',
    'data:image/png;base64,abc',
  ])
    assert.throws(() => validateContent({ ...draft, coverUrl }));
});
