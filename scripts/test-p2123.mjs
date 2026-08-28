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

const admin = await login2("1001", "factory123");
const op = await login2("2001", "operator123");

console.log("== P21 COST-CENTER OWNERSHIP ==");
const cc = await api(admin, "/api/cost-centers?dept=maintenance");
console.log("1. Maintenance cost center ->", cc.status, `rows=${cc.body.rows?.length}`);
const row = cc.body.rows?.[0];
console.log("   burn:", row ? `${row.category} ${row.spent}/${row.allocated} = ${row.burnPct}% overrun=${row.overrun}` : "N/A");
const ccAll = await api(admin, "/api/cost-centers");
console.log("2. All depts ->", ccAll.status, `summary=${ccAll.body.summary?.length} depts, overruns=${ccAll.body.summary?.filter((s) => s.overrun).length}`);
const cr = await api(admin, "/api/cost-centers", { method: "POST", body: JSON.stringify({ action: "create", data: { fiscalYear: "FY27", department: "Engineering", category: "Software", allocated: 500000, notes: "CAD licences" } }) });
console.log("3. Create budget line ->", cr.status, cr.body.line?.category);

console.log("\n== P22 COLLECTIONS ==");
const col = await api(admin, "/api/collections");
console.log("4. GET ->", col.status, `accounts=${col.body.accounts?.length} buckets=${JSON.stringify(col.body.buckets?.map((b) => `${b.key}:${b.count}`))} total=₹${col.body.totalOutstanding}`);
const acct3 = col.body.accounts?.find((a) => a.invoiceNumber === "INV-2026-003");
console.log("   INV-2026-003:", acct3 ? `bucket=${acct3.bucket} days=${acct3.days} dunning=L${acct3.account?.dunningLevel} collector=${acct3.account?.collector?.name || "none"}` : "missing");
const collector = col.body.collectors?.find((c) => c.name.includes("Alex")) || col.body.collectors?.[0];
const acct1 = col.body.accounts?.find((a) => a.invoiceNumber === "INV-2026-001");
const wAssign = await api(op, "/api/collections", { method: "POST", body: JSON.stringify({ action: "assign", data: { id: acct1?.id, collectorId: collector?.id, reason: "self" } }) });
console.log("5. Worker assign ->", wAssign.status, wAssign.body.error || "?");
const asg = await api(admin, "/api/collections", { method: "POST", body: JSON.stringify({ action: "assign", data: { id: acct1?.id, collectorId: collector?.id, reason: "Allocated to collector for follow-up." } }) });
console.log("6. Assign ->", asg.status, asg.body.account ? "collector set" : asg.body.error);
const fu = await api(admin, "/api/collections", { method: "POST", body: JSON.stringify({ action: "log-followup", data: { id: acct1?.id, note: "Called customer — cheque in transit." } }) });
console.log("7. Follow-up ->", fu.status, fu.body.account?.followUps?.length, "entries");
const dun1 = await api(admin, "/api/collections", { method: "POST", body: JSON.stringify({ action: "dunning", data: { id: acct3?.id, level: 2 } }) });
console.log("8. Dunning L2 (was L1) ->", dun1.status, `L${dun1.body.account?.dunningLevel}`);
const dunSkip = await api(admin, "/api/collections", { method: "POST", body: JSON.stringify({ action: "dunning", data: { id: acct3?.id, level: 3 } }) });
console.log("9. Skip to L3 ->", dunSkip.status, dunSkip.body.error || "?");

console.log("\n== P23 PAYROLL APPROVAL CHAIN ==");
const pay = await api(admin, "/api/payroll");
console.log("10. GET ->", pay.status, `runs=${pay.body.runs?.length} ${pay.body.runs?.[0]?.month}:${pay.body.runs?.[0]?.status}`);
const month = pay.body.runs?.[0]?.month || "2026-08";
const expBefore = await api(admin, `/api/payroll/export?month=${month}`);
console.log("11. Export while DRAFT ->", expBefore.status, expBefore.body?.error?.slice(0, 60) || "CSV returned (unexpected)");
const wAppr = await api(op, "/api/payroll", { method: "POST", body: JSON.stringify({ entity: "", action: "approve-run", data: { month, reason: "self" } }) });
console.log("12. Worker approve ->", wAppr.status, wAppr.body.error || "?");
const noReason = await api(admin, "/api/payroll", { method: "POST", body: JSON.stringify({ entity: "", action: "approve-run", data: { month } }) });
console.log("13. Approve no reason ->", noReason.status, noReason.body.error || "?");
const appr = await api(admin, "/api/payroll", { method: "POST", body: JSON.stringify({ entity: "", action: "approve-run", data: { month, reason: "Variance check done — approve." } }) });
console.log("14. Manager approve ->", appr.status, appr.body.run?.status, "by", appr.body.run?.approvedBy);
const lockBefore = await api(admin, "/api/payroll", { method: "POST", body: JSON.stringify({ entity: "", action: "lock-run", data: { month, reason: "lock" } }) });
console.log("15. Lock directly from APPROVED ->", lockBefore.status, lockBefore.body.run?.status);
const expApproved = await api(admin, `/api/payroll/export?month=${month}`);
console.log("16. Export while APPROVED ->", expApproved.status, expApproved.body?.error?.slice(0, 60) || "CSV returned (unexpected)");
const slip = pay.body.payslips?.find((p) => p.month === month);
const lock = await api(admin, "/api/payroll", { method: "POST", body: JSON.stringify({ entity: "", action: "lock-run", data: { month, reason: "Salary committee signed off — lock." } }) });
console.log("17. Lock ->", lock.status, lock.body.run?.status);
const expAfter = await api(admin, `/api/payroll/export?month=${month}`);
console.log("18. Export while LOCKED ->", expAfter.status, expAfter.body?.error ? expAfter.body.error.slice(0, 60) : "CSV streamed ✓");
const ovr = await api(admin, "/api/payroll", { method: "POST", body: JSON.stringify({ entity: "", action: "override-payslip", data: { payslipId: slip?.id, month, reason: "Corrected arrears for July increment.", fields: { netPay: (slip?.netPay || 0) + 5000 } } }) });
console.log("19. Post-lock override ->", ovr.status, ovr.body.payslip?.netPay, "(was", slip?.netPay + ")");
const pay2 = await api(admin, "/api/payroll");
const run2 = pay2.body.runs?.find((r) => r.month === month);
console.log("20. Run corrections ->", run2?.corrections?.length, "recorded");

console.log("\nDONE");
