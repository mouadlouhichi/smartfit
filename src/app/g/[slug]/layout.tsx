import { isValidSlug } from '@smartfit/core';
import { loadTenantServer } from '@/lib/tenant-server';
import { TenantShell } from '@/components/tenant/shell';

/**
 * Tenant shell.
 *
 * A **server** component, deliberately: it resolves the tenant with the Admin
 * SDK — which the edge middleware cannot do — so the storefront's content is in
 * the initial HTML instead of arriving after hydration. For a public shop
 * window that a gym points its Instagram bio at, that difference is the
 * difference between being indexed and not.
 *
 * The slug is validated before it becomes a Firestore lookup. A malformed or
 * reserved one must not reach the database, and must not render a half-broken
 * storefront either.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw ?? '');

  if (!isValidSlug(slug)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-xl font-bold">That gym does not exist</p>
        <p className="text-muted-foreground text-sm">
          The address is not a valid SmartFit gym subdomain. Check the link and try again.
        </p>
      </div>
    );
  }

  const initial = await loadTenantServer(slug);
  return (
    <TenantShell slug={slug} initial={initial}>
      {children}
    </TenantShell>
  );
}
