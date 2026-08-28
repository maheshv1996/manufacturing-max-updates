// P26–P27 verification
const BASE = "http://localhost:51888";
async function raw(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  const text = await res.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
async function login2(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
  return res.headers.get("set-cookie")?.split(";")[0];
}
async function api(cookie, path, opts = {}) {
  return raw(path, { ...opts, headers: { Cookie: cookie, ...(opts.headers || {}) } });
}
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const admin = await login2("1001", "factory123");
const op = await login2("2001", "operator123");

let pass = 0, fail = 0;
function check(label, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${label} ${extra}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
}

console.log("== P26 PERMIT-TO-WORK ==");
const list = await api(admin, "/api/permits");
const permits = list.body.permits || [];
const openJobs = list.body.openJobs || [];
console.log("1. GET ->", list.status, `permits=${permits.length} openJobs=${openJobs.length}`);
check("auto-expire: PTW-2026-003 shows EXPIRED", permits.find((p) => p.permitNo === "PTW-2026-003")?.status === "EXPIRED", `(status=${permits.find((p) => p.permitNo === "PTW-2026-003")?.status})`);
check("pending permit exists", permits.some((p) => p.permitNo === "PTW-2026-001" && p.status === "PENDING"));
check("approved valid permit exists", permits.some((p) => p.permitNo === "PTW-2026-002" && p.status === "APPROVED"));

// maintenance START gate FIRST (before any test permit is created on these jobs)
const pendingJobId = permits.find((p) => p.permitNo === "PTW-2026-001")?.maintenanceJob?.id;
const approvedJobId = permits.find((p) => p.permitNo === "PTW-2026-002")?.maintenanceJob?.id;
await prisma.maintenanceJob.update({ where: { id: pendingJobId }, data: { status: "OPEN" } });
await prisma.maintenanceJob.update({ where: { id: approvedJobId }, data: { status: "OPEN" } });
const startBlocked = await api(admin, `/api/maintenance/jobs/${pendingJobId}`, { method: "PATCH", body: JSON.stringify({ action: "START" }) });
check("START blocked while permit PENDING (PERMIT_REQUIRED)", startBlocked.status === 400 && String(startBlocked.body?.error || "").includes("PERMIT_REQUIRED"), `(${startBlocked.status} ${String(startBlocked.body?.error || "").slice(0, 60)})`);
const s = await api(admin, `/api/maintenance/jobs/${approvedJobId}`, { method: "PATCH", body: JSON.stringify({ action: "START" }) });
check("START allowed with valid APPROVED permit", s.status === 200, `(${s.status})`);
if (s.status === 200) {
  await prisma.maintenanceJob.update({ where: { id: approvedJobId }, data: { status: "OPEN" } });
}

// create: worker 403, admin 201 (on a scratch job to not disturb the gate demo)
const scratchJob = await prisma.maintenanceJob.create({ data: { machineId: openJobs[0]?.maintenanceJob?.machine?.id || openJobs[0]?.machine?.id, requestedByName: "Test", type: "BREAKDOWN", priority: "MEDIUM", description: "Scratch job for permit API test", status: "OPEN" } });
const create = await api(op, "/api/permits", { method: "POST", body: JSON.stringify({ maintenanceJobId: scratchJob.id, type: "HOT_WORK", description: "x", location: "y", validUntil: "2099-01-01T00:00" }) });
check("worker create 403", create.status === 403, `(${create.status})`);
const createAdmin = await api(admin, "/api/permits", { method: "POST", body: JSON.stringify({ maintenanceJobId: scratchJob.id, type: "ELECTRICAL", description: "Test permit for gate verification", location: "Bay 3", validUntil: "2099-01-01T00:00" }) });
check("admin create 201", createAdmin.status === 201, `(${createAdmin.status})`);
const gatePermit = createAdmin.body?.permit;

// permission split: a user with ONLY ehs perms must NOT sign the maintenance slot
const srcUser = await prisma.user.findFirst({ where: { employeeNumber: "2001" } });
const ehsOnlyRole = await prisma.role.create({ data: { name: `EHSONLY-${Date.now()}`, description: "test", permissions: ["ehs.view", "ehs.edit"] } });
const ehsOnlyUser = await prisma.user.create({ data: { name: "EHS Only Tester", username: `ehsonly${Date.now()}`, employeeNumber: `9${Date.now()}`, passwordHash: srcUser.passwordHash, roleId: ehsOnlyRole.id, level: "MANAGER" } });
const ehsOnlyCookie = await login2(ehsOnlyUser.username, "operator123");
const wrongSlot = await api(ehsOnlyCookie, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve-maint", reason: "should not be allowed" }) });
check("EHS-only user cannot sign Maintenance slot (403)", wrongSlot.status === 403, `(${wrongSlot.status})`);
const noReason = await api(admin, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve-ehs" }) });
check("approve without reason 400", noReason.status === 400, `(${noReason.status})`);

// sequential approvals → APPROVED on the 3rd
const a1 = await api(admin, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve-ehs", reason: "Hazards assessed" }) });
check("EHS sign 200", a1.status === 200, `(${a1.status})`);
const a2 = await api(admin, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve-maint", reason: "Plan reviewed" }) });
check("Maintenance sign 200", a2.status === 200, `(${a2.status})`);
check("still PENDING after 2 of 3", a2.body?.permit?.status === "PENDING", `(${a2.body?.permit?.status})`);
const a3 = await api(admin, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve-prod", reason: "Line cleared" }) });
check("Production sign → APPROVED", a3.body?.permit?.status === "APPROVED", `(${a3.body?.permit?.status})`);

// duplicate slot blocked
const dup = await api(admin, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve-ehs", reason: "again" }) });
check("duplicate slot 400", dup.status === 400, `(${dup.status})`);


// void flow on the just-approved test permit
const voided = await api(admin, `/api/permits/${gatePermit.id}`, { method: "PATCH", body: JSON.stringify({ action: "VOID", reason: "Work scope cancelled" }) });
check("admin void → VOID", voided.body?.permit?.status === "VOID", `(${voided.body?.permit?.status})`);

console.log("== P27 OBSERVATION QUOTA ==");
const digest = await api(admin, "/api/compliance/digest");
const quotaFlags = (digest.body?.flags || []).filter((f) => f.category === "EHS Observations");
check("digest flags quota section present", quotaFlags.length > 0, `(${quotaFlags.length} flags)`);
if (quotaFlags[0]) console.log("   sample:", quotaFlags[0].label, "|", quotaFlags[0].detail.slice(0, 70));

// cleanup test artifacts
await prisma.permitToWork.delete({ where: { id: gatePermit.id } }).catch(() => {});
await prisma.maintenanceJob.delete({ where: { id: scratchJob.id } }).catch(() => {});
await prisma.user.delete({ where: { id: ehsOnlyUser.id } }).catch(() => {});
await prisma.role.delete({ where: { id: ehsOnlyRole.id } }).catch(() => {});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
