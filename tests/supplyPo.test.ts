import { test } from "node:test";
import assert from "node:assert/strict";
import { advancePoApproval, nextReceiptStatus, cancelPo } from "../src/lib/supply/po";

test("ladder: APPROVED escalates to PENDING_MANAGER when over manager threshold", () => {
  const r = advancePoApproval("APPROVED", { action: "ESCALATE", tier: "MANAGER" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.approvalStatus, "PENDING_MANAGER");
});

test("manager approval under owner threshold -> APPROVED", () => {
  const esc = advancePoApproval("APPROVED", { action: "ESCALATE", tier: "MANAGER" });
  assert.equal(esc.ok, true);
  if (!esc.ok) return;
  const r = advancePoApproval(esc.approvalStatus, { action: "APPROVE", tier: "MANAGER" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.approvalStatus, "APPROVED");
});

test("manager approval over owner threshold -> PENDING_OWNER -> owner -> APPROVED", () => {
  const esc = advancePoApproval("APPROVED", { action: "ESCALATE", tier: "MANAGER" });
  assert.equal(esc.ok, true);
  if (!esc.ok) return;
  const toOwner = advancePoApproval(esc.approvalStatus, {
    action: "APPROVE",
    tier: "MANAGER",
    ownerStillRequired: true,
  });
  assert.equal(toOwner.ok, true);
  if (!toOwner.ok) return;
  assert.equal(toOwner.approvalStatus, "PENDING_OWNER");
  const fin = advancePoApproval(toOwner.approvalStatus, { action: "APPROVE", tier: "OWNER" });
  assert.equal(fin.ok, true);
  if (fin.ok) assert.equal(fin.approvalStatus, "APPROVED");
});

test("direct owner escalation from APPROVED is legal", () => {
  const r = advancePoApproval("APPROVED", { action: "ESCALATE", tier: "OWNER" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.approvalStatus, "PENDING_OWNER");
});

test("REJECT requires a written reason (REASON_REQUIRED)", () => {
  const r = advancePoApproval("PENDING_MANAGER", { action: "REJECT" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REASON_REQUIRED");
});

test("REJECT with reason -> REJECTED, terminal", () => {
  const r = advancePoApproval("PENDING_OWNER", { action: "REJECT", reason: "budget cut" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.approvalStatus, "REJECTED");
  const again = advancePoApproval(r.approvalStatus, { action: "APPROVE", tier: "OWNER" });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.code, "ILLEGAL_TRANSITION");
});

test("wrong-tier approval is illegal", () => {
  const esc = advancePoApproval("APPROVED", { action: "ESCALATE", tier: "MANAGER" });
  assert.equal(esc.ok, true);
  if (!esc.ok) return;
  const r = advancePoApproval(esc.approvalStatus, { action: "APPROVE", tier: "OWNER" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
});

test("receipt: ORDERED -> PARTIAL -> RECEIVED", () => {
  const p1 = nextReceiptStatus("ORDERED", { receivedQty: 0, addQty: 40, poQty: 100, tolerancePct: 0 });
  assert.equal(p1.ok, true);
  if (!p1.ok) return;
  assert.equal(p1.newReceived, 40);
  assert.equal(p1.nextStatus, "PARTIAL");
  const p2 = nextReceiptStatus(p1.nextStatus, { receivedQty: 40, addQty: 60, poQty: 100, tolerancePct: 0 });
  assert.equal(p2.ok, true);
  if (!p2.ok) return;
  assert.equal(p2.nextStatus, "RECEIVED");
  assert.equal(p2.newReceived, 100);
});

test("over-delivery within tolerance is allowed", () => {
  const r = nextReceiptStatus("PARTIAL", { receivedQty: 95, addQty: 10, poQty: 100, tolerancePct: 10 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.newReceived, 105);
    assert.equal(r.nextStatus, "RECEIVED");
  }
});

test("over-delivery beyond tolerance is blocked (OVER_DELIVERY)", () => {
  const r = nextReceiptStatus("PARTIAL", { receivedQty: 95, addQty: 16, poQty: 100, tolerancePct: 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "OVER_DELIVERY");
});

test("zero/negative receipt qty is invalid (QTY_INVALID)", () => {
  for (const addQty of [0, -5]) {
    const r = nextReceiptStatus("ORDERED", { receivedQty: 0, addQty, poQty: 100, tolerancePct: 0 });
    assert.equal(r.ok, false, `addQty=${addQty}`);
    if (!r.ok) assert.equal(r.code, "QTY_INVALID");
  }
});

test("CANCELLED only when nothing received (HAS_RECEIPTS)", () => {
  assert.equal(cancelPo(0).ok, true);
  const r = cancelPo(5);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "HAS_RECEIPTS");
});

test("receipt from CANCELLED is illegal (PO_CANCELLED)", () => {
  const r = nextReceiptStatus("CANCELLED", { receivedQty: 0, addQty: 1, poQty: 100, tolerancePct: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "PO_CANCELLED");
});