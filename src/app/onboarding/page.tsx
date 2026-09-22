import type { Metadata } from 'next';
import { loadGymPrograms } from '@/lib/tenant-server';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';

/**
 * Onboarding — the server half.
 *
 * The "Your gym" picker offers the gyms that exist on the platform right now
 * (real tenants), so the list has to be loaded per request: a statically
 * prerendered form would bake the tenant list at build time and offer gyms
 * that may have closed since.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Set up SmartFit',
};

export default async function OnboardingPage() {
  const gyms = await loadGymPrograms();
  return <OnboardingForm gyms={gyms} />;
}
