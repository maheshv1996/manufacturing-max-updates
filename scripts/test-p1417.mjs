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

console.log("== P14 BUYER BOARD ==");
const bb = await api(admin, "/api/buyer-board");
console.log("1. GET ->", bb.status, `reqs=${bb.body.requisitions?.length} users=${bb.body.users?.length} overduePo=${bb.body.stats?.overduePo}`);
const cr = await api(admin, "/api/buyer-board", { method: "POST", body: JSON.stringify({ action: "create", data: { title: "Milling inserts for CNC-01", itemName: "Carbide inserts", qty: 50, unit: "pcs", estimatedCost: 25000, urgency: "URGENT" } }) });
console.log("2. Create ->", cr.status, cr.body.requisition?.reqNumber, cr.body.requisition?.urgency);
const reqId = cr.body.requisition?.id;
const buyer = bb.body.users?.[0];
const wAssign = await api(op, "/api/buyer-board", { method: "POST", body: JSON.stringify({ action: "assign", data: { id: reqId, buyerId: buyer?.id, reason: "self" } }) });
console.log("3. Worker assign ->", wAssign.status, wAssign.body.error || "?");
const asg = await api(admin, "/api/buyer-board", { method: "POST", body: JSON.stringify({ action: "assign", data: { id: reqId, buyerId: buyer?.id, reason: "Purchasing lead allocation." } }) });
console.log("4. Assign ->", asg.status, asg.body.requisition?.status, "→", asg.body.requisition?.assignedByName);
const fu = await api(admin, "/api/buyer-board", { method: "POST", body: JSON.stringify({ action: "followUp", data: { id: reqId, note: "Chased supplier — ETA Friday." } }) });
console.log("5. Follow-up ->", fu.status, fu.body.followUp?.note);
const po = await api(admin, "/api/buyer-board", { method: "POST", body: JSON.stringify({ action: "issuePo", data: { id: reqId, poNumber: "PO-2026-999", reason: "PO released to supplier." } }) });
console.log("6. Issue PO ->", po.status, po.body.requisition?.status, po.body.requisition?.poNumber);

console.log("\n== P15 CYCLE COUNT ==");
const cc = await api(admin, "/api/cycle-count");
console.log("7. GET ->", cc.status, `materials=${cc.body.materials?.length} thresholds=${JSON.stringify(cc.body.stats?.threshold)}`);
const start = await api(admin, "/api/cycle-count", { method: "POST", body: JSON.stringify({ action: "start", data: { abcClass: "A" } }) });
console.log("8. Start A-class ->", start.status, start.body.session?.sessionNumber, `lines=${start.body.session?.lines?.length}`);
const sess = start.body.session;
if (sess) {
  // count one line with a big variance — the highest-stock item, counted 20% lower
  const biggest = [...sess.lines].sort((a, b) => b.systemQty - a.systemQty)[0];
  const rec = await api(admin, "/api/cycle-count", { method: "POST", body: JSON.stringify({ action: "record", data: { sessionId: sess.id, values: sess.lines.map((l) => ({ lineId: l.id, countedQty: l.id === biggest.id ? Math.round(l.systemQty * 0.8) : l.systemQty })) } }) });
  console.log("9. Record counts (line", biggest.id.slice(0, 6), "system", biggest.systemQty, "→", Math.round(biggest.systemQty * 0.8), ") ->", rec.status);
  const sub = await api(admin, "/api/cycle-count", { method: "POST", body: JSON.stringify({ action: "submit", data: { sessionId: sess.id } }) });
  console.log("10. Submit ->", sub.status, sub.body.session?.status, "over-threshold:", sub.body.overThreshold?.length);
  const wAppr = await api(op, "/api/cycle-count", { method: "POST", body: JSON.stringify({ action: "approve", data: { id: sess.id, reason: "self" } }) });
  console.log("11. Worker approve ->", wAppr.status, wAppr.body.error || "?");
  const appr = await api(admin, "/api/cycle-count", { method: "POST", body: JSON.stringify({ action: "approve", data: { id: sess.id, reason: "Variance within tolerance for bookkeeping — adjust stock." } }) });
  console.log("12. Finance approve ->", appr.status, appr.body.session?.status, "| by:", appr.body.session?.approvedBy);
}

console.log("\n== P16 MATERIAL ISSUE ==");
const mi = await api(admin, "/api/material-issue");
console.log("13. GET ->", mi.status, `slips=${mi.body.slips?.length} wos=${mi.body.readiness?.length}`);
const readyWo = mi.body.readiness?.find((w) => w.rows?.length > 0 && w.rows[0].stock > 0);
if (readyWo) {
  const row = readyWo.rows[0];
  const issue = await api(admin, "/api/material-issue", { method: "POST", body: JSON.stringify({ workOrderId: readyWo.id, rawMaterialId: row.rawMaterialId, qty: Math.min(10, row.stock), batchNo: "HT-2608-B", heatNo: "H-7781", issuedTo: "Mike Ross" }) });
  console.log("14. Issue ->", issue.status, issue.body.slip?.issueNumber, "| ref:", issue.body.slip?.reference);
  const overIssue = await api(admin, "/api/material-issue", { method: "POST", body: JSON.stringify({ workOrderId: readyWo.id, rawMaterialId: row.rawMaterialId, qty: 999999 }) });
  console.log("15. Over-issue ->", overIssue.status, overIssue.body.error?.slice(0, 60) || "?");
}

console.log("\n== P17 GATE PASS ==");
const gp = await api(admin, "/api/gate-pass");
console.log("16. GET ->", gp.status, `dispatchable=${gp.body.dispatchableWos?.length} dispatches=${gp.body.dispatches?.length}`);
const wo = gp.body.dispatchableWos?.[0];
// incomplete → blocked
const blocked = await api(admin, "/api/gate-pass", { method: "POST", body: JSON.stringify({ workOrderId: wo?.id, dispatchedQty: 5, vehicleNumber: "", driverName: "", ewayBillNo: "" }) });
console.log("17. Incomplete dispatch ->", blocked.status, blocked.body.code, "| missing:", blocked.body.missing?.join(","));
if (wo) {
  const ok2 = await api(admin, "/api/gate-pass", { method: "POST", body: JSON.stringify({ workOrderId: wo.id, dispatchedQty: Math.min(5, wo.plannedQuantity), carrierName: "FastTrack Logistics", vehicleNumber: "MH-12-AB-3456", driverName: "Ramesh Yadav", ewayBillNo: "351012345678" }) });
  console.log("18. Complete dispatch ->", ok2.status, ok2.body.dispatch?.gatePassNumber, "|", ok2.body.dispatch?.challanNumber);
  const print = await api(admin, `/reports/gate-pass/${ok2.body.dispatch?.id}`);
  console.log("19. Printable gate pass ->", print.status, print.body.includes("Gate Pass") ? "renders" : "ERR");
} else {
  console.log("SKIP 17-19 (no COMPLETED WO for dispatch)");
}
console.log("\nDONE");
