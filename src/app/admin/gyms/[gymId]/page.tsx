'use client';

import { useParams } from 'next/navigation';
import { GymDetailSection } from '@/components/admin/sections';

export default function AdminGymDetailPage() {
  const { gymId } = useParams<{ gymId: string }>();
  return <GymDetailSection slug={gymId} />;
}
