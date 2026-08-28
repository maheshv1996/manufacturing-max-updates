// M1–M5 verification: PPC board, finite capacity, tool life, IE observations, hourly andon
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

// ============ M1 — PPC PRIORITY BOARD ============
console.log("== M1 PPC PRIORITY BOARD ==");
const ppc = await api(admin, "/api/ppc");
check("GET /api/ppc 200", ppc.status === 200, `(${ppc.status})`);
const board = ppc.body.board || [];
check("board has open WOs", board.length >= 2, `(${board.length})`);
check("rows carry readiness + dueRisk", board.every((b) => ["READY", "SHORT", "UNKNOWN"].includes(b.readiness) && ["LOW", "MEDIUM", "HIGH", "OVERDUE", "CRITICAL"].includes(b.dueRisk)), "");
check("stats shape", ppc.body.stats && typeof ppc.body.stats.critical === "number", "");
const orderBefore = board.map((b) => b.woNumber);
const reorder = await api(admin, "/api/ppc", { method: "POST", body: JSON.stringify({ orderedIds: [board[1].id, board[0].id] }) });
check("reorder 200 + audit", reorder.status === 200 && Array.isArray(reorder.body.updates), `(${reorder.status})`);
const reorderWorker = await api(op, "/api/ppc", { method: "POST", body: JSON.stringify({ orderedIds: [board[0].id] }) });
check("worker reorder 403", reorderWorker.status === 403, `(${reorderWorker.status})`);
const ppc2 = await api(admin, "/api/ppc");
const after = ppc2.body.board;
const firstId = board[1].id, secondId = board[0].id;
const pFirst = after.find((b) => b.id === firstId)?.priority;
const pSecond = after.find((b) => b.id === secondId)?.priority;
check("priorities persisted (first < second)", pFirst < pSecond, `(${pFirst} < ${pSecond})`);
// restore original order
await api(admin, "/api/ppc", { method: "POST", body: JSON.stringify({ orderedIds: orderBefore.map((n) => board.find((b) => b.woNumber === n).id) }) });
const audit = await prisma.auditLog.findMany({ where: { action: "WO_RESEQUENCED" }, orderBy: { at: "desc" }, take: 1 });
check("WO_RESEQUENCED audited", audit.length === 1, `(by ${audit[0]?.actor})`);

// ============ M2 — FINITE CAPACITY ============
console.log("== M2 FINITE CAPACITY STRIP ==");
const cap = await api(admin, "/api/capacity/finite");
check("GET /api/capacity/finite 200", cap.status === 200, `(${cap.status})`);
check("14-day horizon", (cap.body.days || []).length === 14, `(${cap.body.days?.length})`);
check("grid machines present", (cap.body.grid || []).length >= 1, `(${cap.body.grid?.length})`);
const anyCell = cap.body.grid.some((g) => g.loadPct.some((p) => p > 0));
check("load bars computed", anyCell, "");
check("cells carry WO lists", cap.body.grid.some((g) => g.wos.some((w) => w.length > 0)), "");
check("totals shape", typeof cap.body.totals.overloadedCells === "number", "");
const capWorker = await api(op, "/api/capacity/finite");
check("worker blocked on finite capacity", capWorker.status === 401 || capWorker.status === 403, `(${capWorker.status})`);

