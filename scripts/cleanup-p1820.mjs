// Clean up test-run artifacts: S&OP decisions, capacity windows, auto-created S&OP OT requests.
// Keeps seed demo data (price revisions, idle enquiry, lost quotes) and the follow-up demo.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

const ot = await prisma.overtimeRequest.deleteMany({ where: { reason: { startsWith: "S&OP " } } });
const decisions = await prisma.sopDecision.deleteMany({});
const windows = await prisma.capacityWindow.deleteMany({});
console.log(`Removed OT requests: ${ot.count}, decisions: ${decisions.count}, windows: ${windows.count}`);

await prisma.$disconnect();
console.log("P18–P20 test artifacts cleaned.");
