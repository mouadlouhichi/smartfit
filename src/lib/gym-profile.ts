import {
  GYM_AMENITIES,
  weekdayLabel,
  type GymTenant,
  type GymHours,
  type Locale,
  type Translator,
} from '@smartfit/core';

/** Only the public profile: lifecycle, owner, plan and slug are never in this patch. */
export type GymProfile = Pick<GymTenant, 'name' | 'branding' | 'contact' | 'location' | 'hours'>;
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Browser image URLs only. Never pass arbitrary protocols or credentials to an image. */
export function safeImageUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function profileFromGym(gym: GymTenant): GymProfile {
  const hours: GymHours = {};
  for (let day = 0; day < 7; day++) hours[day] = gym.hours?.[day] ? { ...gym.hours[day]! } : null;
  return {
    name: gym.name,
    branding: {
      logoUrl: '',
      coverUrl: '',
      tagline: '',
      description: '',
      accentColor: '#8ad200',
      logoData: '',
      logoShape: 'rounded',
      heroLayout: 'split',
      coverPreset: 'strength',
      coverPosition: 'center',
      ctaLabel: 'See pricing',
      ...gym.branding,
      amenities: [...(gym.branding?.amenities ?? [])],
      galleryUrls: [...(gym.branding?.galleryUrls ?? [])],
    },
    contact: { phone: '', email: '', instagram: '', whatsapp: '', ...gym.contact },
    location: { address: '', city: '', country: '', ...gym.location },
    hours,
  };
}

/**
 * The validation messages, as key + English.
 *
 * `validateGymProfile` is called from the studio (which has a translator) and
 * from tests and non-React callers (which do not), so each sentence carries its
 * English wording next to its catalogue key: no translator means the message
 * reads exactly as it did before, and a translator resolves it per locale.
 */
const MESSAGES = {
  name: { key: 'gym.studio.error.name', en: 'Gym name must be 2–100 characters.' },
  accent: {
    key: 'gym.studio.error.accent',
    en: 'Accent must be a six-digit hex color, such as #8ad200.',
  },
  image: {
    key: 'gym.studio.error.image',
    en: '{field} must be an HTTPS image URL (up to 2048 characters).',
  },
  tagline: { key: 'gym.studio.error.tagline', en: 'Tagline must be at most 160 characters.' },
  description: {
    key: 'gym.studio.error.description',
    en: 'Description must be at most 2000 characters.',
  },
  logoFile: {
    key: 'gym.studio.error.logoFile',
    en: 'Logo file must be a raster image optimized to 32 KB or less.',
  },
  unsupported: { key: 'gym.studio.error.unsupported', en: '{field} is not supported.' },
  ctaLabel: {
    key: 'gym.studio.error.ctaLabel',
    en: 'Button label must be at most 32 characters.',
  },
  amenities: { key: 'gym.studio.error.amenities', en: 'Choose up to eight supported amenities.' },
  gallery: { key: 'gym.studio.error.gallery', en: 'Gallery accepts up to three HTTPS image URLs.' },
  email: { key: 'gym.studio.error.email', en: 'Enter a valid contact email.' },
  contactLength: {
    key: 'gym.studio.error.contactLength',
    en: 'Contact fields must be at most 254 characters.',
  },
  locationLength: {
    key: 'gym.studio.error.locationLength',
    en: '{field} must be at most 200 characters.',
  },
  hours: {
    key: 'gym.studio.error.hours',
    en: '{day}: closing time must be later than opening time (same day).',
  },
} as const;

/** Field names, so `{field}` reads as copy rather than as a bare id. */
const FIELD_EN = {
  logo: 'Logo',
  cover: 'Cover',
  logoShape: 'Logo shape',
  heroLayout: 'Hero layout',
  coverArtwork: 'Cover artwork',
  coverCrop: 'Cover crop',
} as const;

const FIELD_KEYS = {
  logo: 'gym.studio.field.logo',
  cover: 'gym.studio.field.cover',
  logoShape: 'gym.studio.field.logoShape',
  heroLayout: 'gym.studio.field.heroLayout',
  coverArtwork: 'gym.studio.field.coverArtwork',
  coverCrop: 'gym.studio.field.coverCrop',
} as const;

/**
 * Validation, in the reader's language.
 *
 * Every message is a field name plus a rule, so `t` is optional: without one the
 * English fallbacks below produce the same sentences as before the catalogue
 * existed, and with one the studio shows them in the operator's language. The
 * weekday in the opening-hours rule comes from `Intl` through `weekdayLabel`,
 * which takes the app `Locale` — the same argument every other screen passes.
 */
