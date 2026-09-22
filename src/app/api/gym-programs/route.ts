import { NextResponse } from 'next/server';
import { loadGymProgramsResult } from '@/lib/tenant-server';

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
  const { gyms, error } = await loadGymProgramsResult();
  // Distinguish "no gyms yet" (200, empty list) from "the platform read
  // failed" (503) — the GymPicker shows a retryable message for the latter.
  if (error) {
    return NextResponse.json({ error: 'gyms-unavailable' }, { status: 503 });
  }
  return NextResponse.json({ gyms });
}
