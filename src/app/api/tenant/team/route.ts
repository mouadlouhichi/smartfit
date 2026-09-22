import { featureBody, featureResponse, featureUser } from '@/lib/feature-server';
import { changeTeamRole } from '@/lib/team-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  return featureResponse(async () => {
    const actor = await featureUser(req);
    return changeTeamRole(actor, await featureBody(req));
  });
}
