import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateMachineOee,
  aggregatePlantOee,
  detectOvernightAnomalies,
  assembleMorningDigest,
  type MachineDigestInput,
  type ComplaintDigestInput,
  type StockDigestInput,
  type IncidentDigestInput,
} from "../src/lib/reports/digest";

const NOW = new Date("2026-09-05T08:00:00.000Z");

test("calculateMachineOee computes availability, performance, and quality accurately", () => {
  const machine: MachineDigestInput = {
    id: "m1",
    name: "CNC Milling 01",
    code: "CNC-01",
    idealCycleTimeSeconds: 60, // 1 min per part -> 60 parts/hr
    oeeTarget: 85.0,
  };

  // 1440 min shift, 120 min planned, 60 min unplanned -> planned operating = 1320, actual operating = 1260
  // availability = 1260 / 1320 = 0.9545
  // total parts = 1000 good + 50 scrap + 50 rework = 1100 total
  // ideal run rate = 1 part / min. theoretical max in 1260 min = 1260 parts.
  // performance = 1100 / 1260 = 0.8730
  // quality = 1000 good / 1100 total = 0.9091
  // oee = 0.9545 * 0.8730 * 0.9091 = 0.7575 -> 75.8%

  const oee = calculateMachineOee(
    machine,
    { good: 1000, scrap: 50, rework: 50 },
    { plannedMinutes: 120, unplannedMinutes: 60 },
    { shiftMinutes: 1440, excludePlannedDowntime: true },
  );

  assert.equal(oee.good, 1000);
  assert.equal(oee.scrap, 50);
  assert.equal(oee.rework, 50);
  assert.equal(oee.totalDowntimeMinutes, 180);
  assert.ok(Math.abs(oee.availabilityPct - 95.5) < 0.2, `Availability expected ~95.5, got ${oee.availabilityPct}`);
  assert.ok(Math.abs(oee.performancePct - 87.3) < 0.2, `Performance expected ~87.3, got ${oee.performancePct}`);
  assert.ok(Math.abs(oee.qualityPct - 90.9) < 0.2, `Quality expected ~90.9, got ${oee.qualityPct}`);
  assert.ok(Math.abs(oee.oeePct - 75.8) < 0.5, `OEE expected ~75.8, got ${oee.oeePct}`);
});

test("calculateMachineOee handles zero runtime without NaN", () => {
  const machine: MachineDigestInput = {
    id: "m2",
    name: "Lathe 02",
    code: "LTH-02",
    idealCycleTimeSeconds: 30,
    oeeTarget: 80.0,
  };

  const oee = calculateMachineOee(
    machine,
    { good: 0, scrap: 0, rework: 0 },
    { plannedMinutes: 1440, unplannedMinutes: 0 },
    { shiftMinutes: 1440, excludePlannedDowntime: true },
  );

  assert.equal(oee.oeePct, 0);
  assert.equal(oee.availabilityPct, 0);
  assert.equal(oee.performancePct, 0);
  assert.equal(oee.qualityPct, 100); // 0 scrap is 100% quality default
});

test("aggregatePlantOee computes plant averages and correctly identifies best and worst machines", () => {
  const m1: MachineDigestInput = { id: "m1", name: "Alpha", code: "A", idealCycleTimeSeconds: 60, oeeTarget: 85 };
  const m2: MachineDigestInput = { id: "m2", name: "Beta", code: "B", idealCycleTimeSeconds: 60, oeeTarget: 85 };
  const m3: MachineDigestInput = { id: "m3", name: "Gamma", code: "C", idealCycleTimeSeconds: 60, oeeTarget: 85 };

  const res1 = calculateMachineOee(m1, { good: 900, scrap: 10, rework: 0 }, { plannedMinutes: 0, unplannedMinutes: 50 });
  const res2 = calculateMachineOee(m2, { good: 500, scrap: 200, rework: 0 }, { plannedMinutes: 0, unplannedMinutes: 300 });
  const res3 = calculateMachineOee(m3, { good: 1100, scrap: 5, rework: 0 }, { plannedMinutes: 0, unplannedMinutes: 20 });

  const plant = aggregatePlantOee([res1, res2, res3]);

  assert.ok(plant.plantOee > 0);
  assert.equal(plant.bestMachine?.name, "Gamma");
  assert.equal(plant.worstMachine?.name, "Beta");
  assert.equal(plant.machineCount, 3);
});

test("detectOvernightAnomalies flags SLA breaches, low stock, and critical safety incidents", () => {
  const complaints: ComplaintDigestInput[] = [
    {
      id: "c1",
      complaintNumber: "CMP-001",
      customerName: "Acme Corp",
      status: "OPEN",
      createdAt: new Date("2026-09-03T10:00:00.000Z"), // > 24h unacknowledged
      acknowledgedAt: null,
      severity: "HIGH",
    },
    {
      id: "c2",
      complaintNumber: "CMP-002",
      customerName: "Beta Corp",
      status: "INVESTIGATING",
      createdAt: new Date("2026-08-20T10:00:00.000Z"), // > 10d without 8D closed
      acknowledgedAt: new Date("2026-08-20T12:00:00.000Z"),
      severity: "CRITICAL",
    },
  ];

  const stocks: StockDigestInput[] = [
    {
      id: "rm1",
      sku: "AL-6061-ROD",
      name: "Aluminium 6061 Rod",
      currentStock: 15,
      minStock: 50,
      unit: "kg",
    },
  ];

  const incidents: IncidentDigestInput[] = [
    {
      id: "inc1",
      type: "HAZARD",
      severity: "CRITICAL",
      description: "Hydraulic oil leak at Station 4",
      status: "OPEN",
    },
  ];

  const anomalies = detectOvernightAnomalies({
    complaints,
    stocks,
    incidents,
    referenceTime: NOW,
  });

  assert.ok(anomalies.some((a) => a.code === "COMPLAINT_ACK_OVERDUE" && a.id === "c1"));
  assert.ok(anomalies.some((a) => a.code === "COMPLAINT_8D_OVERDUE" && a.id === "c2"));
  assert.ok(anomalies.some((a) => a.code === "LOW_STOCK" && a.id === "rm1"));
  assert.ok(anomalies.some((a) => a.code === "CRITICAL_INCIDENT" && a.id === "inc1"));
});

test("assembleMorningDigest produces complete digest DTO with delta vs previous day", () => {
  const digestResult = assembleMorningDigest({
    targetDate: NOW,
    plantName: "Pune Central Plant",
    currentOee: 82.5,
    previousOee: 79.0,
    totalGood: 5200,
    totalScrap: 140,
    totalRework: 45,
    totalDowntimeMinutes: 320,
    topDowntimeReason: "Mechanical Breakdown",
    bestMachine: { name: "CNC-01", oeePct: 91.2 },
    worstMachine: { name: "Lathe-02", oeePct: 68.4 },
    openWorkOrders: 14,
    anomalies: [
      { code: "LOW_STOCK", severity: "warning", message: "AL-6061-ROD is below minimum stock (15 / 50 kg)" },
    ],
  });

  assert.equal(digestResult.tag, "ok");
  if (digestResult.tag === "ok") {
    const d = digestResult.value;
    assert.equal(d.plantName, "Pune Central Plant");
    assert.equal(d.oee, 82.5);
    assert.equal(d.oeeDelta, 3.5); // 82.5 - 79.0
    assert.equal(d.totalGood, 5200);
    assert.equal(d.totalScrap, 140);
    assert.equal(d.attentionNeeded.length, 1);
  }
});
