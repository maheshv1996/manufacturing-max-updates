const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get an operator and an admin
  const users = await prisma.user.findMany({ take: 2 });
  if (users.length < 2) {
    console.log("Not enough users to seed leaves");
    return;
  }

  const operator = users[0];
  const admin = users[1];

  const now = new Date();
  
  // 1. Pending Leave (Next week)
  const from1 = new Date();
  from1.setDate(now.getDate() + 7);
  const to1 = new Date();
  to1.setDate(now.getDate() + 8);
  
  // 2. Approved Leave (Today!)
  const from2 = new Date();
  const to2 = new Date();
  
  // 3. Rejected Leave (Past)
  const from3 = new Date();
  from3.setDate(now.getDate() - 10);
  const to3 = new Date();
  to3.setDate(now.getDate() - 9);

  await prisma.leaveRequest.create({
    data: {
      userId: operator.id,
      type: "CL",
      fromDate: from1,
      toDate: to1,
      days: 2,
      reason: "Family function",
      status: "PENDING",
    }
  });

  await prisma.leaveRequest.create({
    data: {
      userId: operator.id,
      type: "SL",
      fromDate: from2,
      toDate: to2,
      days: 1,
      reason: "Fever and cold",
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(),
      note: "Take care",
    }
  });

  await prisma.leaveRequest.create({
    data: {
      userId: operator.id,
      type: "PL",
      fromDate: from3,
      toDate: to3,
      days: 2,
      reason: "Vacation",
      status: "REJECTED",
      approvedById: admin.id,
      approvedAt: new Date(),
      note: "Too many pending orders",
    }
  });

  console.log("Seeded 3 leave requests.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
