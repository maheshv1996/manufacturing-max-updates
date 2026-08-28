// M6–M9 verification: IQC AQL, FQC dispatch gate, complaint SLA, QMS doc control
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

let pass = 0, fail = 0;
function check(label, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${label} ${extra}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
}

// ============ M6 — IQC AQL ============
console.log("== M6 IQC AQL ==");
const grnData = await api(admin, "/api/grn");
check("GET /api/grn 200", grnData.status === 200, `(${grnData.status})`);
const aqlPlans = grnData.body.aqlPlans || [];
check("AQL plans A/B/C present", ["A", "B", "C"].every((c) => aqlPlans.some((p) => p.materialClass === c)), `(${aqlPlans.map((p) => p.materialClass).join(",")})`);
check("rawMaterials carry materialClass", (grnData.body.rawMaterials || []).some((r) => ["A", "B", "C"].includes(r.materialClass)), "");

let pending = (grnData.body.grns || []).find((g) => g.inspectionStatus === "PENDING");
// the previous run may have consumed the only pending GRN — reset one so the flow is re-testable
if (!pending) {
  const anyGrn = await prisma.goodsReceiptNote.findFirst({ orderBy: { receivedAt: "desc" } });
  if (anyGrn) {
    if (anyGrn.ncrId) await prisma.ncrReport.delete({ where: { id: anyGrn.ncrId } }).catch(() => {});
    await prisma.goodsReceiptNote.update({ where: { id: anyGrn.id }, data: { inspectionStatus: "PENDING", lotHeld: false, ncrId: null, aqlSampleSize: null } });
    pending = await prisma.goodsReceiptNote.findUnique({ where: { id: anyGrn.id }, include: { rawMaterial: { select: { materialClass: true } }, supplier: true } });
  }
}
check("a pending GRN exists to inspect", !!pending, `(${pending?.grnNumber})`);
if (pending) {
  const aqlFor = aqlPlans.find((p) => p.materialClass === (pending.rawMaterial?.materialClass || "C"));
  const rej = await api(admin, "/api/grn", { method: "POST", body: JSON.stringify({ entity: "inspect", data: { id: pending.id, inspectionStatus: "REJECTED", notes: "test reject" } }) });
  check("REJECT → 200 + lot held", rej.status === 200 && rej.body.item?.lotHeld === true, `(status ${rej.status}, held=${rej.body.item?.lotHeld})`);
  check("AQL sample recorded", rej.body.item?.aqlSampleSize === (aqlFor?.sampleSize ?? null), `(sample ${rej.body.item?.aqlSampleSize}, plan ${aqlFor?.sampleSize})`);
  check("supplier NCR auto-drafted", !!rej.body.item?.ncrId, "");
  const ncr = await prisma.ncrReport.findUnique({ where: { id: rej.body.item.ncrId } });
  check("NCR is supplier + GRN-linked", ncr?.ncrNumber?.startsWith("NCR-SUP-") && ncr.supplierId === pending.supplierId && ncr.grnId === pending.id, `(${ncr?.ncrNumber})`);
  const heldAudit = await prisma.auditLog.count({ where: { action: "GRN_INSPECTED", details: { contains: "LOT HELD" } } });
  check("GRN_HELD audit trail", heldAudit >= 1, "");
  const ncrAudit = await prisma.auditLog.count({ where: { action: "NCR_RAISED" } });
  check("NCR_RAISED audited", ncrAudit >= 1, "");
}
const badPlan = await api(admin, "/api/grn", { method: "POST", body: JSON.stringify({ entity: "aql-plan", data: { materialClass: "X", sampleSize: 5, acceptanceNumber: 0, rejectionNumber: 1 } }) });
check("invalid class 400", badPlan.status === 400, `(${badPlan.status})`);
const badAcRe = await api(admin, "/api/grn", { method: "POST", body: JSON.stringify({ entity: "aql-plan", data: { materialClass: "B", sampleSize: 5, acceptanceNumber: 3, rejectionNumber: 2 } }) });
check("Re > Ac enforced 400", badAcRe.status === 400, `(${badAcRe.status})`);

