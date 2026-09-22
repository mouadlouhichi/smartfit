import {
  auditGymAccess,
  isMembershipDocumentId,
  type AccessAuditMember,
  type AccessAuditFinding,
} from '../../packages/core/src/index';

export class PreflightConfigError extends Error {}

export interface PreflightOptions {
  projectId: string;
  gym?: string;
  maxGyms: number;
  maxMembers: number;
  json: boolean;
  adc: boolean;
}
export function parsePreflightArgs(args: string[]): PreflightOptions {
  const options: PreflightOptions = {
    projectId: '',
    maxGyms: 100,
    maxMembers: 2000,
    json: false,
    adc: false,
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--json') {
      options.json = true;
      continue;
    }
    if (flag === '--adc') {
      options.adc = true;
      continue;
    }
    if (!['--project', '--gym', '--max-gyms', '--max-members'].includes(flag))
      throw new PreflightConfigError(`Unknown option: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--'))
      throw new PreflightConfigError(`Missing value for ${flag}`);
    if (flag === '--project') {
      if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(value))
        throw new PreflightConfigError('Invalid project ID.');
      options.projectId = value;
    } else if (flag === '--gym') {
      if (!isMembershipDocumentId(value))
        throw new PreflightConfigError('Invalid gym document ID.');
      options.gym = value;
    } else {
      const n = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(n) ||
        n < 1 ||
        n > (flag === '--max-gyms' ? 1000 : 10000)
      )
        throw new PreflightConfigError(`Invalid limit for ${flag}`);
      if (flag === '--max-gyms') options.maxGyms = n;
      else options.maxMembers = n;
    }
  }
  if (!options.projectId)
    throw new PreflightConfigError(
      'An explicit --project is required. No default project is selected.',
    );
  return options;
}
export function requireLocalEmulator(host: string | undefined): string {
  if (!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/.test(host))
    throw new PreflightConfigError('A loopback emulator host with a port is required.');
  const port = Number(host.slice(host.lastIndexOf(':') + 1));
  if (port < 1 || port > 65535) throw new PreflightConfigError('Invalid emulator port.');
  return host;
}
export function validatePreflightTarget(
  options: PreflightOptions,
  config: { credentialProject?: string; publicProject?: string; emulatorHost?: string },
) {
  if (config.emulatorHost) {
    requireLocalEmulator(config.emulatorHost);
    if (!options.projectId.startsWith('demo-'))
      throw new PreflightConfigError('Emulator audits require a demo- project ID.');
    return;
  }
  if (options.projectId.startsWith('demo-'))
    throw new PreflightConfigError('A demo- project requires FIRESTORE_EMULATOR_HOST.');
  for (const value of [config.credentialProject, config.publicProject])
    if (value && value !== options.projectId)
      throw new PreflightConfigError(
        'Selected project does not match the configured Firebase project.',
      );
}
type PageReader = (after: string | undefined, limit: number) => Promise<AccessAuditMember[]>;
export interface PreflightReader {
  gyms: PageReader;
  members: (gym: string, after: string | undefined, limit: number) => Promise<AccessAuditMember[]>;
  gym: (id: string) => Promise<AccessAuditMember | null>;
}
export interface PreflightReport {
  projectId: string;
  asOf: string;
  readOnly: true;
  complete: boolean;
  gymsScanned: number;
  membersScanned: number;
  findings: AccessAuditFinding[];
  errors: string[];
}
async function collect(read: PageReader, max: number) {
  const rows: AccessAuditMember[] = [];
  let cursor: string | undefined;
  while (rows.length <= max) {
    const page = await read(cursor, Math.min(200, max + 1 - rows.length));
    if (!page.length) return { rows, complete: true };
    for (const row of page) {
      if (cursor !== undefined && Buffer.compare(Buffer.from(row.id), Buffer.from(cursor)) <= 0)
        throw new Error('Invalid page ordering.');
      rows.push(row);
      cursor = row.id;
    }
    if (rows.length > max) return { rows: rows.slice(0, max), complete: false };
  }
  return { rows, complete: false };
}
/** Injected adapter deliberately exposes reads only. Any partial scan exits non-successfully. */
export async function runTeamPreflight(
  options: PreflightOptions,
  reader: PreflightReader,
  now = Date.now(),
): Promise<PreflightReport> {
  const report: PreflightReport = {
    projectId: options.projectId,
    asOf: new Date(now).toISOString(),
    readOnly: true,
    complete: true,
    gymsScanned: 0,
    membersScanned: 0,
    findings: [],
    errors: [],
  };
  const fail = (code: string) => {
    report.complete = false;
    report.errors.push(code);
  };
  let gyms: AccessAuditMember[];
  try {
    if (options.gym) {
      const gym = await reader.gym(options.gym);
      gyms = gym ? [gym] : [];
      if (!gym) fail('gym-not-found');
    } else {
      const scan = await collect(reader.gyms, options.maxGyms);
      gyms = scan.rows;
      if (!scan.complete) fail('gym-limit-reached');
    }
  } catch {
    fail('gym-read-failed');
    return report;
  }
  for (const gym of gyms) {
    try {
      const scan = await collect(
        (after, limit) => reader.members(gym.id, after, limit),
        options.maxMembers,
      );
      report.gymsScanned++;
      report.membersScanned += scan.rows.length;
      report.findings.push(
        ...auditGymAccess(gym.id, gym.data, scan.rows, { now, complete: scan.complete }),
      );
      if (!scan.complete) fail(`member-limit-reached:${gym.id}`);
      if (report.findings.length >= 10000) {
        report.findings = report.findings.slice(0, 10000);
        fail('finding-limit-reached');
        break;
      }
    } catch {
      fail(`member-read-failed:${gym.id}`);
    }
  }
  return report;
}
export function preflightExitCode(report: PreflightReport) {
  return !report.complete ? 2 : report.findings.some((f) => f.severity === 'error') ? 1 : 0;
}
