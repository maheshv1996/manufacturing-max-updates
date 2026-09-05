import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatJobTraveler,
  generateTravelerChecksum,
  verifyTravelerChecksum,
  type JobTravelerRawInput,
} from "../src/lib/reports/printTraveler";

const SAMPLE_TRAVELER_INPUT: JobTravelerRawInput = {
  workOrderId: "wo-101",
  woNumber: "WO-2026-A100",
  plannedQuantity: 250,
  plannedStartDate: new Date("2026-09-10T08:00:00.000Z"),
  plannedEndDate: new Date("2026-09-15T17:00:00.000Z"),
  faiRequired: true,
  trackingMode: "SERIAL",
  product: {
    sku: "AERO-BRKT-01",
    name: "Titanium Structural Bracket",
    description: "Grade 5 Ti-6Al-4V machined bracket",
  },
  customerName: "Hindustan Aeronautics Ltd",
  routingSteps: [
    {
      seq: 20,
      operationName: "CNC Milling OP-20",
      stationName: "5-Axis CNC Mill",
      setupTimeMin: 45,
      cycleTimeMin: 12.5,
      isHoldPoint: true,
      holdAuthority: "QUALITY_INSPECTOR",
    },
    {
      seq: 10,
      operationName: "Raw Material Saw Cut",
      stationName: "Band Saw 01",
      setupTimeMin: 15,
      cycleTimeMin: 2.0,
      isHoldPoint: false,
      holdAuthority: null,
    },
    {
      seq: 30,
      operationName: "Anodizing & Passivation",
      stationName: "Surface Finishing Bay",
      setupTimeMin: 30,
      cycleTimeMin: 45.0,
      isHoldPoint: true,
      holdAuthority: "METROLOGY_LEAD",
    },
  ],
  materialHeatNo: "HEAT-TI-99882",
  millCertAttached: true,
  inspectionDimensions: [
    { balloonNo: 1, parameter: "Bore Diameter", nominal: 25.0, usl: 25.02, lsl: 24.98, unit: "mm" },
    { balloonNo: 2, parameter: "Overall Length", nominal: 150.0, usl: 150.1, lsl: 149.9, unit: "mm" },
  ],
};

test("formatJobTraveler sorts routing steps sequentially and flags hold points and FAI", () => {
  const result = formatJobTraveler(SAMPLE_TRAVELER_INPUT);

  assert.equal(result.tag, "ok");
  if (result.tag === "ok") {
    const traveler = result.value;
    assert.equal(traveler.woNumber, "WO-2026-A100");
    assert.equal(traveler.productSku, "AERO-BRKT-01");
    assert.equal(traveler.customerName, "Hindustan Aeronautics Ltd");
    assert.equal(traveler.faiRequired, true);

    // Verify routing steps sorted by seq
    assert.equal(traveler.routingSteps.length, 3);
    assert.equal(traveler.routingSteps[0].seq, 10);
    assert.equal(traveler.routingSteps[1].seq, 20);
    assert.equal(traveler.routingSteps[2].seq, 30);

    // Verify hold points
    assert.equal(traveler.routingSteps[0].isHoldPoint, false);
    assert.equal(traveler.routingSteps[1].isHoldPoint, true);
    assert.equal(traveler.routingSteps[1].holdAuthority, "QUALITY_INSPECTOR");

    // Verify dimensions
    assert.equal(traveler.inspectionDimensions.length, 2);
    assert.equal(traveler.inspectionDimensions[0].balloonNo, 1);

    // Verify checksum exists
    assert.ok(traveler.verificationHash.length > 0);
  }
});

test("generateTravelerChecksum produces deterministic hash that changes on tampering", () => {
  const hash1 = generateTravelerChecksum(SAMPLE_TRAVELER_INPUT);
  const hash2 = generateTravelerChecksum(SAMPLE_TRAVELER_INPUT);
  assert.equal(hash1, hash2, "Checksums must be deterministic for identical input");

  const tamperedInput = {
    ...SAMPLE_TRAVELER_INPUT,
    plannedQuantity: 300, // tampered qty
  };
  const hashTampered = generateTravelerChecksum(tamperedInput);
  assert.notEqual(hash1, hashTampered, "Tampering with quantity must alter checksum");

  const isValid = verifyTravelerChecksum(SAMPLE_TRAVELER_INPUT, hash1);
  assert.equal(isValid, true);

  const isInvalid = verifyTravelerChecksum(tamperedInput, hash1);
  assert.equal(isInvalid, false);
});
