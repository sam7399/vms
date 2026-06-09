/* eslint-disable */
/**
 * Destructive: wipes all operational data from the database while
 * preserving the schema. Run before reseeding for a new client deployment.
 *
 * Tables wiped (operational):
 *   ReportExport, ReportTemplate, ReportSchedule,
 *   Alert, IncidentTimelineEntry, Incident,
 *   Attendance, Shift,
 *   MaterialGatePass, Visit, VisitorDocument, Visitor,
 *   FaceEnrollment, Watchlist, Notice,
 *   AuditLog, DeviceToken,
 *   Worker, Contractor,
 *   User, Branch, ParkingSlot, Organization.
 *
 * Order respects FK dependencies (child first, parent last).
 *
 * Usage (from repo root):
 *   DATABASE_URL=... node scripts/clear-demo-data.js --confirm
 *
 * --confirm is mandatory; without it the script prints what it would
 * delete and exits.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// child → parent order
const DELETE_ORDER = [
  'reportExport',
  'reportTemplate',
  'reportSchedule',
  'alert',
  'incidentTimelineEntry',
  'incident',
  'attendance',
  'shift',
  'materialGatePass',
  'visitorDocument',
  'visit',
  'visitor',
  'faceEnrollment',
  'watchlist',
  'notice',
  'auditLog',
  'deviceToken',
  'worker',
  'contractor',
  'user',
  'parkingSlot',
  'branch',
  'organization',
];

async function counts() {
  const out = {};
  for (const model of DELETE_ORDER) {
    if (!prisma[model]?.count) continue;
    try {
      out[model] = await prisma[model].count();
    } catch (e) {
      // model may not exist (rare); ignore
    }
  }
  return out;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  console.log('Counts BEFORE:');
  console.table(await counts());

  if (!confirm) {
    console.log('\nDRY-RUN — pass --confirm to actually delete.');
    return;
  }

  console.log('\nDeleting…');
  for (const model of DELETE_ORDER) {
    if (!prisma[model]?.deleteMany) continue;
    try {
      const { count } = await prisma[model].deleteMany({});
      console.log(`  ${model.padEnd(28)} ${count}`);
    } catch (e) {
      console.warn(`  ${model.padEnd(28)} SKIPPED (${e.message?.slice(0, 80)})`);
    }
  }

  console.log('\nCounts AFTER:');
  console.table(await counts());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
