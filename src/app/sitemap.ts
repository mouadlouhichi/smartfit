import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { loadTenantCached, listGymsServer } from '@/lib/tenant-server';

/**
 * The sitemap is generated, not hand-listed.
 *
 * It used to be four fixed URLs, which quietly omitted the two things on this
 * site that are actually worth finding in a search result: the gym directory
 * and every gym's own storefront and class pages. Those exist per tenant, so
 * the list has to be read from the tenants.
 *
 * Regenerated hourly — the gym list is a directory, and an index that lags a
 * deploy is worse than one that lags an hour.
 */
export const revalidate = 3600;

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/gyms', changeFrequency: 'daily', priority: 0.8 },
  { path: '/library', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, ...rest }) => ({
    url: `${env.siteUrl}${path === '/' ? '/' : path}`,
    lastModified: now,
    ...rest,
  }));

  // A directory read failure must not take the whole sitemap with it: the
  // static half is still valid, and the operator gets the real error in the log.
  let gyms: Awaited<ReturnType<typeof listGymsServer>> = [];
  try {
    gyms = await listGymsServer();
  } catch (err) {
    console.error('[sitemap] could not list gyms:', err);
    return routes;
  }

  for (const gym of gyms) {
    const lastModified = Number.isFinite(gym.createdAt) ? new Date(gym.createdAt) : now;
    routes.push({
      url: `${env.siteUrl}/g/${gym.slug}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
    });
  }

  // Class pages are the long tail that earns a gym its search traffic ("boxing
  // fundamentals Casablanca"), so they belong in the index. One tenant read per
  // gym, and a gym that fails to load simply contributes no class URLs.
  const classPages = await Promise.all(
    gyms.map(async (gym) => {
      try {
        const { classes } = await loadTenantCached(gym.slug);
        return classes.map((cls) => ({
          url: `${env.siteUrl}/g/${gym.slug}/class/${cls.id}`,
          lastModified: Number.isFinite(cls.createdAt) ? new Date(cls.createdAt) : now,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
      } catch (err) {
        console.error(`[sitemap] could not read classes for ${gym.slug}:`, err);
        return [];
      }
    }),
  );
  routes.push(...classPages.flat());

  return routes;
}