export function validateGymProfile(profile: GymProfile, t?: Translator, locale?: Locale): string[] {
  const errors: string[] = [];
  const say = (
    id: keyof typeof MESSAGES,
    vars: Record<string, string | number> = {},
    field?: keyof typeof FIELD_KEYS,
  ) => {
    const { key, en } = MESSAGES[id];
    const values = field ? { ...vars, field: t ? t(FIELD_KEYS[field]) : FIELD_EN[field] } : vars;
    if (t) {
      errors.push(t(key, values));
      return;
    }
    errors.push(
      Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        en as string,
      ),
    );
  };
  if (profile.name.trim().length < 2 || profile.name.length > 100) say('name');
  if (!/^#[0-9a-f]{6}$/i.test(profile.branding?.accentColor ?? '')) say('accent');
  for (const [field, value] of [
    ['logo', profile.branding?.logoUrl],
    ['cover', profile.branding?.coverUrl],
  ] as const) {
    if (value && (!safeImageUrl(value) || value.length > 2048)) say('image', {}, field);
  }
  if ((profile.branding?.tagline?.length ?? 0) > 160) say('tagline');
  if ((profile.branding?.description?.length ?? 0) > 2000) say('description');
  const brand = profile.branding;
  if (brand?.logoData && !safeLogoData(brand.logoData)) say('logoFile');
  for (const [value, allowed, field] of [
    [brand?.logoShape, ['rounded', 'circle', 'square'], 'logoShape'],
    [brand?.heroLayout, ['split', 'banner', 'minimal'], 'heroLayout'],
    [brand?.coverPreset, ['strength', 'studio', 'combat', 'recovery'], 'coverArtwork'],
    [brand?.coverPosition, ['top', 'center', 'bottom'], 'coverCrop'],
  ] as const)
    if (value && !(allowed as readonly string[]).includes(value)) say('unsupported', {}, field);
  if ((brand?.ctaLabel?.length ?? 0) > 32) say('ctaLabel');
  if (
    brand?.amenities &&
    (brand.amenities.length > 8 ||
      brand.amenities.some((a) => !(GYM_AMENITIES as readonly string[]).includes(a)))
  )
    say('amenities');
  if (
    brand?.galleryUrls &&
    (brand.galleryUrls.length > 3 ||
      brand.galleryUrls.some((url) => !!url && (!safeImageUrl(url) || url.length > 2048)))
  )
    say('gallery');
  if (profile.contact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contact.email))
    say('email');
  for (const value of Object.values(profile.contact ?? {}))
    if (value && value.length > 254) say('contactLength');
  for (const field of ['address', 'city', 'country'] as const)
    if ((profile.location?.[field]?.length ?? 0) > 200)
      say('locationLength', { field: t ? t(`gym.studio.field.${field}`) : field });
  for (let day = 0; day < 7; day++) {
    const h = profile.hours?.[day];
    if (!h) continue;
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close) ||
      h.open >= h.close
    )
      say('hours', { day: weekdayLabel(day, locale, 'long') });
  }
  return errors;
}

/** Only a bounded raster data URL is accepted; never SVG or arbitrary embedded documents. */
export function safeLogoData(value: string | undefined): string | undefined {
  return value &&
    value.length <= 32768 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : undefined;
}

export const GYM_COVERS = [
  { id: 'strength', label: 'Strength club', src: '/images/branding/strength-cover.webp' },
  { id: 'studio', label: 'Mindful studio', src: '/images/branding/studio-cover.webp' },
  { id: 'combat', label: 'Combat & conditioning', src: '/images/cat-sports.jpg' },
  { id: 'recovery', label: 'Move & recover', src: '/images/cat-mobility.jpg' },
] as const;
export function gymCover(branding: GymTenant['branding']) {
  return (
    safeImageUrl(branding?.coverUrl) ??
    GYM_COVERS.find((c) => c.id === branding?.coverPreset)?.src ??
    GYM_COVERS[0].src
  );
}
export function gymLogo(branding: GymTenant['branding']) {
  return safeLogoData(branding?.logoData) ?? safeImageUrl(branding?.logoUrl);
}

/**
 * A short gallery for one gym: the cover, then up to three bundled interiors.
 *
 * A gym that has uploaded photos shows those; a gym that has not still shows
 * more than one image instead of a single stock cover, because "what does this
 * place look like" is the question a directory card exists to answer. The
 * bundled set is keyed by the same cover preset the owner already chose, so a
 * boxing gym gets a fight-floor set rather than a rack of mirrors.
 *
 * Deliberately *not* used by the storefront's `GymGallery`: that section is the
 * gallery the owner published, and padding it with stock art would misrepresent
 * it. These are decorative fills for list/directory surfaces.
 */
const PRESET_GALLERY: Record<string, string[]> = {
  strength: [
    '/images/branding/strength-cover.webp',
    '/images/cat-strength.jpg',
    '/images/cat-cardio.jpg',
  ],
  studio: [
    '/images/branding/studio-cover.webp',
    '/images/cat-mobility.jpg',
    '/images/cat-rest.jpg',
  ],
  combat: ['/images/cat-sports.jpg', '/images/cat-hiit.jpg', '/images/cat-strength.jpg'],
  recovery: [
    '/images/cat-mobility.jpg',
    '/images/cat-rest.jpg',
    '/images/branding/studio-cover.webp',
  ],
};

export function gymGalleryImages(branding: GymTenant['branding'], count = 3): string[] {
  const uploaded = (branding?.galleryUrls ?? []).map(safeImageUrl).filter((s): s is string => !!s);
  const preset = PRESET_GALLERY[branding?.coverPreset ?? 'strength'] ?? PRESET_GALLERY.strength;
  const out: string[] = [];
  for (const src of [gymCover(branding), ...uploaded, ...preset]) {
    if (src && !out.includes(src)) out.push(src);
    if (out.length === count) break;
  }
  return out;
}
