import type { GymSlot } from './firebase/tenant-repo';
export const GYM_FOCUS_LABELS: Record<string, string> = {
  combat: 'Combat',
  hiit: 'HIIT',
  strength: 'Strength',
  cardio: 'Cardio',
  mind: 'Mind & recovery',
  aqua: 'Aqua',
};
export function classArtwork(focus: string): string {
  return focus === 'mind'
    ? '/images/branding/studio-cover.webp'
    : focus === 'combat'
      ? '/images/cat-sports.jpg'
      : focus === 'cardio' || focus === 'aqua'
        ? '/images/cat-cardio.jpg'
        : focus === 'hiit'
          ? '/images/cat-hiit.jpg'
          : '/images/branding/strength-cover.webp';
}
/** Sort before limiting so unsorted snapshots cannot hide the nearest class. */
export function upcomingStorefrontSlots(slots: GymSlot[], now = Date.now(), limit = 50): GymSlot[] {
  return slots
    .filter((slot) => !slot.cancelled && slot.startsAt >= now)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, limit);
}
export function groupByDay(slots: GymSlot[]): { label: string; slots: GymSlot[] }[] {
  const days = new Map<string, GymSlot[]>();
  for (const slot of [...slots].sort((a, b) => a.startsAt - b.startsAt)) {
    const key = new Date(slot.startsAt).toDateString();
    const rows = days.get(key) ?? [];
    rows.push(slot);
    days.set(key, rows);
  }
  return [...days].map(([label, slots]) => ({ label, slots }));
}
/** Build URLs from known schemes, never accept a stored arbitrary href. */
export function gymContactHref(
  kind: 'phone' | 'email' | 'whatsapp' | 'instagram',
  value: string,
): string | null {
  if (kind === 'email')
    return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value)
      ? `mailto:${encodeURIComponent(value)}`
      : null;
  if (kind === 'instagram') {
    const handle = value.trim().replace(/^@/, '');
    return /^[\w.]{1,30}$/.test(handle)
      ? `https://www.instagram.com/${encodeURIComponent(handle)}/`
      : null;
  }
  const digits = value.replace(/[\s()+.\-]/g, '');
  if (!/^\d{6,15}$/.test(digits)) return null;
  return kind === 'whatsapp'
    ? `https://wa.me/${digits}`
    : `tel:${value.trim().startsWith('+') ? '+' : ''}${digits}`;
}
