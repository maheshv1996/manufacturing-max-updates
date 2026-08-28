// Idempotent one-off: P24–P25 demo data (weekly shift roster with a min-staffing
// day for the leave-guard demo).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { startOfWeek, addDays, format } from "date-fns";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

if (await prisma.shiftRoster.findUnique({ where: { weekStart } })) {
  console.log("Roster already published for this week — skip.");
} else {
  const shifts = await prisma.shift.findMany();
  const morning = shifts.find((s) => s.name.includes("Morning"));
  const afternoon = shifts.find((s) => s.name.includes("Afternoon"));
  const weekend = shifts.find((s) => s.name.includes("Weekend Day"));
  const ops = await prisma.user.findMany({
    where: { role: { name: { in: ["Operator", "OPERATOR"] } } },
    select: { id: true, name: true, employeeNumber: true },
  });
  if (!morning || !afternoon || !weekend || ops.length < 5) {
    console.log("Missing shifts/operators — skip roster seed.");
    process.exit(0);
  }

  const entries = [];
  // Mon/Tue/Thu/Fri: all 5 operators on Morning Shift A
  for (const d of [0, 1, 3, 4]) {
    for (const op of ops) {
      entries.push({ userId: op.id, shiftId: morning.id, date: addDays(weekStart, d) });
    }
  }
  // Wed: 3 on Morning (ops 2,3,4) + exactly 2 on Afternoon (ops 0,1) — the min-staffing guard demo
  for (const op of [ops[2], ops[3], ops[4]]) {
    entries.push({ userId: op.id, shiftId: morning.id, date: addDays(weekStart, 2) });
  }
  entries.push({ userId: ops[0].id, shiftId: afternoon.id, date: addDays(weekStart, 2) });
  entries.push({ userId: ops[1].id, shiftId: afternoon.id, date: addDays(weekStart, 2) });
  // Sat: 2 on Weekend Day
  entries.push({ userId: ops[2].id, shiftId: weekend.id, date: addDays(weekStart, 5) });
  entries.push({ userId: ops[3].id, shiftId: weekend.id, date: addDays(weekStart, 5) });

  const roster = await prisma.shiftRoster.create({
    data: {
      weekStart,
      status: "PUBLISHED",
      publishedBy: "System Admin",
      notes: "Demo roster — Wed afternoon is at minimum staffing (guard demo).",
      entries: { create: entries },
    },
  });
  console.log(`Roster published: week ${format(weekStart, "dd MMM")} — ${roster.entries?.length || entries.length} entries.`);
}

await prisma.$disconnect();
console.log("P24–P25 demo data sync done.");
