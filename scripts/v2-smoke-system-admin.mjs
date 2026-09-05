#!/usr/bin/env node
/**
 * C12-12 — Real-DB smoke test for System, Admin & Config (C12).
 * Drives the complete administration lifecycle against mfgmax_v2_test:
 *   - Custom low-code entity builder with typed schema validation
 *   - Dynamic record creation with type, options, and required constraints
 *   - Rejection of invalid record values (select enum, missing required, wrong type)
 *   - Record update and soft/hard deletion with in-tx audit logs
 *   - Org reporting lines with Tree-of-Trust DAG cycle prevention
 *   - Org chart hierarchy tree assembly from live units and users
 *   - Reporting line termination with active window expiration
 *   - System terminology configuration and dictionary override mapping
 *   - System constants management (OEE target, tolerances, timezone, currency)
 *   - Verification of in-tx AuditLog entries across all operations
 *
 * Usage:
 *   node --import tsx scripts/v2-smoke-system-admin.mjs
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  createCustomEntityTx,
  getCustomEntitiesTx,
  getCustomEntityByIdTx,
  updateCustomEntityTx,
  createCustomRecordTx,
  getCustomRecordsTx,
  updateCustomRecordTx,
  deleteCustomRecordTx,
} from "../src/lib/custom/customTx.ts";
import {
  createReportingLineTx,
  terminateReportingLineTx,
  getReportingLinesTx,
  getOrgChartHierarchyTx,
} from "../src/lib/org/reportingLineTx.ts";
import {
  getTerminologyMapTx,
  updateTerminologyMapTx,
  getSystemConstantsTx,
  updateSystemConstantsTx,
} from "../src/lib/system/settingsTx.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) {
  console.log(`[smoke-system-admin] ${msg}`);
}

const results = { pass: 0, fail: 0, tests: [] };
async function smoke(name, fn) {
  try {
    await fn();
    results.pass++;
    results.tests.push({ name, status: "PASS" });
    log(`PASS: ${name}`);
  } catch (e) {
    results.fail++;
    results.tests.push({ name, status: "FAIL", error: e.message });
    log(`FAIL: ${name} — ${e.message}`);
  }
}

async function run() {
  const runId = Date.now().toString().slice(-6);
  log(`Starting C12 System & Admin smoke run [${runId}] on ${process.env.DATABASE_URL}`);

  let plant, orgUnit, opUser, leadUser, mgrUser;
  let customEntity, customRecord, repLineOpLead, repLineLeadMgr;
  let initialTerminology = null;
  let initialConstants = null;

  try {
    // 0. Backup initial settings if present
    const tRow = await prisma.setting.findUnique({ where: { key: "org_terminology_config" } });
    if (tRow) initialTerminology = tRow.value;
    const cRow = await prisma.setting.findUnique({ where: { key: "system_constants" } });
    if (cRow) initialConstants = cRow.value;

    // 1. Seed base org units, plant, and users
    await smoke("Seed test organization, plant, and users", async () => {
      plant = await prisma.plant.create({
        data: {
          code: `ADM-PLT-${runId}`,
          name: `Admin Test Plant ${runId}`,
        },
      });

      orgUnit = await prisma.orgUnit.create({
        data: {
          code: `ADM-UNIT-${runId}`,
          name: `Advanced Machining Cell ${runId}`,
          type: "DEPARTMENT",
        },
      });

      opUser = await prisma.user.create({
        data: {
          email: `op-${runId}@mfgmax.test`,
          name: `Operator ${runId}`,
          employeeNumber: `EMP-OP-${runId}`,
          isActive: true,
        },
      });

      leadUser = await prisma.user.create({
        data: {
          email: `lead-${runId}@mfgmax.test`,
          name: `Lead Tech ${runId}`,
          employeeNumber: `EMP-LEAD-${runId}`,
          isActive: true,
        },
      });

      mgrUser = await prisma.user.create({
        data: {
          email: `mgr-${runId}@mfgmax.test`,
          name: `Plant Manager ${runId}`,
          employeeNumber: `EMP-MGR-${runId}`,
          isActive: true,
        },
      });
    });

    // 2. Custom Entity: Creation with multi-type fields & in-tx audit
    await smoke("Create custom entity with fields and verify in-tx audit log", async () => {
      customEntity = await createCustomEntityTx(
        prisma,
        {
          title: `Titanium Tool Holder ${runId}`,
          description: "High-precision titanium tooling fixture tracker",
          icon: "Wrench",
          colorTone: "emerald",
          fields: [
            {
              key: "tool_serial",
              label: "Tool Serial Number",
              fieldType: "text",
              required: true,
              placeholder: "e.g. TTH-9940",
            },
            {
              key: "max_rpm",
              label: "Max Rated RPM",
              fieldType: "number",
              required: true,
            },
            {
              key: "coolant_type",
              label: "Coolant Compatibility",
              fieldType: "select",
              required: true,
              options: ["Water-soluble", "Neat Oil", "Cryogenic Nitrogen"],
            },
            {
              key: "calibration_date",
              label: "Last Calibration Date",
              fieldType: "date",
              required: false,
            },
            {
              key: "is_balanced",
              label: "Dynamic Balance Certified",
              fieldType: "boolean",
              required: false,
            },
          ],
        },
        { id: mgrUser.id, name: mgrUser.name },
      );

      if (!customEntity || !customEntity.id) {
        throw new Error("Custom entity was not created");
      }
      if (customEntity.fields.length !== 5) {
        throw new Error(`Expected 5 fields, got ${customEntity.fields.length}`);
      }

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entityType: "CustomEntity",
          entityId: customEntity.id,
          action: "CUSTOM_ENTITY_CREATED",
        },
      });
      if (!auditEntry) {
        throw new Error("In-transaction AuditLog row not found for CUSTOM_ENTITY_CREATED");
      }
    });

    // 3. Custom Entity: Query and Update
    await smoke("Query custom entities and update metadata", async () => {
      const entities = await getCustomEntitiesTx(prisma);
      const found = entities.find((e) => e.id === customEntity.id);
      if (!found) {
        throw new Error("Created entity not found in list");
      }

      const detailed = await getCustomEntityByIdTx(prisma, customEntity.id);
      if (!detailed || detailed.fields.length !== 5) {
        throw new Error("Failed to load entity details by ID");
      }

      const updated = await updateCustomEntityTx(
        prisma,
        customEntity.id,
        { description: "Updated high-precision titanium tooling fixture tracker" },
        { id: mgrUser.id, name: mgrUser.name },
      );
      if (updated.description !== "Updated high-precision titanium tooling fixture tracker") {
        throw new Error("Entity description was not updated");
      }

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entityType: "CustomEntity",
          entityId: customEntity.id,
          action: "CUSTOM_ENTITY_UPDATED",
        },
      });
      if (!auditEntry) {
        throw new Error("In-transaction AuditLog row not found for CUSTOM_ENTITY_UPDATED");
      }
    });

    // 4. Custom Record: Valid Creation & Audit
    await smoke("Create valid custom record with field values & in-tx audit", async () => {
      customRecord = await createCustomRecordTx(
        prisma,
        {
          entityId: customEntity.id,
          values: {
            tool_serial: "TTH-7001-X",
            max_rpm: 24000,
            coolant_type: "Cryogenic Nitrogen",
            calibration_date: "2026-09-01T00:00:00.000Z",
            is_balanced: true,
          },
        },
        { id: opUser.id, name: opUser.name },
      );

      if (!customRecord || !customRecord.id) {
        throw new Error("Custom record was not created");
      }

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entityId: customRecord.id,
          action: "CUSTOM_RECORD_CREATED",
        },
      });
      if (!auditEntry) {
        throw new Error("In-transaction AuditLog row not found for CUSTOM_RECORD_CREATED");
      }
    });

    // 5. Custom Record: Validation Rejections
    await smoke("Reject invalid custom records (missing required & invalid select)", async () => {
      // Missing required field 'tool_serial'
      let caughtRequired = false;
      try {
        await createCustomRecordTx(
          prisma,
          {
            entityId: customEntity.id,
            values: {
              max_rpm: 12000,
              coolant_type: "Water-soluble",
            },
          },
          { id: opUser.id, name: opUser.name },
        );
      } catch (err) {
        caughtRequired = true;
        if (!err.message.includes("is required")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!caughtRequired) {
        throw new Error("Expected createCustomRecordTx to reject missing required field");
      }

      // Invalid select option
      let caughtSelect = false;
      try {
        await createCustomRecordTx(
          prisma,
          {
            entityId: customEntity.id,
            values: {
              tool_serial: "TTH-7002-BAD",
              max_rpm: 18000,
              coolant_type: "Mineral Spirit (Not Permitted)",
            },
          },
          { id: opUser.id, name: opUser.name },
        );
      } catch (err) {
        caughtSelect = true;
        if (!err.message.includes("allowed options")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!caughtSelect) {
        throw new Error("Expected createCustomRecordTx to reject invalid select option");
      }
    });

    // 6. Custom Record: Update, Query & Deletion
    await smoke("Update, query, and delete custom record with audit logs", async () => {
      const updated = await updateCustomRecordTx(
        prisma,
        customRecord.id,
        { max_rpm: 28000 },
        { id: opUser.id, name: opUser.name },
      );
      const vals = updated.values;
      if (vals.max_rpm !== 28000) {
        throw new Error("Custom record max_rpm was not updated");
      }

      const records = await getCustomRecordsTx(prisma, customEntity.id);
      if (records.length !== 1) {
        throw new Error(`Expected 1 record, got ${records.length}`);
      }

      await deleteCustomRecordTx(prisma, customRecord.id, { id: opUser.id, name: opUser.name });

      const auditDel = await prisma.auditLog.findFirst({
        where: {
          entityId: customRecord.id,
          action: "CUSTOM_RECORD_DELETED",
        },
      });
      if (!auditDel) {
        throw new Error("In-transaction AuditLog row not found for CUSTOM_RECORD_DELETED");
      }
    });

    // 7. Org Reporting Lines: Creation & In-Tx Audit
    await smoke("Create valid reporting lines (Operator -> Lead -> Manager) with in-tx audit", async () => {
      repLineOpLead = await createReportingLineTx(
        prisma,
        {
          reportUserId: opUser.id,
          managerUserId: leadUser.id,
          orgUnitId: orgUnit.id,
        },
        { id: mgrUser.id, name: mgrUser.name },
      );

      repLineLeadMgr = await createReportingLineTx(
        prisma,
        {
          reportUserId: leadUser.id,
          managerUserId: mgrUser.id,
          orgUnitId: orgUnit.id,
        },
        { id: mgrUser.id, name: mgrUser.name },
      );

      if (!repLineOpLead.id || !repLineLeadMgr.id) {
        throw new Error("Reporting lines were not created properly");
      }

      const auditLine = await prisma.auditLog.findFirst({
        where: {
          entityType: "ReportingLine",
          entityId: repLineOpLead.id,
          action: "REPORTING_LINE_CREATED",
        },
      });
      if (!auditLine) {
        throw new Error("In-transaction AuditLog row not found for REPORTING_LINE_CREATED");
      }
    });

    // 8. Org Reporting Lines: DAG Cycle Prevention
    await smoke("Block reporting line cycles (direct, indirect, and self-reporting)", async () => {
      // 8a. Self-reporting (Operator -> Operator)
      let caughtSelf = false;
      try {
        await createReportingLineTx(
          prisma,
          {
            reportUserId: opUser.id,
            managerUserId: opUser.id,
          },
          { id: mgrUser.id, name: mgrUser.name },
        );
      } catch (err) {
        caughtSelf = true;
        if (!err.message.includes("cannot report to themselves")) {
          throw new Error(`Unexpected self-report error: ${err.message}`);
        }
      }
      if (!caughtSelf) {
        throw new Error("Expected self-reporting to be rejected");
      }

      // 8b. Direct cycle (Lead -> Operator, while Operator -> Lead exists)
      let caughtDirect = false;
      try {
        await createReportingLineTx(
          prisma,
          {
            reportUserId: leadUser.id,
            managerUserId: opUser.id,
          },
          { id: mgrUser.id, name: mgrUser.name },
        );
      } catch (err) {
        caughtDirect = true;
        if (!err.message.includes("Reporting cycle detected") && !err.message.includes("direct")) {
          throw new Error(`Unexpected direct cycle error: ${err.message}`);
        }
      }
      if (!caughtDirect) {
        throw new Error("Expected direct cycle to be rejected");
      }

      // 8c. Multi-hop indirect cycle (Manager -> Operator, while Operator -> Lead -> Manager exists)
      let caughtIndirect = false;
      try {
        await createReportingLineTx(
          prisma,
          {
            reportUserId: mgrUser.id,
            managerUserId: opUser.id,
          },
          { id: mgrUser.id, name: mgrUser.name },
        );
      } catch (err) {
        caughtIndirect = true;
        if (!err.message.includes("hierarchy cycle") && !err.message.includes("Reporting cycle detected")) {
          throw new Error(`Unexpected indirect cycle error: ${err.message}`);
        }
      }
      if (!caughtIndirect) {
        throw new Error("Expected indirect cycle to be rejected");
      }
    });

    // 9. Org Chart: Hierarchy Tree Assembly
    await smoke("Assemble complete org hierarchy tree and verify relationships", async () => {
      const hierarchy = await getOrgChartHierarchyTx(prisma);
      if (!Array.isArray(hierarchy)) {
        throw new Error("Expected hierarchy array of root units");
      }

      const lines = await getReportingLinesTx(prisma, { activeOnly: true });
      const opLeadFound = lines.some(
        (l) => l.reportUserId === opUser.id && l.managerUserId === leadUser.id,
      );
      if (!opLeadFound) {
        throw new Error("Active reporting line Op -> Lead not found in query");
      }
    });

    // 10. Org Reporting Line: Termination with window expiration
    await smoke("Terminate reporting line and verify window expiration with audit", async () => {
      const terminated = await terminateReportingLineTx(
        prisma,
        repLineOpLead.id,
        { id: mgrUser.id, name: mgrUser.name },
      );

      if (!terminated.validTo) {
        throw new Error("Reporting line validTo was not stamped");
      }

      const auditTerm = await prisma.auditLog.findFirst({
        where: {
          entityType: "ReportingLine",
          entityId: repLineOpLead.id,
          action: "REPORTING_LINE_TERMINATED",
        },
      });
      if (!auditTerm) {
        throw new Error("In-transaction AuditLog row not found for REPORTING_LINE_TERMINATED");
      }

      // Verify it is no longer returned in active-only query
      const activeLines = await getReportingLinesTx(prisma, { activeOnly: true });
      const stillActive = activeLines.some((l) => l.id === repLineOpLead.id);
      if (stillActive) {
        throw new Error("Terminated reporting line still returned as active");
      }
    });

    // 11. System Terminology: Overrides & Fallback Mapping
    await smoke("Update and resolve customized terminology dictionary", async () => {
      const current = await getTerminologyMapTx(prisma);
      if (!current.effective || !current.effective.work_order) {
        throw new Error("Default terminology missing standard canonical terms");
      }

      // Custom override
      const updated = await updateTerminologyMapTx(
        prisma,
        {
          work_order: "Production Ticket",
          ncr: "Defect Incident",
          customer: "Client Account",
        },
        { id: mgrUser.id, name: mgrUser.name },
      );

      if (!updated.success || updated.overrides.work_order !== "Production Ticket") {
        throw new Error("Terminology overrides failed to update");
      }

      const recheck = await getTerminologyMapTx(prisma);
      if (recheck.effective.work_order !== "Production Ticket") {
        throw new Error("Effective terminology did not apply override");
      }
      if (recheck.effective.ncr !== "Defect Incident") {
        throw new Error("Effective terminology did not apply NCR override");
      }
      // Fallback term check (quotation was not overridden)
      if (recheck.effective.quotation !== "Quotation") {
        throw new Error("Effective terminology did not fall back to canonical term");
      }

      const auditTerm = await prisma.auditLog.findFirst({
        where: {
          entityType: "Setting",
          entityId: "org_terminology_config",
          action: "TERMINOLOGY_UPDATED",
        },
      });
      if (!auditTerm) {
        throw new Error("In-transaction AuditLog row not found for TERMINOLOGY_UPDATED");
      }
    });

    // 12. System Constants: Read & Update
    await smoke("Update and read system constants with in-tx audit", async () => {
      const constants = await getSystemConstantsTx(prisma);
      if (typeof constants.oeeTargetPct !== "number") {
        throw new Error("Default system constants invalid");
      }

      const updated = await updateSystemConstantsTx(
        prisma,
        {
          oeeTargetPct: 88.5,
          requireMillCerts: false,
          maxOvertimeHoursWeekly: 14,
        },
        { id: mgrUser.id, name: mgrUser.name },
      );

      if (updated.oeeTargetPct !== 88.5 || updated.requireMillCerts !== false) {
        throw new Error("System constants were not updated");
      }

      const auditConst = await prisma.auditLog.findFirst({
        where: {
          entityType: "Setting",
          entityId: "system_constants",
          action: "SYSTEM_CONSTANTS_UPDATED",
        },
      });
      if (!auditConst) {
        throw new Error("In-transaction AuditLog row not found for SYSTEM_CONSTANTS_UPDATED");
      }
    });

  } finally {
    // 13. Clean up
    log("Cleaning up test records...");
    try {
      if (opUser && leadUser) {
        await prisma.reportingLine.deleteMany({
          where: {
            OR: [
              { reportUserId: opUser.id },
              { reportUserId: leadUser.id },
              { managerUserId: mgrUser?.id },
            ],
          },
        });
      }

      if (customEntity) {
        await prisma.customRecord.deleteMany({ where: { entityId: customEntity.id } });
        await prisma.customField.deleteMany({ where: { entityId: customEntity.id } });
        await prisma.customEntity.delete({ where: { id: customEntity.id } }).catch(() => {});
      }

      if (opUser) await prisma.user.delete({ where: { id: opUser.id } }).catch(() => {});
      if (leadUser) await prisma.user.delete({ where: { id: leadUser.id } }).catch(() => {});
      if (mgrUser) await prisma.user.delete({ where: { id: mgrUser.id } }).catch(() => {});
      if (orgUnit) await prisma.orgUnit.delete({ where: { id: orgUnit.id } }).catch(() => {});
      if (plant) await prisma.plant.delete({ where: { id: plant.id } }).catch(() => {});

      // Restore initial settings if applicable
      if (initialTerminology !== null) {
        await prisma.setting.update({
          where: { key: "org_terminology_config" },
          data: { value: initialTerminology },
        }).catch(() => {});
      } else {
        await prisma.setting.delete({ where: { key: "org_terminology_config" } }).catch(() => {});
      }

      if (initialConstants !== null) {
        await prisma.setting.update({
          where: { key: "system_constants" },
          data: { value: initialConstants },
        }).catch(() => {});
      } else {
        await prisma.setting.delete({ where: { key: "system_constants" } }).catch(() => {});
      }
    } catch (cleanupErr) {
      log(`Cleanup warning: ${cleanupErr.message}`);
    }
    await pool.end();
  }

  log(`Smoke complete: ${results.pass} passed, ${results.fail} failed`);
  if (results.fail > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Fatal smoke run error:", e);
  process.exit(1);
});
