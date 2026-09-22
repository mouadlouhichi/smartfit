#!/usr/bin/env node
/** Read-only. Run with: node --import tsx scripts/audit-team-access.ts --project PROJECT */
import { initializeApp, applicationDefault, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldPath, type Query } from 'firebase-admin/firestore';
import { scriptCreds } from './lib/load-env.mjs';
import {
  PreflightConfigError,
  parsePreflightArgs,
  validatePreflightTarget,
  runTeamPreflight,
  preflightExitCode,
} from './lib/team-preflight';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'Read-only team access audit. No accounts, roles or data are modified.\nUsage: pnpm audit:team --project PROJECT [--gym SLUG] [--json] [--adc] [--max-gyms 100] [--max-members 2000]\nExit: 0 complete/no errors, 1 findings block release, 2 invalid configuration or incomplete scan.\nReports contain document identifiers. Store them securely outside Git.',
  );
} else {
  let app: ReturnType<typeof initializeApp> | undefined;
  try {
    const options = parsePreflightArgs(args);
    const creds = scriptCreds();
    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
    validatePreflightTarget(options, {
      credentialProject: creds.projectId,
      publicProject: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      emulatorHost,
    });
    if (
      !emulatorHost &&
      !options.adc &&
      (!creds.clientEmail || !creds.privateKey || !creds.projectId)
    )
      throw new PreflightConfigError(
        'Configure matching Firebase Admin credentials, or explicitly use --adc.',
      );
    if (!emulatorHost && options.adc && (creds.clientEmail || creds.privateKey))
      throw new PreflightConfigError(
        'Remove service-account credential fields before selecting --adc.',
      );
    app = initializeApp(
      {
        projectId: options.projectId,
        ...(!emulatorHost
          ? {
              credential: options.adc
                ? applicationDefault()
                : cert({ ...creds, projectId: options.projectId }),
            }
          : {}),
      },
      'team-preflight',
    );
    const db = getFirestore(app);
    const page = async (query: Query, after: string | undefined, limit: number) => {
      let selected = query.orderBy(FieldPath.documentId()).limit(limit);
      if (after) selected = selected.startAfter(after);
      return (await selected.get()).docs.map((d) => ({ id: d.id, data: d.data() }));
    };
    const report = await runTeamPreflight(options, {
      gyms: (after, limit) =>
        page(db.collection('gyms').select('ownerUid', 'status'), after, limit),
      gym: async (id) => {
        const doc = await db.doc(`gyms/${id}`).get();
        return doc.exists ? { id: doc.id, data: doc.data()! } : null;
      },
      members: (gym, after, limit) =>
        page(
          db.collection(`gyms/${gym}/members`).select('uid', 'role', 'status', 'expiresAt'),
          after,
          limit,
        ),
    });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `Read-only audit: ${report.projectId} at ${report.asOf}\nScanned ${report.gymsScanned} gyms and ${report.membersScanned} memberships. Complete: ${report.complete}`,
      );
      for (const finding of report.findings)
        console.log(
          `${finding.severity.toUpperCase()} ${finding.code}: ${JSON.stringify(`${finding.gymId}${finding.memberId ? `/members/${finding.memberId}` : ''}`)}`,
        );
      for (const error of report.errors) console.log(`INCOMPLETE ${JSON.stringify(error)}`);
      console.log(
        'No data modified. This scan is not a transactionally consistent snapshot or a production-readiness certificate.',
      );
    }
    process.exitCode = preflightExitCode(report);
  } catch (error) {
    // Admin/transport errors can contain sensitive metadata. Do not dump their objects or stacks.
    const known =
      error instanceof PreflightConfigError
        ? error.message
        : 'Unable to initialize the read-only audit. Check credential configuration.';
    console.error(known);
    process.exitCode = 2;
  } finally {
    if (app) await deleteApp(app);
  }
}
