import type { GymTenant, GymHours } from '@smartfit/core';

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
      ...gym.branding,
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
