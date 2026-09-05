import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closeIncident,
  startInvestigation,
  transitionIncident,
  validateIncidentReport,
  closureEvidence,
  type IncidentInput,
} from "../src/lib/ehs/safety";

const NOW = new Date("2026-09-05T06:00:00Z");

const incident = (over: Partial<IncidentInput> = {}): IncidentInput => ({
  id: "si1",
  type: "HAZARD",
  severity: "MEDIUM",
  status: "OPEN",
  location: "Assembly Line 02",
  description: "Oil spill near walkway",
  reportedBy: "Ravi",
  reportedAt: NOW,
  capaOwner: null,
  dueDate: null,
  rootCause: null,
  fiveWhyReason: null,
  actionTaken: null,
  closedAt: null,
  closedBy: null,
  ...over,
});

test("report validates type, severity, location, description", () => {
  assert.equal(validateIncidentReport({ type: "NOPE" as never, severity: "LOW", location: "x", description: "y" }).tag, "err");
  assert.equal(validateIncidentReport({ type: "INCIDENT", severity: "FATAL" as never, location: "x", description: "y" }).tag, "err");
  assert.equal(validateIncidentReport({ type: "HAZARD", severity: "LOW", location: "  ", description: "y" }).tag, "err");
  assert.equal(validateIncidentReport({ type: "HAZARD", severity: "LOW", location: "x", description: " " }).tag, "err");
  const r = validateIncidentReport({ type: "NEAR_MISS", severity: "MEDIUM", location: "Bay 3", description: "Miss by inch" });
  assert.equal(r.tag, "ok");
  if (r.tag === "ok") {
    assert.equal(r.value.status, "OPEN");
    assert.equal(r.value.severity, "MEDIUM", "severity defaulted/kept");
  }
});

test("START_INVESTIGATION requires capaOwner and only from OPEN", () => {
  const noOwner = startInvestigation(incident(), { capaOwner: "  " }, "ehs1", NOW);
  assert.equal(noOwner.tag, "err");
  const okR = startInvestigation(incident(), { capaOwner: "Meera" }, "ehs1", NOW);
  assert.equal(okR.tag, "ok");
  if (okR.tag === "ok") {
    assert.equal(okR.value.status, "IN_INVESTIGATION");
    assert.equal(okR.value.capaOwner, "Meera");
  }
  const fromInvestigating = startInvestigation(incident({ status: "IN_INVESTIGATION" }), { capaOwner: "M" }, "ehs1", NOW);
  assert.equal(fromInvestigating.tag, "err");
  const fromClosed = startInvestigation(incident({ status: "CLOSED" }), { capaOwner: "M" }, "ehs1", NOW);
  assert.equal(fromClosed.tag, "err");
});

test("F10 closure evidence: rootCause-or-fiveWhy AND actionTaken", () => {
  assert.deepEqual(closureEvidence(incident()), { ok: false, missing: ["ROOT_CAUSE_OR_FIVE_WHY", "ACTION_TAKEN"] });
  assert.deepEqual(closureEvidence(incident({ rootCause: "worn seal" })), { ok: false, missing: ["ACTION_TAKEN"] });
  assert.deepEqual(closureEvidence(incident({ fiveWhyReason: "why chain" })), { ok: false, missing: ["ACTION_TAKEN"] });
  assert.deepEqual(closureEvidence(incident({ actionTaken: "seal replaced" })), { ok: false, missing: ["ROOT_CAUSE_OR_FIVE_WHY"] });
  assert.deepEqual(closureEvidence(incident({ rootCause: "seal", actionTaken: "replaced" })), { ok: true, missing: [] });
  assert.deepEqual(
    closureEvidence(incident({ fiveWhyReason: "chain", actionTaken: "replaced" })),
    { ok: true, missing: [] },
  );
});

test("CLOSE from OPEN or IN_INVESTIGATION requires evidence and stamps closedAt/closedBy", () => {
  const noEvidence = closeIncident(incident(), { actionTaken: "did stuff" }, "ehs1", NOW);
  assert.equal(noEvidence.tag, "err");

  const okClose = closeIncident(
    incident({ fiveWhyReason: "5why chain", actionTaken: "spill contained, absorbent placed" }),
    { rootCause: "Lubrication overfill" },
    "ehs1",
    NOW,
  );
  assert.equal(okClose.tag, "ok");
  if (okClose.tag === "ok") {
    assert.equal(okClose.value.status, "CLOSED");
    assert.equal(okClose.value.closedBy, "ehs1");
    assert.equal(okClose.value.closedAt, NOW);
  }

  const closedTwice = transitionIncident(incident({ status: "CLOSED" }), "CLOSE", {}, "ehs1", NOW);
  assert.equal(closedTwice.tag, "err");
});
