import { notFound } from 'next/navigation';
import { loadTenantCached } from '@/lib/tenant-server';
import { CoachingWorkspace } from '@/components/features/coaching-workspace';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await loadTenantCached(slug)).gym) notFound();
  return <CoachingWorkspace slug={slug} />;
}
