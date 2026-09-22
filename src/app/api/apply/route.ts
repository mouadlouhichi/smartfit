/**
 * POST /api/apply — public "list your gym" intake.
 *
 * An applicant has no account yet — that is the point of applying — so this
 * is the one unauthenticated writer into the platform tree, and it is shaped
 * accordingly: PII-light fields only, strict validation before any write, and
 * a fixed-window rate limit per IP so a stranger cannot farm the queue. The
 * Admin SDK is required (browsers cannot write `platform/**` at all), so a
 * deployment without server credentials answers 503 rather than pretending.
 */
import { getAdminServices } from '@/lib/firebase/admin';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateApplication } from '@/lib/admin-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 5 applications per IP per 10 minutes — a speed bump, not a fortress. */
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) ?? req.headers.get('x-real-ip') ?? 'unknown';
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  if (!limiter.allow(clientKey(req))) {
    return json({ error: 'Too many applications from this address. Try again later.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const result = validateApplication({
    gymName: body.gymName,
    slug: body.slug,
    city: body.city,
    email: body.email,
    instagram: body.instagram,
    message: body.message,
  });
  if (!result.ok) return json({ error: result.errors.join(' ') }, 400);

  try {
    const services = getAdminServices();
    await services.db
      .collection('platform')
      .doc('applications')
      .collection('entries')
      .add({ ...result.value, status: 'pending', createdAt: Date.now() });
    return json({ ok: true });
  } catch (err) {
    console.error('[apply] write failed:', err instanceof Error ? err.message : err);
    return json(
      { error: 'Applications cannot be received on this deployment. Try again later.' },
      503,
    );
  }
}
