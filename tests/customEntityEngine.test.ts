import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  slugifyTitle,
  validateCustomRecordValues,
  type CustomFieldDefinition,
} from "../src/lib/custom/customEngine.ts";

describe("Custom Entity Engine — Low-Code Records Validation", () => {
  const fields: CustomFieldDefinition[] = [
    { key: "blisk_serial", label: "Blisk Serial", fieldType: "text", required: true },
    { key: "coating_microns", label: "Coating Thickness", fieldType: "number", required: true },
    { key: "coating_type", label: "Coating Method", fieldType: "select", required: true, options: ["PVD", "CVD", "THERMAL_SPRAY"] },
    { key: "inspection_date", label: "Inspection Date", fieldType: "date", required: false },
    { key: "passed_qc", label: "Passed QC", fieldType: "boolean", required: true },
  ];

  it("slugifies entity titles into lowercase alphanumeric identifiers", () => {
    assert.equal(slugifyTitle("Titanium Blisk Cell"), "titanium_blisk_cell");
    assert.equal(slugifyTitle("  Aero-Structure Part (Rev 2)  "), "aero_structure_part_rev_2");
    assert.equal(slugifyTitle("5-Axis Milling Fixture!"), "5_axis_milling_fixture");
  });

  it("validates compliant record values and returns parsed payload", () => {
    const rawValues = {
      blisk_serial: "BLK-2026-09",
      coating_microns: 14.5,
      coating_type: "PVD",
      inspection_date: "2026-09-05T10:00:00.000Z",
      passed_qc: true,
      extra_unregistered_key: "will_be_stripped",
    };

    const res = validateCustomRecordValues(fields, rawValues);
    assert.equal(res.tag, "ok");
    if (res.tag === "ok") {
      assert.equal(res.value.blisk_serial, "BLK-2026-09");
      assert.equal(res.value.coating_microns, 14.5);
      assert.equal(res.value.coating_type, "PVD");
      assert.equal(res.value.passed_qc, true);
      assert.equal(res.value.extra_unregistered_key, undefined);
    }
  });

  it("rejects when required field is missing or empty", () => {
    const missingSerial = {
      coating_microns: 12.0,
      coating_type: "PVD",
      passed_qc: true,
    };

    const res = validateCustomRecordValues(fields, missingSerial);
    assert.equal(res.tag, "err");
    if (res.tag === "err") {
      assert.ok(res.error.message.includes("blisk_serial"));
    }
  });

  it("rejects when select option is not in allowed list", () => {
    const invalidSelect = {
      blisk_serial: "BLK-01",
      coating_microns: 12.0,
      coating_type: "UNKNOWN_PROCESS",
      passed_qc: true,
    };

    const res = validateCustomRecordValues(fields, invalidSelect);
    assert.equal(res.tag, "err");
    if (res.tag === "err") {
      assert.ok(res.error.message.includes("coating_type"));
    }
  });

  it("rejects when number or boolean types are invalid", () => {
    const notANumber = {
      blisk_serial: "BLK-01",
      coating_microns: "fourteen",
      coating_type: "PVD",
      passed_qc: true,
    };

    const resNumber = validateCustomRecordValues(fields, notANumber);
    assert.equal(resNumber.tag, "err");

    const notABool = {
      blisk_serial: "BLK-01",
      coating_microns: 14.0,
      coating_type: "PVD",
      passed_qc: "yes",
    };

    const resBool = validateCustomRecordValues(fields, notABool);
    assert.equal(resBool.tag, "err");
  });
});
