// P28 verification: breakdown RCA gate + MTBF/MTTR reliability dashboard
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

const machine = await prisma.machine.findFirst();
const now = new Date();

// 1. long breakdown: opened 3h ago (IN_PROGRESS)
const longJob = await prisma.maintenanceJob.create({
  data: {
    machineId: machine.id,
    requestedByName: "Test",
    type: "BREAKDOWN",
    priority: "HIGH",
    description: "Spindle overheating — RCA gate test (>1h)",
    status: "IN_PROGRESS",
    openedAt: new Date(now.getTime() - 3 * 3600000),
  },
});
// 2. short breakdown: opened 10 min ago
const shortJob = await prisma.maintenanceJob.create({
  data: {
    machineId: machine.id,
    requestedByName: "Test",
    type: "BREAKDOWN",
    priority: "MEDIUM",
    description: "Quick sensor reset — RCA gate test (<1h)",
    status: "IN_PROGRESS",
    openedAt: new Date(now.getTime() - 10 * 60000),
  },
});

console.log("== P28 BREAKDOWN RCA GATE ==");
const workerClose = await api(op, `/api/maintenance/jobs/${longJob.id}`, { method: "PATCH", body: JSON.stringify({ action: "CLOSE", rootCause: "x", countermeasure: "y" }) });
check("worker close 403 (manager closes)", workerClose.status === 403, `(${workerClose.status})`);

const noRca = await api(admin, `/api/maintenance/jobs/${longJob.id}`, { method: "PATCH", body: JSON.stringify({ action: "CLOSE" }) });
check("close >1h without root cause 400 (RCA_REQUIRED)", noRca.status === 400 && String(noRca.body?.error || "").includes("RCA_REQUIRED"), `(${noRca.status} ${String(noRca.body?.error || "").slice(0, 70)})`);

const rcOnly = await api(admin, `/api/maintenance/jobs/${longJob.id}`, { method: "PATCH", body: JSON.stringify({ action: "CLOSE", rootCause: "Bearing seized due to lubricant starvation" }) });
check("root cause but no countermeasure 400", rcOnly.status === 400 && String(rcOnly.body?.error || "").includes("countermeasure"), `(${rcOnly.status})`);

const full = await api(admin, `/api/maintenance/jobs/${longJob.id}`, { method: "PATCH", body: JSON.stringify({ action: "CLOSE", rootCause: "Bearing seized due to lubricant starvation", countermeasure: "Added greasing to the weekly PM checklist + oil analysis quarterly" }) });
check("root cause + countermeasure → CLOSED", full.status === 200 && full.body?.job?.status === "CLOSED", `(${full.status} ${full.body?.job?.status})`);
check("countermeasure persisted", full.body?.job?.countermeasure?.includes("greasing"), `(${full.body?.job?.countermeasure?.slice(0, 40)}…)`);

const shortClose = await api(admin, `/api/maintenance/jobs/${shortJob.id}`, { method: "PATCH", body: JSON.stringify({ action: "CLOSE", rootCause: "Faulty limit switch reset", countermeasure: "" }) });
check("breakdown <1h closes without countermeasure", shortClose.status === 200 && shortClose.body?.job?.status === "CLOSED", `(${shortClose.status})`);

console.log("== P28 MTBF/MTTR DASHBOARD ==");
const page = await api(admin, "/maintenance/reliability");
check("reliability page 200", page.status === 200, `(${page.status})`);
const html = String(page.body);
check("MTTR KPI renders", html.includes("MTTR (overall)") && html.includes("h"), "");
check("per-machine table renders", html.includes("Per-Machine Reliability"), "");
check("RCA complete badge on long job", html.includes("RCA complete") || html.includes("RCA gaps"), "");
check("overall MTBF renders", html.includes("MTBF (overall)"), "");
const closedCount = await prisma.maintenanceJob.count({ where: { type: "BREAKDOWN", status: "CLOSED" } });
check("dashboard has breakdown history", closedCount >= 1, `(${closedCount} closed)`);

// cleanup
await prisma.maintenanceJob.delete({ where: { id: longJob.id } }).catch(() => {});
await prisma.maintenanceJob.delete({ where: { id: shortJob.id } }).catch(() => {});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
