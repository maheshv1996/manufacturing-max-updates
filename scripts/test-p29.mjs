// P29 verification: program health from WO slippage → bell + exec strip + milestone actions
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

console.log("== P29 PROGRAM HEALTH ==");
const health = await api(admin, "/api/program-health");
check("GET /api/program-health 200", health.status === 200, `(${health.status})`);
const programs = health.body.programs || [];
const aero = programs.find((p) => p.code === "PRJ-2026-AERO");
console.log("1. programs:", programs.map((p) => `${p.code}:${p.risk}(${p.overdueWos.length} overdue/${p.slippedMilestones.length} milestone/${p.openMilestones} open-ms)`).join(" "));
check("aero program HIGH risk", aero?.risk === "HIGH", `(${aero?.risk})`);
check("aero has overdue WOs", (aero?.overdueWos?.length || 0) >= 1, `(${aero?.overdueWos?.length})`);
check("aero has open milestones", (aero?.openMilestones || 0) >= 1, `(${aero?.openMilestones})`);
check("aero salesOwner set", !!aero?.salesOwner, `(${aero?.salesOwner})`);
check("milestone due dates present", (aero?.nextMilestone?.daysLeft ?? -1) >= 0, `(next: ${aero?.nextMilestone?.name} in ${aero?.nextMilestone?.daysLeft}d)`);

// worker can't see program health (middleware 403 or route 401 — blocked either way)
const workerHealth = await api(op, "/api/program-health");
check("worker blocked on program-health", workerHealth.status === 401 || workerHealth.status === 403, `(${workerHealth.status})`);

// /api/projects enriched with health + milestones
const projects = await api(admin, "/api/projects");
const pj = projects.body.projects || [];
check("projects enriched with health", pj.every((p) => p.health), "");
check("projects include milestones", pj.some((p) => (p.milestones || []).length > 0), "");

// milestone actions: add + complete
const target = pj.find((p) => p.code === "PRJ-2026-AERO");
const addMs = await api(admin, `/api/projects/${target.id}`, { method: "PATCH", body: JSON.stringify({ action: "add-milestone", name: "Test Milestone", dueDate: new Date(Date.now() + 5 * 86400000).toISOString() }) });
check("add milestone 200", addMs.status === 200, `(${addMs.status})`);
const msId = addMs.body?.milestone?.id;
const addBad = await api(admin, `/api/projects/${target.id}`, { method: "PATCH", body: JSON.stringify({ action: "add-milestone" }) });
check("add milestone without dueDate 400", addBad.status === 400, `(${addBad.status})`);
const completeMs = await api(admin, `/api/projects/${target.id}`, { method: "PATCH", body: JSON.stringify({ action: "complete-milestone", milestoneId: msId }) });
check("complete milestone → COMPLETED", completeMs.body?.milestone?.status === "COMPLETED", `(${completeMs.body?.milestone?.status})`);
await prisma.projectMilestone.delete({ where: { id: msId } }).catch(() => {});

// bell: sales/projects viewer sees the at-risk bell
const bell = await api(admin, "/api/notifications");
const healthBell = (bell.body?.notifications || []).find((n) => n.id === "program-health");
check("bell has program-health item", !!healthBell, "");
if (healthBell) console.log("   bell:", healthBell.title, "|", healthBell.description.slice(0, 90));
// operator should NOT see the program-health bell
const bellOp = await api(op, "/api/notifications");
check("worker does NOT see program-health bell", !(bellOp.body?.notifications || []).some((n) => n.id === "program-health"), "");

// exec red-strip renders on /command
const cmd = await api(admin, "/command");
const cmdHtml = String(cmd.body);
check("exec red-strip renders", cmdHtml.includes("Program Health —") && (cmdHtml.includes("SLIPPED") || cmdHtml.includes("at risk")), "");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
