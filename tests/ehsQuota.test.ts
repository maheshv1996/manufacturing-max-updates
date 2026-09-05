import { test } from "node:test";
import assert from "node:assert/strict";
import { observationQuotaRows, type QuotaIncidentRow } from "../src/lib/ehs/safety";

const NOW = new Date("2026-09-05T06:00:00Z");
const MONTH_START = new Date("2026-09-01T00:00:00Z");

const inc = (over: Partial<QuotaIncidentRow> = {}): QuotaIncidentRow => ({
  type: "NEAR_MISS",
  reportedBy: "Meera",
  reportedAt: NOW,
  ...over,
});

test("P27 — counts NEAR_MISS/HAZARD/PPE_VIOLATION per manager for the month", () => {
  const rows = observationQuotaRows(
    [
      inc(),
      inc({ type: "HAZARD" }),
      inc({ reportedBy: "Arun", type: "PPE_VIOLATION" }),
      // not counted: INCIDENT type, other months, non-manager reporters
      inc({ type: "INCIDENT" }),
      inc({ reportedAt: new Date("2026-08-20T00:00:00Z") }),
      inc({ reportedBy: "Vendor Sam" }),
    ],
    [{ name: "Meera" }, { name: "Arun" }],
    4,
    MONTH_START,
    NOW,
  );
  assert.equal(rows.length, 2);
  const meera = rows.find((r) => r.name === "Meera")!;
  const arun = rows.find((r) => r.name === "Arun")!;
  assert.equal(meera.count, 2);
  assert.equal(meera.missed, true, "2 < quota 4");
  assert.equal(arun.count, 1);
  assert.equal(arun.missed, true);
});

test("P27 — manager at/above quota is not flagged; manager with zero rows shows 0", () => {
  const rows = observationQuotaRows(
    [
      inc({ reportedBy: "Meera" }),
      inc({ reportedBy: "Meera", type: "HAZARD" }),
      inc({ reportedBy: "Meera", type: "PPE_VIOLATION" }),
      inc({ reportedBy: "Meera" }),
    ],
    [{ name: "Meera" }, { name: "Arun" }],
    4,
    MONTH_START,
    NOW,
  );
  const meera = rows.find((r) => r.name === "Meera")!;
  const arun = rows.find((r) => r.name === "Arun")!;
  assert.equal(meera.count, 4);
  assert.equal(meera.missed, false);
  assert.equal(arun.count, 0);
  assert.equal(arun.missed, true);
});

test("P27 — quota defaults applied by caller; blank reporter names never crash rows", () => {
  const rows = observationQuotaRows(
    [inc({ reportedBy: "  " }), inc({ reportedBy: "" })],
    [{ name: "Meera" }],
    2,
    MONTH_START,
    NOW,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.count, 0);
});
