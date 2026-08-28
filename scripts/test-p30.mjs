// P30 verification: quarterly access review + auto-suspend + restore-drill log
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

console.log("== P30 QUARTERLY ACCESS REVIEW ==");
// keep the demo grid mixed: ensure at least one user is UNCERTIFIED in the open cycle
{
  const oc = await prisma.accessReviewCycle.findFirst({ where: { status: "OPEN" } });
  const nonOwner = await prisma.user.findFirst({ where: { isActive: true, isOwner: false } });
  if (oc && nonOwner) {
    await prisma.accessCertification.deleteMany({ where: { cycleId: oc.id, userId: nonOwner.id } });
  }
}
const state = await api(admin, "/api/access-review");
check("GET 200", state.status === 200, `(${state.status})`);
check("open cycle exists", state.body?.cycle?.status === "OPEN", `(${state.body?.cycle?.name})`);
check("rows include certified + uncertified", (state.body?.rows || []).some((r) => r.certified) && (state.body?.rows || []).some((r) => !r.certified), `(${state.body?.totals?.certified}/${state.body?.totals?.users} certified)`);
check("drills seeded", (state.body?.drills || []).length >= 2, `(${state.body?.drills?.length})`);
check("dept titles resolved (Sarah certified depts)", (state.body?.rows || []).find((r) => r.name === "Sarah Jenkins")?.depts?.length > 0, "");

// permissions
const opState = await api(op, "/api/access-review");
check("worker blocked", opState.status === 401 || opState.status === 403, `(${opState.status})`);
const opCert = await api(op, "/api/access-review", { method: "POST", body: JSON.stringify({ action: "certify", userId: (state.body.rows || [])[0]?.userId, depts: ["ops"] }) });
check("worker certify 403", opCert.status === 403, `(${opCert.status})`);

// certify an uncertified user (admin)
const uncert = (state.body?.rows || []).find((r) => !r.certified);
const certify = await api(admin, "/api/access-review", { method: "POST", body: JSON.stringify({ action: "certify", userId: uncert.userId, depts: ["ops", "quality"], notes: "Verified against job description" }) });
check("admin certify 200", certify.status === 200, `(${certify.status})`);
check("certification stored with depts", (certify.body?.certification?.depts || []).includes("quality"), "");
const certBad = await api(admin, "/api/access-review", { method: "POST", body: JSON.stringify({ action: "certify", userId: uncert.userId }) });
check("certify without depts 400", certBad.status === 400, `(${certBad.status})`);
const certOwner = await api(admin, "/api/access-review", { method: "POST", body: JSON.stringify({ action: "certify", userId: (await prisma.user.findFirst({ where: { isOwner: true } })).id, depts: ["ops"] }) });
check("owner certify rejected 400", certOwner.status === 400, `(${certOwner.status})`);

// restore drill
const drill = await api(admin, "/api/access-review", { method: "POST", body: JSON.stringify({ action: "drill", backupName: "mfgmax-test-restore.dump", result: "PASS", durationSec: 61, notes: "Test drill" }) });
check("log drill 201 PASS", drill.status === 201 && drill.body?.drill?.result === "PASS", `(${drill.status})`);
const drillBad = await api(admin, "/api/access-review", { method: "POST", body: JSON.stringify({ action: "drill", backupName: "x", result: "MEH" }) });
check("drill bad result 400", drillBad.status === 400, `(${drillBad.status})`);

console.log("== P30 AUTO-SUSPEND ENFORCEMENT ==");
// certify EVERY active user in BOTH cycles so only a scratch user gets suspended
const users = await prisma.user.findMany({ where: { isActive: true } });
const openCycle = await prisma.accessReviewCycle.findFirst({ where: { status: "OPEN" } });
const past = await prisma.accessReviewCycle.create({ data: { name: "Test Overdue Cycle", periodStart: new Date(Date.now() - 200 * 86400000), dueDate: new Date(Date.now() - 10 * 86400000), status: "OPEN", createdBy: "Test" } });
for (const u of users) {
  if (u.isOwner) continue;
  for (const cid of [openCycle.id, past.id]) {
    await prisma.accessCertification.upsert({
      where: { cycleId_userId: { cycleId: cid, userId: u.id } },
      update: {},
      create: { cycleId: cid, userId: u.id, depts: ["ops"], certifiedBy: "Seed", notes: "pre-test certify all" },
    });
  }
}
// scratch user left uncertified
const srcUser = await prisma.user.findFirst({ where: { employeeNumber: "2002" } });
const scratch = await prisma.user.create({ data: { name: "Uncertified Tester", username: `uncert${Date.now()}`, employeeNumber: `9${Date.now()}`, passwordHash: srcUser.passwordHash, level: "WORKER" } });
const after = await api(admin, "/api/access-review");
const susp = (after.body?.suspended || []).find((s) => s.id === scratch.id);
check("uncertified user auto-suspended", !!susp, "");
const scratchDb = await prisma.user.findUnique({ where: { id: scratch.id } });
check("suspended in DB (isActive=false)", scratchDb?.isActive === false, `(isActive=${scratchDb?.isActive})`);
const auditHit = await prisma.auditLog.count({ where: { action: "ACCESS_SUSPENDED", entityId: scratch.id } });
check("ACCESS_SUSPENDED audited", auditHit >= 1, `(${auditHit})`);
const pastCycle = await prisma.accessReviewCycle.findUnique({ where: { id: past.id } });
check("overdue cycle auto-closed", pastCycle?.status === "CLOSED", `(${pastCycle?.status})`);
const relogin = await login2(scratch.username, "operator123");
check("suspended user login blocked", !relogin, relogin ? "(!)" : "");
// seeded demo users were all certified — none suspended
const seededSusp = (after.body?.suspended || []).filter((s) => s.name !== "Uncertified Tester");
check("seeded users untouched", seededSusp.length === 0, `(${seededSusp.length})`);

// bell shows suspension alert
const bell = await api(admin, "/api/notifications");
check("bell access-review-suspended item", (bell.body?.notifications || []).some((n) => n.id === "access-review-suspended"), "");

// cleanup: delete test artifacts + RE-ACTIVATE any seeded users caught by enforcement
await prisma.accessCertification.deleteMany({ where: { cycleId: past.id } }).catch(() => {});
await prisma.accessReviewCycle.delete({ where: { id: past.id } }).catch(() => {});
await prisma.auditLog.deleteMany({ where: { entityId: scratch.id } }).catch(() => {});
await prisma.user.delete({ where: { id: scratch.id } }).catch(() => {});
await prisma.restoreDrill.delete({ where: { id: drill.body?.drill?.id } }).catch(() => {});
await prisma.user.updateMany({ where: { isActive: false }, data: { isActive: true } }).catch(() => {});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
