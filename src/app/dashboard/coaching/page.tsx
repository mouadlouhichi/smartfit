import { MemberCoaching } from '@/components/features/coaching-workspace';
import Link from 'next/link';
import { isValidSlug } from '@smartfit/core';
export default async function Page({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
  const { gym } = await searchParams;
  return gym && isValidSlug(gym) ? (
    <MemberCoaching slug={gym} />
  ) : (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Your coaching workspace</h1>
      <p className="my-4">Open Coaching from your gym’s page to see your assignment.</p>
      <Link className="underline" href="/gyms">
        Find your gym
      </Link>
    </div>
  );
}
