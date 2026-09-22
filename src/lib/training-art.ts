import type { TrainingContent } from '@smartfit/core';
import { safeImageUrl } from './gym-profile';
/** Presentation only: decorative artwork never implies additional exercises or equipment. */
export function trainingArtwork(
  item: Pick<TrainingContent, 'title' | 'kind' | 'muscles' | 'coverUrl'>,
): string {
  const custom = safeImageUrl(item.coverUrl);
  if (custom) return custom;
  const text = `${item.title} ${item.muscles.join(' ')}`.toLowerCase();
  if (/yoga|mobility|stretch|pilates|recovery/.test(text))
    return '/images/branding/studio-cover.webp';
  if (/run|cardio|cycle|aerobic/.test(text)) return '/images/cat-cardio.jpg';
  if (/boxing|combat|martial/.test(text)) return '/images/cat-sports.jpg';
  if (item.kind === 'exercise') return '/images/cat-strength.jpg';
  if (item.kind === 'challenge') return '/images/cat-hiit.jpg';
  return '/images/branding/strength-cover.webp';
}
