import type { Metadata } from 'next';
import { isValidSlug } from '@smartfit/core';
import { loadTenantCached } from '@/lib/tenant-server';
import { Storefront } from '@/components/tenant/storefront';

/**
 * Public storefront for one gym.
 *
 * Reachable two ways, deliberately: as `acme.smartfit.app` (middleware rewrites
 * the host into this tree) and as `/g/acme`. One route tree, two doors in —
 * which is what makes the app demonstrable with no wildcard DNS while
 * production gets real subdomains for free.
 *
 * Metadata is generated per tenant from the gym's own branding, so the link
 * preview a gym earns on social media is *theirs* — name, tagline, accent —
 * not SmartFit's.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw ?? '');
  if (!isValidSlug(slug)) {
    return { title: 'Gym not found' };
  }
  const { gym } = await loadTenantCached(slug);
  if (!gym) {
    return { title: 'Gym not found' };
  }
  const description =
    gym.branding?.tagline ??
    gym.branding?.description ??
    `Classes, timetable and memberships at ${gym.name}.`;
  return {
    title: gym.name,
    description,
    openGraph: {
      title: gym.name,
      description,
      type: 'website',
      siteName: 'SmartFit',
    },
  };
}

export default function TenantPage() {
  return <Storefront />;
}
