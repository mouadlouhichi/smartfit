import { GYM_AMENITIES, type GymTenant, type GymHours } from '@smartfit/core';

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

export function validateGymProfile(profile: GymProfile): string[] {
  const errors: string[] = [];
  if (profile.name.trim().length < 2 || profile.name.length > 100)
    errors.push('Gym name must be 2–100 characters.');
  if (!/^#[0-9a-f]{6}$/i.test(profile.branding?.accentColor ?? ''))
    errors.push('Accent must be a six-digit hex color, such as #8ad200.');
  for (const [label, value] of [
    ['Logo', profile.branding?.logoUrl],
    ['Cover', profile.branding?.coverUrl],
  ]) {
    if (value && (!safeImageUrl(value) || value.length > 2048))
      errors.push(`${label} must be an HTTPS image URL (up to 2048 characters).`);
  }
  if ((profile.branding?.tagline?.length ?? 0) > 160)
    errors.push('Tagline must be at most 160 characters.');
  if ((profile.branding?.description?.length ?? 0) > 2000)
    errors.push('Description must be at most 2000 characters.');
  const brand = profile.branding;
  if (brand?.logoData && !safeLogoData(brand.logoData))
    errors.push('Logo file must be a raster image optimized to 32 KB or less.');
  for (const [value, allowed, label] of [
    [brand?.logoShape, ['rounded', 'circle', 'square'], 'Logo shape'],
    [brand?.heroLayout, ['split', 'banner', 'minimal'], 'Hero layout'],
    [brand?.coverPreset, ['strength', 'studio', 'combat', 'recovery'], 'Cover artwork'],
    [brand?.coverPosition, ['top', 'center', 'bottom'], 'Cover crop'],
  ] as const)
    if (value && !(allowed as readonly string[]).includes(value))
      errors.push(`${label} is not supported.`);
  if ((brand?.ctaLabel?.length ?? 0) > 32)
    errors.push('Button label must be at most 32 characters.');
  if (
    brand?.amenities &&
    (brand.amenities.length > 8 ||
      brand.amenities.some((a) => !(GYM_AMENITIES as readonly string[]).includes(a)))
  )
    errors.push('Choose up to eight supported amenities.');
  if (
    brand?.galleryUrls &&
    (brand.galleryUrls.length > 3 ||
      brand.galleryUrls.some((url) => !!url && (!safeImageUrl(url) || url.length > 2048)))
  )
    errors.push('Gallery accepts up to three HTTPS image URLs.');
  if (profile.contact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contact.email))
    errors.push('Enter a valid contact email.');
  for (const value of Object.values(profile.contact ?? {}))
    if (value && value.length > 254) errors.push('Contact fields must be at most 254 characters.');
  for (const key of ['address', 'city', 'country'] as const)
    if ((profile.location?.[key]?.length ?? 0) > 200)
      errors.push(`${key} must be at most 200 characters.`);
  for (let day = 0; day < 7; day++) {
    const h = profile.hours?.[day];
    if (!h) continue;
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close) ||
      h.open >= h.close
    )
      errors.push(`${WEEKDAYS[day]}: closing time must be later than opening time (same day).`);
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
