#!/usr/bin/env node
/**
 * C13-13 — Real-DB smoke test for Plant-Server Scale & Desktop Integration (C13).
 * Drives the final scale and offline desktop hardening verification against mfgmax_v2_test:
 *   - Desktop module load & launcher architecture integrity (DEPTH_06 §1, §3)
 *   - High-concurrency query benchmark (simulating concurrent terminal traffic)
 *   - Concurrent transactional write burst with in-tx audit log isolation
 *   - Idempotency key deduplication under race conditions (G-9)
 *   - SLA compliance evaluation (p50, p90, p95, p99 latencies and 0% error rate)
 *   - Backup vault & offline disaster recovery snapshot simulation
 *
 * Usage:
 *   node --import tsx scripts/v2-smoke-scale-desktop.mjs
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  runConcurrencyBenchmark,
  evaluateSlaCompliance,
} from "../src/lib/scale/concurrencyBenchmark.ts";
import { buildAuditEvent } from "../src/lib/core/audit.ts";
import { runIdempotent } from "../src/lib/core/integrityDb.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 10 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) {
  console.log(`[smoke-scale-desktop] ${msg}`);
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
  log(`Starting C13 Scale & Desktop smoke run [${runId}] on ${process.env.DATABASE_URL}`);

  let testUser, testUnit;

  try {
    // 1. Desktop Launcher & Core Modules Loading
    await smoke("Verify desktop platform modules and launcher importability", async () => {
      const watchdog = await import("../desktop/lib/watchdog.js");
      if (!watchdog.Watchdog) {
        throw new Error("Watchdog class failed to load from desktop/lib/watchdog.js");
      }

      const vault = await import("../desktop/lib/vault.js");
      if (typeof vault.createBackup !== "function" || typeof vault.rotateBackups !== "function") {
        throw new Error("vault backup functions failed to load from desktop/lib/vault.js");
      }

      const license = await import("../desktop/lib/license.js");
      if (typeof license.evaluateActivation !== "function") {
        throw new Error("license.evaluateActivation failed to load from desktop/lib/license.js");
      }
    });

    // 2. Seed test actors for benchmark workloads
    await smoke("Seed test benchmark user and org unit", async () => {
      testUnit = await prisma.orgUnit.create({
        data: {
          code: `SCALE-UNIT-${runId}`,
          name: `Scale Benchmarking Cell ${runId}`,
          type: "LINE",
        },
      });

      testUser = await prisma.user.create({
        data: {
          email: `scale-worker-${runId}@mfgmax.test`,
          name: `Scale Worker ${runId}`,
          employeeNumber: `EMP-SCALE-${runId}`,
          isActive: true,
        },
      });
    });

    // 3. High-Concurrency Read Benchmark (Simulating 50 concurrent shopfloor terminals)
    await smoke("Run 100-request concurrent read benchmark against live Postgres", async () => {
      const report = await runConcurrencyBenchmark(async (_taskId) => {
        const units = await prisma.orgUnit.findMany({
          take: 10,
          select: { id: true, code: true, name: true },
        });
        return { success: Array.isArray(units) };
      }, {
        totalTasks: 100,
        concurrency: 20,
      });

      log(`Read Benchmark: ${report.throughputOpsPerSec} ops/sec | p50: ${report.latencies.p50}ms | p95: ${report.latencies.p95}ms | p99: ${report.latencies.p99}ms`);

      if (report.failedTasks > 0) {
        throw new Error(`Concurrent read benchmark had ${report.failedTasks} failures`);
      }

      const sla = evaluateSlaCompliance(report.latencies, report.errorRate, {
        maxP95Ms: 1000,
        maxP99Ms: 2000,
        maxErrorRate: 0.0,
      });

      if (!sla.isCompliant) {
        throw new Error(`SLA violations: ${sla.violations.join(", ")}`);
      }
    });

    // 4. Concurrent Transactional Write Burst with in-tx Audit Logs
    await smoke("Run concurrent transactional write burst with in-tx audit log isolation", async () => {
      const writeReport = await runConcurrencyBenchmark(async (taskId) => {
        await prisma.$transaction(async (tx) => {
          const ev = buildAuditEvent({
            actor: testUser.name,
            action: "SCALE_BURST_WRITE",
            entityType: "OrgUnit",
            entityId: testUnit.id,
            details: JSON.stringify({ taskId, runId }),
          });

          await tx.auditLog.create({
            data: {
              actor: ev.actor,
              action: ev.action,
              entityType: ev.entityType,
              entityId: ev.entityId,
              details: ev.details ?? "",
              at: ev.at,
            },
          });
        });
        return { success: true };
      }, {
        totalTasks: 30,
        concurrency: 5,
      });

      log(`Write Burst Benchmark: ${writeReport.throughputOpsPerSec} ops/sec | p50: ${writeReport.latencies.p50}ms | p95: ${writeReport.latencies.p95}ms`);

      if (writeReport.failedTasks > 0) {
        throw new Error(`Transactional write burst had ${writeReport.failedTasks} failures`);
      }

      const count = await prisma.auditLog.count({
        where: {
          entityId: testUnit.id,
          action: "SCALE_BURST_WRITE",
        },
      });

      if (count !== 30) {
        throw new Error(`Expected 30 audit logs from concurrent burst, found ${count}`);
      }
    });

    // 5. Idempotency Key Concurrency Race Test (G-9)
    await smoke("Deduplicate concurrent idempotent requests with identical key", async () => {
      const rawClientId = `CLIENT-${runId}`;
      let executions = 0;

      // Launch 5 simultaneous requests with the same clientId and scope
      const attempts = Array.from({ length: 5 }, async () => {
        return await runIdempotent(
          prisma,
          { clientId: rawClientId, scope: `SCALE-SCOPE-${runId}` },
          async () => {
            executions++;
            return { success: true, runId };
          },
        );
      });

      const results = await Promise.all(attempts);
      const appliedCount = results.filter((r) => r.applied === true).length;
      const deduplicatedCount = results.filter((r) => r.applied === false).length;

      if (appliedCount !== 1) {
        throw new Error(`Expected exactly 1 applied execution, got ${appliedCount} (deduped: ${deduplicatedCount})`);
      }
      if (executions !== 1) {
        throw new Error(`Business logic executed ${executions} times instead of 1`);
      }
    });

    // 6. Backup Vault Drill Simulation
    await smoke("Verify disaster recovery vault layout and retention simulation", async () => {
      const vault = await import("../desktop/lib/vault.js");
      const testFiles = [
        "mfgmax-20260901-010000.dump",
        "mfgmax-20260902-010000.dump",
        "mfgmax-20260903-010000.dump",
      ];
      const rotated = vault.rotateBackups(testFiles, 2);
      if (rotated.length !== 1 || rotated[0] !== "mfgmax-20260901-010000.dump") {
        throw new Error(`Expected oldest backup to rotate, got: ${JSON.stringify(rotated)}`);
      }
      const fname = vault.backupFileName();
      if (!fname.startsWith("mfgmax-") || !fname.endsWith(".dump")) {
        throw new Error(`Unexpected backup filename pattern: ${fname}`);
      }
    });

  } finally {
    // 7. Clean up
    log("Cleaning up scale test records...");
    try {
      if (testUnit) {
        await prisma.auditLog.deleteMany({ where: { entityId: testUnit.id } });
        await prisma.orgUnit.delete({ where: { id: testUnit.id } }).catch(() => {});
      }
      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
      await prisma.idempotencyKey.deleteMany({
        where: { endpoint: { startsWith: `SCALE-SCOPE-${runId}` } },
      });
    } catch (cleanupErr) {
      log(`Cleanup warning: ${cleanupErr.message}`);
    }
    await pool.end();
  }

  log(`Scale smoke complete: ${results.pass} passed, ${results.fail} failed`);
  if (results.fail > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Fatal scale smoke run error:", e);
  process.exit(1);
});
