'use client';

import { TenantProvider, type TenantInitialData } from '@/lib/tenant-context';

/**
 * Client half of the tenant shell.
 *
 * Exists so `app/g/[slug]/layout.tsx` can stay a **server** component: it
 * resolves the tenant with the Admin SDK (the edge middleware cannot) and hands
 * the payload here. Keeping this file tiny means the provider is the only thing
 * that hydrates, and the storefront's content is already in the HTML.
 */
export function TenantShell({
  slug,
  initial,
  children,
}: {
  slug: string;
  initial: TenantInitialData;
  children: React.ReactNode;
}) {
  return (
    <TenantProvider slug={slug} initial={initial}>
      {children}
    </TenantProvider>
  );
}
