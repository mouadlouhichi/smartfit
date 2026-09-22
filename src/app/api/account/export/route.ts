import { featureResponse, featureUser } from '@/lib/feature-server';
import { featureAccountRecords } from '@/lib/feature-account-data';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Supplements the member profile's existing full fitness-data export. */
export async function GET(req: Request) {
  return featureResponse(async () => {
    const actor = await featureUser(req);
    const records = await featureAccountRecords(actor.services.db, actor.uid);
    return {
      exportedAt: new Date().toISOString(),
      support: records.tickets.map((d) => d.data()),
      coaching: records.assignments.map((d) => d.data()),
    };
  });
}
