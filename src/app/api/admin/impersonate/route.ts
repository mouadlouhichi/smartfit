/**
 * POST /api/admin/impersonate — audit that a view-as session started.
 *
 * View-as-gym is read-only *by construction* (the tenant provider refuses
 * every mutation while it is active), so this route has no state to change:
 * its entire job is the audit entry. An impersonation that is not in the log
 * is a support session nobody can account for, so the entry is written
 * before the banner renders.
 */
import { appendPlatformAudit, json, requirePlatformAdmin } from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid } = auth;

  let body: { slug?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug) return json({ error: 'A gym slug is required.' }, 400);

  // The gym need not be checked for existence here: nothing is disclosed and
  // nothing changes. The audit entry names whatever was attempted.
  await appendPlatformAudit(services, uid, 'gym:view-as', slug, { mode: 'read-only' });
  return json({ ok: true });
}
