import { NextResponse } from 'next/server';
import { loadGymPrograms } from '@/lib/tenant-server';

/**
 * The live gym list for signed-in member surfaces (Plan tab's "Your gym"
 * picker). Same loader as the onboarding page — every live tenant folded
 * into the suggested-week program shape.
 *
 * Unauthenticated reads are fine: this is the same public data the `/gyms`
 * directory and every storefront render. Nothing personal is included; the
 * member's own selection lives in their profile, client-side.
 */
export async function GET() {
  try {
    const gyms = await loadGymPrograms();
    return NextResponse.json({ gyms });
  } catch (err) {
    // loadGymPrograms degrades to [] on its own; this is belt-and-braces so
    // a surprise never surfaces as an unhandled 500 HTML page.
    console.error('[api/gym-programs]:', err);
    return NextResponse.json({ error: 'gyms-unavailable' }, { status: 503 });
  }
}
