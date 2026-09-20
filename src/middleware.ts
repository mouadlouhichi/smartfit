/**
 * Tenant subdomain resolution.
 *
 * Each gym gets a dedicated subdomain — `acme.smartfit.app`. This middleware is
 * the *only* place a `Host` header becomes a tenant, and it deliberately does
 * **pure string work**: no Firestore, no Admin SDK, nothing async. It runs on
 * the edge runtime where `firebase-admin` cannot load, and it is on the hot
 * path of every request, so an I/O call here would be felt everywhere.
 *
 * Slug → tenant (the actual lookup, and the existence/status check) happens in
 * the `/g/[slug]` page on the Node runtime. Keeping the two apart means no
 * public directory of tenant IDs is ever exposed to a browser.
 *
 * ## Why there is also a `/g/{slug}` path
 *
 * Every host mode rewrites *into* the same `/g/{slug}` route tree, which is
 * directly reachable too. That is what makes the app demonstrable in a preview
 * with no wildcard DNS and no certificate, while production gets real
 * subdomains for free — one route tree, two ways in.
 *
 * See `docs/b2b-pivot-plan.md` §8.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenantHost } from '@smartfit/core/tenant';

/**
 * Apex domains a tenant subdomain may hang off.
 *
 * Read from the environment rather than hard-coded so the same build serves a
 * staging apex and a production one. Comma-separated for the rare deployment
 * that answers on both (e.g. `smartfit.app` plus `smartfit.ma`).
 */
function apexDomains(): string[] {
  return (process.env.NEXT_PUBLIC_APEX_DOMAIN ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^\.+/, ''))
    .filter(Boolean);
}

/**
 * Exact hosts that are never tenants, whatever they look like.
 *
 * This exists because a loose apex makes the base host itself slug-shaped: with
 * apex `e2b.app`, a preview host of `8080-abc123.e2b.app` would resolve to a
 * tenant called `8080-abc123` and render "gym not found" instead of the app.
 */
function baseHosts(): string[] {
  return (process.env.NEXT_PUBLIC_BASE_HOST ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Paths that must never be rewritten into a tenant.
 *
 * `/api` first: an API route rewritten to `/g/acme/api/...` would 404 and take
 * the whole client data layer with it. `/_next` and anything with a file
 * extension are assets, which have no tenant.
 */
function isExempt(pathname: string): boolean {
  if (pathname.startsWith('/api/') || pathname === '/api') return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) return true;
  // A trailing segment containing a dot is a file: /favicon.ico, /manifest.webmanifest.
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  return last.includes('.');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already inside the tenant tree — the page resolves the slug itself.
  if (pathname.startsWith('/g/')) return NextResponse.next();
  if (isExempt(pathname)) return NextResponse.next();

  const apexes = apexDomains();
  // With no apex configured there is nothing to resolve from; the `/g/{slug}`
  // path still works, which is the documented preview mode.
  if (apexes.length === 0) return NextResponse.next();

  const slug = resolveTenantHost(request.headers.get('host'), {
    apexDomains: apexes,
    baseHosts: baseHosts(),
  });
  if (!slug) return NextResponse.next();

  // Rewrite rather than redirect: the visitor keeps `acme.smartfit.app` in the
  // address bar, which is the entire point of a dedicated subdomain. The
  // `x-tenant-slug` header lets server components skip re-parsing the host.
  const url = request.nextUrl.clone();
  url.pathname = `/g/${slug}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set('x-tenant-slug', slug);
  return response;
}

export const config = {
  // Everything except assets and the API. The middleware re-checks internally;
  // the matcher just keeps it off the asset hot path.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