// ============ M7 — FQC DISPATCH CHECKLIST ============
console.log("== M7 FQC DISPATCH CHECKLIST ==");
const fqc = await api(admin, "/api/fqc");
check("GET /api/fqc 200", fqc.status === 200, `(${fqc.status})`);
const seedWo = await prisma.workOrder.findFirst({ where: { status: "COMPLETED", fqcChecklist: { isNot: null } }, include: { dataPackages: true } });
check("seeded complete checklist exists", !!seedWo, "");
const releasedDp = (seedWo?.dataPackages || []).some((d) => d.status === "RELEASED");
check("seeded WO has released data package", releasedDp, "");
// blocked path: a COMPLETED WO without a checklist
const bareWo = await prisma.workOrder.findFirst({ where: { status: "COMPLETED", fqcChecklist: { is: null } }, include: { dataPackages: true } });
if (bareWo) {
  const blocked = await api(admin, "/api/gate-pass", { method: "POST", body: JSON.stringify({ workOrderId: bareWo.id, dispatchedQty: 10, carrierName: "Test", vehicleNumber: "KA01AB1234", driverName: "Test Driver", ewayBillNo: "EWB123" }) });
  check("dispatch blocked without FQC checklist", blocked.status === 400 && blocked.body.code === "FQC_CHECKLIST_INCOMPLETE", `(${blocked.status} ${blocked.body.code || ""})`);
}
// success path: complete checklist + released DP → gate pass issues
if (seedWo) {
  const ok = await api(admin, "/api/gate-pass", { method: "POST", body: JSON.stringify({ workOrderId: seedWo.id, dispatchedQty: 10, carrierName: "Aero Freight", vehicleNumber: "KA01AB9999", driverName: "Ramesh", ewayBillNo: "EWB-778899" }) });
  check("dispatch allowed with complete FQC + DP", ok.status === 201 && ok.body.dispatch?.gatePassNumber, `(${ok.status} ${ok.body.dispatch?.gatePassNumber || ""})`);
  if (ok.body.dispatch) await prisma.dispatchRecord.delete({ where: { id: ok.body.dispatch.id } }).catch(() => {});
}
// partial checklist stays blocked (doc pack unticked)
if (seedWo) {
  await prisma.fqcChecklist.update({ where: { workOrderId: seedWo.id }, data: { docPackDone: false } });
  const partial = await api(admin, "/api/gate-pass", { method: "POST", body: JSON.stringify({ workOrderId: seedWo.id, dispatchedQty: 10, carrierName: "Aero Freight", vehicleNumber: "KA01AB9999", driverName: "Ramesh", ewayBillNo: "EWB-778899" }) });
  check("partial checklist (doc pack off) blocked", partial.status === 400 && partial.body.code === "FQC_CHECKLIST_INCOMPLETE", `(${partial.status})`);
  await prisma.fqcChecklist.update({ where: { workOrderId: seedWo.id }, data: { docPackDone: true } });
}
// API upsert (the audit source) — set on a bare WO then revert to keep the blocked demo intact
if (bareWo) {
  const upsert = await api(admin, "/api/fqc", { method: "POST", body: JSON.stringify({ workOrderId: bareWo.id, finalInspectionPassed: true, packingDone: true, docPackDone: true, notes: "test upsert" }) });
  check("API upsert 200 + complete", upsert.status === 200 && upsert.body.complete === true, `(${upsert.status})`);
  await prisma.fqcChecklist.delete({ where: { workOrderId: bareWo.id } });
}
const fqcAudit = await prisma.auditLog.count({ where: { action: "FQC_CHECKLIST_UPDATED" } });
check("FQC_CHECKLIST_UPDATED audited", fqcAudit >= 1, `(${fqcAudit})`);

