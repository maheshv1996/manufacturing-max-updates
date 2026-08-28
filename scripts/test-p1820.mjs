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

console.log("== P18 S&OP LITE ==");
const sop = await api(admin, "/api/sop?weeks=8");
console.log("1. GET ->", sop.status, `weeks=${sop.body.weeks?.length} machines=${sop.body.machines?.length}`);
const wk = sop.body.weeks?.find((w) => w.orderCount > 0) || sop.body.weeks?.[0];
console.log("   sample week:", wk?.label, `load=${wk?.loadPct}% gap=${wk?.gapHours}h orders=${wk?.orderCount}`);

const dOt = await api(admin, "/api/sop", { method: "POST", body: JSON.stringify({ action: "decision", data: { weekStart: wk?.weekStart, decisionType: "OVERTIME", requiredHours: 6, notes: "Test OT decision" } }) });
console.log("2. OT decision ->", dOt.status, dOt.body.decision?.decisionNumber, "outcomes:", dOt.body.decision?.outcome?.length, dOt.body.decision?.outcome?.[0]?.type);
const dOtId = dOt.body.decision?.outcome?.[0]?.refId;

const dShift = await api(admin, "/api/sop", { method: "POST", body: JSON.stringify({ action: "decision", data: { weekStart: wk?.weekStart, decisionType: "EXTRA_SHIFT", requiredHours: 4, notes: "Test extra shift" } }) });
console.log("3. Extra-shift decision ->", dShift.status, "OT requests:", dShift.body.decision?.outcome?.length);

const dOut = await api(admin, "/api/sop", { method: "POST", body: JSON.stringify({ action: "decision", data: { weekStart: wk?.weekStart, decisionType: "OUTSOURCE", requiredHours: 8, machineId: sop.body.machines?.[0]?.id, notes: "Test outsource" } }) });
console.log("4. Outsource decision ->", dOut.status, "outcomes:", dOut.body.decision?.outcome?.length, dOut.body.decision?.outcome?.[0]?.type);

const sop2 = await api(admin, "/api/sop?weeks=8");
console.log("5. Re-GET ->", sop2.status, `decisions=${sop2.body.decisions?.length} windows=${sop2.body.windows?.length}`);

const mWin = await api(admin, "/api/sop", { method: "POST", body: JSON.stringify({ action: "window", data: { machineId: sop.body.machines?.[0]?.id, title: "PM window — spindle check", from: new Date(Date.now() + 86400000).toISOString(), to: new Date(Date.now() + 129600000).toISOString(), hours: 4, reason: "Preventive maintenance" } }) });
console.log("6. Maintenance window ->", mWin.status, mWin.body.window?.windowType);

console.log("\n== P19 PRICE REVISIONS ==");
const pr = await api(admin, "/api/price-revisions");
console.log("7. GET ->", pr.status, `revisions=${pr.body.revisions?.length} dueSoon=${pr.body.dueSoon?.length} products=${pr.body.products?.length}`);
const due0 = pr.body.dueSoon?.[0];
if (due0) console.log("   due:", due0.revisionNumber, due0.product?.sku, `${due0.daysLeft}d left`);
const prod = pr.body.products?.[0];
const cr = await api(admin, "/api/price-revisions", { method: "POST", body: JSON.stringify({ action: "create", data: { productId: prod?.id, newPrice: (prod?.sellingPricePerUnit || 100) * 1.05, effectiveDate: new Date(Date.now() + 60000000).toISOString().slice(0, 10), reason: "Market adjustment" } }) });
console.log("8. Create draft ->", cr.status, cr.body.revision?.revisionNumber, cr.body.revision?.status, `Δ${cr.body.revision?.increasePct}%`);
const crId = cr.body.revision?.id;
const an = await api(admin, "/api/price-revisions", { method: "POST", body: JSON.stringify({ action: "apply-annual", data: { pct: 7, effectiveDate: new Date(Date.now() + 60000000).toISOString().slice(0, 10) } }) });
console.log("9. Apply annual 7% ->", an.status, `drafts=${an.body.count}`);
const wApr = await api(op, "/api/price-revisions", { method: "POST", body: JSON.stringify({ action: "approve", data: { id: crId, reason: "self" } }) });
console.log("10. Worker approve ->", wApr.status, wApr.body.error || "?");
const nR = await api(admin, "/api/price-revisions", { method: "POST", body: JSON.stringify({ action: "approve", data: { id: crId, reason: "Approved per annual price list." } }) });
console.log("11. Manager approve ->", nR.status, nR.body.revision?.status);
const pr2 = await api(admin, "/api/price-revisions");
const updatedProd = pr2.body.products?.find((p) => p.id === prod?.id);
console.log("12. Quote default updated ->", prod?.sellingPricePerUnit, "→", updatedProd?.sellingPricePerUnit);

console.log("\n== P20 FOLLOW-UP CADENCE ==");
const fu = await api(admin, "/api/follow-ups");
console.log("13. GET ->", fu.status, `idle=${fu.body.idle?.length} lostTotal=${fu.body.lostTotal} reasons=${JSON.stringify(fu.body.lostByReason?.map((r) => `${r.reason}:${r.count}`))}`);
const idle0 = fu.body.idle?.[0];
if (idle0) {
  const lg = await api(admin, "/api/follow-ups", { method: "POST", body: JSON.stringify({ action: "log", data: { id: idle0.id, note: "Called customer — revised quote sent, ETA on decision Friday." } }) });
  console.log("14. Log follow-up ->", lg.status, lg.body.quotation?.lastFollowUpAt ? "lastFollowUpAt set" : "NOT SET");
  const fu2 = await api(admin, "/api/follow-ups");
  console.log("15. Idle after follow-up ->", fu2.body.idle?.filter((q) => q.id === idle0.id).length === 0 ? "cleared ✓" : "STILL IDLE");
}
const lost = await api(admin, "/api/follow-ups", { method: "POST", body: JSON.stringify({ action: "mark-lost", data: { id: fu.body.idle?.[0]?.id || idle0?.id, lostReason: "COMPETITOR", note: "Customer chose another vendor." } }) });
console.log("16. Mark lost (COMPETITOR) ->", lost.status, lost.body.quotation?.status, lost.body.quotation?.lostReason);
const wLost = await api(op, "/api/follow-ups", { method: "POST", body: JSON.stringify({ action: "log", data: { id: idle0?.id, note: "worker try" } }) });
console.log("17. Worker log follow-up ->", wLost.status, wLost.body.error || "?");
const fu3 = await api(admin, "/api/follow-ups");
console.log("18. Lost analytics after mark ->", JSON.stringify(fu3.body.lostByReason?.map((r) => `${r.reason}:${r.count}`)));

console.log("\nDONE");
