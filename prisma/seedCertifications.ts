import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log('Seeding certifications...');

  // Fetch some operators
  const operators = await prisma.user.findMany({
    where: { role: { name: 'Operator' } },
    take: 3,
  });

  if (operators.length < 3) {
    console.error('Not enough operators to seed certifications. Please run seed.ts first.');
    return;
  }

  // Fetch machines
  const cnc = await prisma.machine.findFirst({ where: { code: 'CNC-01' } });
  const lathe = await prisma.machine.findFirst({ where: { code: 'IMM-02' } });

  if (!cnc || !lathe) {
    console.error('Machines CNC-01 or IMM-02 not found.');
    return;
  }

  const op1 = operators[0];
  const op2 = operators[1];
  const op3 = operators[2];

  // Operator 1: Certified for CNC-01 (Active)
  await prisma.certification.upsert({
    where: {
      userId_machineId: { userId: op1.id, machineId: cnc.id },
    },
    update: {
      isActive: true,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
    },
    create: {
      userId: op1.id,
      machineId: cnc.id,
      certifiedBy: 'ADMIN',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Operator 2: Certified for LATHE-01 (Active)
  await prisma.certification.upsert({
    where: {
      userId_machineId: { userId: op2.id, machineId: lathe.id },
    },
    update: {
      isActive: true,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      userId: op2.id,
      machineId: lathe.id,
      certifiedBy: 'ADMIN',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Operator 3: Expired certification for CNC-01
  await prisma.certification.upsert({
    where: {
      userId_machineId: { userId: op3.id, machineId: cnc.id },
    },
    update: {
      isActive: true, // Still marked active but validUntil is in the past
      validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
    },
    create: {
      userId: op3.id,
      machineId: cnc.id,
      certifiedBy: 'ADMIN',
      validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Certifications seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
