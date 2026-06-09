/* eslint-disable */
/**
 * Seeds a single-tenant deployment for Gem Aromatics Limited.
 *
 * Creates:
 *   - Organization: Gem Aromatics Limited
 *   - Branch: Mumbai HQ (Vikhroli, MH 400 079)
 *   - Super-admin user (env GEM_ADMIN_EMAIL / GEM_ADMIN_PASSWORD)
 *
 * Usage (from repo root):
 *   DATABASE_URL=... GEM_ADMIN_EMAIL=admin@gemaromatics.in \
 *     GEM_ADMIN_PASSWORD=changeme123 node scripts/seed-gem.js
 */

const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ORG_ID = 'gem-aromatics-org';
const BRANCH_ID = 'gem-mumbai-hq';
const ADMIN_EMAIL = process.env.GEM_ADMIN_EMAIL || 'admin@gemaromatics.in';
const ADMIN_PASSWORD = process.env.GEM_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.GEM_ADMIN_NAME || 'Gem Admin';

if (!ADMIN_PASSWORD) {
  console.error('Set GEM_ADMIN_PASSWORD env var before running.');
  process.exit(1);
}

async function hash(password) {
  // Matches AuthService: bcrypt.hash(password, 10).
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Seeding Gem Aromatics tenant…');

  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: 'Gem Aromatics Limited' },
    create: {
      id: ORG_ID,
      name: 'Gem Aromatics Limited',
    },
  });
  console.log(`  org           ${org.id}`);

  const branch = await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: {
      name: 'Mumbai HQ',
      location: 'Vikhroli (W), Mumbai, MH 400 079',
      organizationId: ORG_ID,
    },
    create: {
      id: BRANCH_ID,
      name: 'Mumbai HQ',
      location: 'Vikhroli (W), Mumbai, MH 400 079',
      organizationId: ORG_ID,
    },
  });
  console.log(`  branch        ${branch.id}`);

  const passwordHash = await hash(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { branchId: BRANCH_ID, role: Role.SUPER_ADMIN, fullName: ADMIN_NAME, isActive: true, passwordHash },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: ADMIN_NAME,
      role: Role.SUPER_ADMIN,
      branchId: BRANCH_ID,
      isActive: true,
    },
  });
  console.log(`  super-admin   ${admin.email}`);

  console.log('\nLogin with:');
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: <whatever you set in GEM_ADMIN_PASSWORD>`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
