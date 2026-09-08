/**
 * Category id → generated art tile in `/public/images`.
 * Custom categories (and unknown ids) fall back to `null` and render the
 * coloured icon chip instead.
 */
const CATEGORY_ART: Record<string, string> = {
  'cat-strength': '/images/cat-strength.jpg',
  'cat-cardio': '/images/cat-cardio.jpg',
  'cat-hiit': '/images/cat-hiit.jpg',
  'cat-mobility': '/images/cat-mobility.jpg',
  'cat-sports': '/images/cat-sports.jpg',
  'cat-rest': '/images/cat-rest.jpg',
};

export function categoryArt(categoryId: string): string | null {
  return CATEGORY_ART[categoryId] ?? null;
}