// ============ M8 — COMPLAINT SLA ============
console.log("== M8 COMPLAINT SLA ==");
const cmps = await api(admin, "/api/complaints");
check("GET /api/complaints 200 + slaStats", cmps.status === 200 && cmps.body.slaStats, `(${cmps.status})`);
const demo = (cmps.body.complaints || []).find((c) => c.complaintNumber === "CMP-DEMO-SLA");
check("demo complaint ack breached", demo?.sla?.ackBreached === true, `(ackDueIn=${demo?.sla?.ackDueIn}h)`);
check("demo complaint 8D still within timer", demo?.sla?.eightDBreached === false && demo?.sla?.eightDDueIn > 0, `(8d due ${demo?.sla?.eightDDueIn}d)`);
const created = await api(admin, "/api/complaints", { method: "POST", body: JSON.stringify({ customerName: "Tesla Gigafactory Texas", type: "QUALITY", severity: "MEDIUM", description: "Cosmetic scratch on housing" }) });
const createdBody = created.body || {};
check("complaint created with SLA timers", created.status === 201 && createdBody.ackDeadline && createdBody.eightDDeadline, "");
if (created.status === 201) {
  const ackMs = new Date(createdBody.ackDeadline).getTime() - new Date(createdBody.raisedAt).getTime();
  const eightMs = new Date(createdBody.eightDDeadline).getTime() - new Date(createdBody.raisedAt).getTime();
  check("ack timer = 24h", Math.abs(ackMs - 24 * 3600000) < 60000, `(${Math.round(ackMs / 3600000)}h)`);
  check("8D timer = 10d", Math.abs(eightMs - 10 * 86400000) < 60000, `(${Math.round(eightMs / 86400000)}d)`);
  const ack = await api(admin, `/api/complaints/${createdBody.id}`, { method: "PATCH", body: JSON.stringify({ status: "ACKNOWLEDGED" }) });
  check("ACKNOWLEDGED stamps ackAt", ack.status === 200 && !!ack.body.ackAt, "");
}
const bell = await api(admin, "/api/notifications");
const slaBell = (bell.body.notifications || []).find((i) => i.id === "complaint-sla");
check("exec bell fires for SLA breach", !!slaBell, `(${slaBell?.description?.slice(0, 70) || "none"})`);
await prisma.customerComplaint.deleteMany({ where: { complaintNumber: createdBody.complaintNumber || "CMP-NOPE" } });

// ============ M9 — QMS DOC CONTROL ============
console.log("== M9 QMS DOC CONTROL ==");
const docs = await api(admin, "/api/qms-docs");
check("GET /api/qms-docs 200", docs.status === 200, `(${docs.status})`);
check("3 seeded docs", (docs.body.docs || []).length >= 3, `(${docs.body.docs?.length})`);
check("overdue flagged", (docs.body.docs || []).some((d) => d.overdue), "");
check("dueSoon flagged", (docs.body.docs || []).some((d) => d.dueSoon), "");
const newDoc = await api(admin, "/api/qms-docs", { method: "POST", body: JSON.stringify({ title: "Test Doc", docType: "FORM", owner: "QA", revision: "A", status: "CURRENT", nextReviewAt: new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10) }) });
check("create doc 201", newDoc.status === 201 && newDoc.body.item?.docNumber?.startsWith("QMS-"), `(${newDoc.status} ${newDoc.body.item?.docNumber || ""})`);
const upd = await api(admin, "/api/qms-docs", { method: "POST", body: JSON.stringify({ id: newDoc.body.item.id, status: "OBSOLETE", revision: "B" }) });
check("update doc 200", upd.status === 200 && upd.body.item?.status === "OBSOLETE", "");
await prisma.qmsDocument.delete({ where: { id: newDoc.body.item.id } });
const digest = await api(admin, "/api/compliance/digest");
const qmsFlags = (digest.body?.flags || []).filter((f) => f.category === "QMS Documents");
check("digest has QMS doc flags", qmsFlags.length >= 2, `(${qmsFlags.length})`);
check("digest flags overdue + dueSoon", qmsFlags.some((f) => f.label.includes("OVERDUE")) && qmsFlags.some((f) => f.label.includes("due in")), "");

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
