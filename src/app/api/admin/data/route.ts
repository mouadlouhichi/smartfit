/**
 * GET /api/admin/data — everything one admin page load needs.
 *
 * One endpoint rather than one per section because the console's sections all
 * read from the same world: suspending a gym changes the registry *and* the
 * KPI band *and* possibly MRR. One response keeps them from disagreeing.
 *
 * The caller's `sfRole` claim is verified before anything is read — this data
 * lives under `platform/**`, which the rules deny to browsers entirely.
 */
import { contractState } from '@/lib/billing/gym-contract';
import {
  json,
  loadAdminRegistry,
  loadApplications,
  loadEffectivePlans,
  loadPlatformInvoices,
  loadRecentAudit,
  requirePlatformAdmin,
} from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services } = auth;

  try {
    // Plans first: the registry's MRR rollup is computed client-side against
    // the same effective tiers, so both must come from this one response.
    const plans = await loadEffectivePlans(services);
    const [gyms, applications, audit, invoices] = await Promise.all([
      loadAdminRegistry(services),
      loadApplications(services),
      loadRecentAudit(services),
      loadPlatformInvoices(services),
    ]);
    // The contract state is derived, never stored: it follows the recorded
    // payments, so the badge cannot disagree with the books.
    const paymentsBySlug = new Map<string, { paidAt: number; amountMinor: number }[]>();
    for (const i of invoices) {
      const list = paymentsBySlug.get(i.slug) ?? [];
      list.push({ paidAt: i.paidAt, amountMinor: i.amountMinor });
      paymentsBySlug.set(i.slug, list);
    }
    const withContract = gyms.map((g) => {
      const payments = paymentsBySlug.get(g.slug) ?? [];
      return {
        ...g,
        contract: contractState(g, payments),
        lastPaymentAt: payments.length > 0 ? Math.max(...payments.map((p) => p.paidAt)) : undefined,
      };
    });
    return json({
      mode: 'cloud',
      gyms: withContract,
      applications,
      audit,
      invoices,
      plans,
    });
  } catch (err) {
    // The underlying message travels to the admin's screen (this endpoint is
    // already claim-gated) and to the function log — "could not be loaded"
    // alone sent operators hunting through Vercel logs for the real cause.
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[admin/data] failed:', detail);
    return json({ error: 'The platform data could not be loaded.', detail }, 500);
  }
}
