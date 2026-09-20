import { Storefront } from '@/components/tenant/storefront';

/**
 * Public storefront for one gym.
 *
 * Reachable two ways, deliberately: as `acme.smartfit.app` (middleware rewrites
 * the host into this tree) and as `/g/acme`. One route tree, two doors in —
 * which is what makes the app demonstrable with no wildcard DNS while
 * production gets real subdomains for free.
 */
export default function TenantPage() {
  return <Storefront />;
}