// ============ M3 — TOOL ROOM LIFE ============
console.log("== M3 TOOL ROOM LIFE ==");
const tl = await api(admin, "/api/tool-life");
check("GET /api/tool-life 200", tl.status === 200, `(${tl.status})`);
const tools = tl.body.tools || [];
check("tools + stats present", tools.length >= 2 && tl.body.stats.total === tools.length, `(${tools.length})`);
const die = tools.find((t) => t.code === "T-DIE-001");
check("T-DIE-001 effective NEEDS_REGRIND", die?.effective === "NEEDS_REGRIND", `(${die?.effective}, life ${die?.life?.pct}%, regrinds ${die?.life?.regrindsLeft} left)`);
// fresh test tool → full lifecycle
const wos = await prisma.workOrder.findFirst({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } }, orderBy: { priority: "asc" } });
const testTool = await prisma.maintenanceTool.create({
  data: { code: "T-TEST", name: "Test End Mill", kind: "BLADE", ratedLifeUnits: 100, usedUnits: 0, maxRegrinds: 2, regrinds: 0, lifeStatus: "AVAILABLE" },
});
const issue = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "issue", toolId: testTool.id, woNumber: wos.woNumber, costRupees: 350 }) });
check("issue → IN_USE", issue.status === 200 && issue.body.tool.lifeStatus === "IN_USE", `(${issue.status})`);
const woAfter = await prisma.workOrder.findUnique({ where: { id: wos.id }, select: { toolingCostRupees: true } });
check("₹350 posted to job costing", (woAfter.toolingCostRupees || 0) >= 350, `(₹${woAfter.toolingCostRupees})`);
const useMax = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "record-use", toolId: testTool.id, units: 100 }) });
check("100 units → life exhausted → NEEDS_REGRIND", useMax.status === 200 && useMax.body.status === "NEEDS_REGRIND", `(${useMax.body.status})`);
const regrind = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "regrind", toolId: testTool.id, note: "regrind cycle 1" }) });
check("regrind → AVAILABLE, usedUnits reset", regrind.status === 200 && regrind.body.tool.lifeStatus === "AVAILABLE" && regrind.body.tool.usedUnits === 0, "");
const use2 = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "record-use", toolId: testTool.id, units: 60 }) });
const regrind2 = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "regrind", toolId: testTool.id }) });
const use3 = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "record-use", toolId: testTool.id, units: 100 }) });
check("2nd regrind + max → SCRAPPED", use3.status === 200 && use3.body.status === "SCRAPPED", `(${use3.body.status})`);
const issueScrapped = await api(admin, "/api/tool-life", { method: "POST", body: JSON.stringify({ action: "issue", toolId: testTool.id, woNumber: wos.woNumber }) });
check("scrapped tool issue blocked 400", issueScrapped.status === 400, `(${issueScrapped.status})`);
const logs3 = await prisma.toolLifeLog.count({ where: { toolId: testTool.id } });
check("lifecycle logged", logs3 >= 5, `(${logs3} log rows)`);
// cleanup test tool
await prisma.toolLifeLog.deleteMany({ where: { toolId: testTool.id } });
await prisma.maintenanceTool.delete({ where: { id: testTool.id } });

