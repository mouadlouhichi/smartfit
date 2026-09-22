import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/shell';

/**
 * Platform admin — apex-only by construction.
 *
 * On a tenant subdomain the middleware rewrites every path into `/g/{slug}/…`,
 * so `/admin` there simply has no route; on the apex (and in the preview,
 * where no apex is configured) it renders. The gate itself lives in
 * `AdminShell` — client-side for UX, with every `/api/admin/*` route
 * re-verifying the `sfRole` claim server-side as the real boundary.
 */
export const metadata: Metadata = { title: 'Platform admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
