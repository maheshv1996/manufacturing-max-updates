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
// PG access for ids
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const admin = await login2("1001", "factory123");
const op = await login2("2001", "operator123");

console.log("== P24 SHIFT ROSTER BUILDER ==");
const rs = await api(admin, "/api/roster");
const weekStart = rs.body.weekStart;
console.log("1. GET ->", rs.status, `days=${rs.body.days?.length} totalRostered=${rs.body.totalRostered} minStaffing=${rs.body.minStaffingPerShift}`);
const wed = rs.body.days?.find((d) => d.date.includes(new Date(weekStart).toISOString().slice(0, 10)) === false ? null : d);
const wedAfternoon = rs.body.days?.find((d) => d.label.startsWith("Wed"))?.shifts?.find((s) => s.shiftName.includes("Afternoon"));
console.log("   Wed Afternoon:", wedAfternoon ? `rostered=${wedAfternoon.rostered} min=${wedAfternoon.minStaffing} underMinimum=${wedAfternoon.underMinimum}` : "not found");

// min-staffing guard: leave for Arun Kumar (2005, on Wed Afternoon at exactly min 2) → approve must be BLOCKED
const arun = await prisma.user.findUnique({ where: { employeeNumber: "2005" } });
const wedDate = rs.body.days?.find((d) => d.label.startsWith("Wed"))?.date;
const wedIso = new Date(wedDate + "T00:00:00").toISOString();
const leave = await prisma.leaveRequest.create({
  data: { userId: arun.id, type: "CL", fromDate: wedIso, toDate: wedIso, days: 1, reason: "Guard test — personal work", status: "PENDING" },
});
const wBlock = await api(op, "/api/leaves/" + leave.id, { method: "PATCH", body: JSON.stringify({ status: "APPROVED", note: "manager override" }) });
console.log("2. Worker approve (guard path) ->", wBlock.status, wBlock.body.error || "?");
const blocked = await api(admin, "/api/leaves/" + leave.id, { method: "PATCH", body: JSON.stringify({ status: "APPROVED", note: "Approve after roster check." }) });
console.log("3. Manager approve understaffed day ->", blocked.status, blocked.body?.error?.slice(0, 90) || "APPROVED (unexpected)");

// leave for Alex Vance (2003) on Thu (5 rostered → drops to 4 ≥ 2) → approve must PASS
const alex = await prisma.user.findUnique({ where: { employeeNumber: "2003" } });
const thuDate = rs.body.days?.find((d) => d.label.startsWith("Thu"))?.date;
const leave2 = await prisma.leaveRequest.create({
  data: { userId: alex.id, type: "CL", fromDate: new Date(thuDate + "T00:00:00").toISOString(), toDate: new Date(thuDate + "T00:00:00").toISOString(), days: 1, reason: "Guard test — safe day", status: "PENDING" },
});
const okApprove = await api(admin, "/api/leaves/" + leave2.id, { method: "PATCH", body: JSON.stringify({ status: "APPROVED", note: "Roster stays above minimum." }) });
console.log("4. Manager approve safe day ->", okApprove.status, okApprove.body?.status || okApprove.body?.error);

// operator state exposes own roster on the terminal
const mikeOp = await prisma.user.findUnique({ where: { employeeNumber: "2001" } });
const mach = await prisma.machine.findFirst();
const state = await api(admin, `/api/operator/state?machineId=${mach.id}&operatorId=${mikeOp.id}`);
console.log("5. Operator state myRoster ->", state.status, `entries=${state.body.myRoster?.length}`);
if (state.body.myRoster?.[0]) console.log("   first:", state.body.myRoster[0].day, state.body.myRoster[0].shift?.name);

console.log("\n== P25 LIVE-DATA APPRAISAL ==");
const appr = await api(admin, "/api/appraisals");
console.log("6. GET ->", appr.status, `period=${appr.body.period} rows=${appr.body.rows?.length}`);
const top = appr.body.rows?.[0];
console.log("   top:", top ? `${top.name} eff=${top.efficiencyPct}% qual=${top.qualityPct}% att=${top.attendancePct}% score=${top.score}` : "none");
const wRev = await api(op, "/api/appraisals", { method: "POST", body: JSON.stringify({ action: "review", data: { userId: top?.id, period: appr.body.period, rating: 5, comments: "self" } }) });
console.log("7. Worker review ->", wRev.status, wRev.body.error || "?");
const rev = await api(admin, "/api/appraisals", { method: "POST", body: JSON.stringify({ action: "review", data: { userId: top?.id, period: appr.body.period, rating: 4, comments: "Consistent output, low scrap — keep it up." } }) });
console.log("8. Manager review ->", rev.status, rev.body.appraisal?.status, `rating=${rev.body.appraisal?.managerRating} score=${rev.body.appraisal?.score}`);
const badRating = await api(admin, "/api/appraisals", { method: "POST", body: JSON.stringify({ action: "review", data: { userId: top?.id, period: appr.body.period, rating: 9, comments: "x" } }) });
console.log("9. Invalid rating 9 ->", badRating.status, badRating.body.error || "?");
const appr2 = await api(admin, "/api/appraisals");
const reviewed = appr2.body.rows?.find((r) => r.id === top?.id);
console.log("10. After review ->", reviewed?.stored?.status, reviewed?.stored?.managerComments?.slice(0, 40));

await prisma.$disconnect();
console.log("\nDONE");