// ============ M4 — IE OBSERVATIONS ============
console.log("== M4 IE OBSERVATIONS ==");
const ie = await api(admin, "/api/lean-observations");
check("GET /api/lean-observations 200", ie.status === 200, `(${ie.status})`);
check("stats carry monthHours + byCategory", typeof ie.body.stats.monthHours === "number" && Object.keys(ie.body.stats.byCategory).length === 7, "");
// a floor user with ops.view (no edit) can log observations; implement needs ops.edit
const src = await prisma.user.findFirst({ where: { employeeNumber: "2001" } });
const viewerRole = await prisma.role.create({ data: { name: `IE Viewer ${Date.now()}`, permissions: ["ops.view"], isSystem: false } });
const viewer = await prisma.user.create({ data: { name: "IE Viewer", username: `iev${Date.now()}`, employeeNumber: `8${Date.now()}`.slice(0, 10), passwordHash: src.passwordHash, roleId: viewerRole.id } });
const viewerCookie = await login2(viewer.employeeNumber, "operator123");
const obs = await api(viewerCookie, "/api/lean-observations", { method: "POST", body: JSON.stringify({ action: "create", title: "Reduce walk to rack by 40%", area: "CNC Bay", category: "MOTION", estMinutesSaved: 12, description: "Move rack next to machine" }) });
check("ops.view user creates observation 201", obs.status === 201, `(${obs.status})`);
const implWorker = await api(viewerCookie, "/api/lean-observations", { method: "POST", body: JSON.stringify({ action: "implement", id: obs.body.observation.id }) });
check("viewer implement 403 (needs ops.edit)", implWorker.status === 403, `(${implWorker.status})`);
const operatorBlocked = await api(op, "/api/lean-observations", { method: "POST", body: JSON.stringify({ action: "create", title: "x", area: "y", category: "MOTION", estMinutesSaved: 5 }) });
check("terminal-only operator blocked 403", operatorBlocked.status === 403, `(${operatorBlocked.status})`);
const implAdmin = await api(admin, "/api/lean-observations", { method: "POST", body: JSON.stringify({ action: "implement", id: obs.body.observation.id }) });
check("admin implement 200", implAdmin.status === 200 && implAdmin.body.observation.status === "IMPLEMENTED", "");
await prisma.leanObservation.delete({ where: { id: obs.body.observation.id } });
await prisma.user.delete({ where: { id: viewer.id } });
await prisma.role.delete({ where: { id: viewerRole.id } });
const badCat = await api(admin, "/api/lean-observations", { method: "POST", body: JSON.stringify({ action: "create", title: "x", area: "y", category: "NOPE", estMinutesSaved: 5 }) });
check("bad category 400", badCat.status === 400, `(${badCat.status})`);

// ============ M5 — HOURLY ANDON ============
console.log("== M5 HOURLY ANDON ==");
const hourly = await api(admin, "/api/andon/hourly");
check("GET /api/andon/hourly 200", hourly.status === 200, `(${hourly.status})`);
check("rows have hourly buckets", (hourly.body.rows || []).every((r) => Array.isArray(r.hours) && r.hours.length >= 1), "");
// seed two short hours on a machine with a live target → flagged
const routed = await prisma.workOrder.findFirst({
  where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, product: { routingSteps: { some: { machineId: { not: null } } } } },
  include: { product: { include: { routingSteps: true } } },
});
const step = routed?.product?.routingSteps?.find((s) => s.machineId);
const mach = step ? await prisma.machine.findUnique({ where: { id: step.machineId } }) : null;
check("found open WO routed to a machine", !!mach && !!routed, `(${mach?.name})`);
const now = new Date();
const h1 = new Date(now); h1.setHours(now.getHours() - 2, 0, 0, 0);
const h2 = new Date(now); h2.setHours(now.getHours() - 1, 0, 0, 0);
const prod1 = await prisma.productionLog.create({ data: { machineId: mach.id, workOrderId: routed.id, startTime: h1, endTime: new Date(h1.getTime() + 1800000), goodQuantity: 1, scrapQuantity: 0, status: "FINALIZED" } });
const prod2 = await prisma.productionLog.create({ data: { machineId: mach.id, workOrderId: routed.id, startTime: h2, endTime: new Date(h2.getTime() + 1800000), goodQuantity: 1, scrapQuantity: 0, status: "FINALIZED" } });
const hourly2 = await api(admin, "/api/andon/hourly");
const flaggedRow = (hourly2.body.rows || []).find((r) => r.machineId === mach.id);
check("machine has a live hourly target", (flaggedRow?.target || 0) > 0, `(target=${flaggedRow?.target}/hr)`);
check("2 short hours → machine flagged", flaggedRow?.flagged === true, `(shortHours=${flaggedRow?.shortHours})`);
check("flagged list populated", (hourly2.body.flagged || []).includes(mach.name), "");
await prisma.productionLog.delete({ where: { id: prod1.id } });
await prisma.productionLog.delete({ where: { id: prod2.id } });
const hourlyWorker = await api(op, "/api/andon/hourly");
check("worker blocked on hourly andon", hourlyWorker.status === 401 || hourlyWorker.status === 403, `(${hourlyWorker.status})`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
