import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runConcurrencyBenchmark,
  calculatePercentiles,
  evaluateSlaCompliance,
  type BenchmarkOptions,
} from "../src/lib/scale/concurrencyBenchmark";

describe("Concurrency Benchmark Engine — Plant Server Scale (DEPTH_06)", () => {
  it("calculates accurate latency percentiles (p50, p90, p95, p99, min, max, avg)", () => {
    // 100 latencies from 1ms to 100ms
    const latencies = Array.from({ length: 100 }, (_, i) => i + 1);
    const stats = calculatePercentiles(latencies);

    assert.equal(stats.count, 100);
    assert.equal(stats.min, 1);
    assert.equal(stats.max, 100);
    assert.equal(stats.avg, 50.5);
    assert.equal(stats.p50, 50.5);
    assert.equal(stats.p90, 90.1);
    assert.equal(stats.p95, 95.05);
    assert.equal(stats.p99, 99.01);
  });

  it("handles edge cases in percentile calculation (empty and single value)", () => {
    const emptyStats = calculatePercentiles([]);
    assert.equal(emptyStats.count, 0);
    assert.equal(emptyStats.p50, 0);
    assert.equal(emptyStats.avg, 0);

    const singleStats = calculatePercentiles([42]);
    assert.equal(singleStats.count, 1);
    assert.equal(singleStats.min, 42);
    assert.equal(singleStats.max, 42);
    assert.equal(singleStats.p50, 42);
    assert.equal(singleStats.p99, 42);
  });

  it("executes simulated concurrent tasks respecting concurrency limit", async () => {
    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;

    const opts: BenchmarkOptions = {
      totalTasks: 50,
      concurrency: 10,
    };

    const report = await runConcurrencyBenchmark(async (taskId) => {
      currentConcurrent++;
      if (currentConcurrent > maxObservedConcurrent) {
        maxObservedConcurrent = currentConcurrent;
      }
      // Small simulated async latency
      await new Promise((resolve) => setTimeout(resolve, 5));
      currentConcurrent--;
      return { success: true, meta: { taskId } };
    }, opts);

    assert.equal(report.totalTasks, 50);
    assert.equal(report.successfulTasks, 50);
    assert.equal(report.failedTasks, 0);
    assert.equal(report.errorRate, 0);
    assert.ok(maxObservedConcurrent <= 10, `Observed ${maxObservedConcurrent} concurrent, max allowed was 10`);
    assert.ok(report.throughputOpsPerSec > 0);
    assert.ok(report.latencies.p50 >= 4);
  });

  it("evaluates SLA thresholds correctly and detects violations", () => {
    const passingStats = {
      count: 100,
      min: 2,
      max: 45,
      avg: 12,
      p50: 10,
      p90: 25,
      p95: 35,
      p99: 44,
    };

    const slaPassing = evaluateSlaCompliance(passingStats, 0, {
      maxP95Ms: 50,
      maxP99Ms: 100,
      maxErrorRate: 0.01,
    });
    assert.equal(slaPassing.isCompliant, true);
    assert.equal(slaPassing.violations.length, 0);

    const failingStats = {
      ...passingStats,
      p95: 120, // Violates maxP95Ms (50ms)
    };
    const slaFailing = evaluateSlaCompliance(failingStats, 0.05, {
      maxP95Ms: 50,
      maxP99Ms: 100,
      maxErrorRate: 0.01,
    });
    assert.equal(slaFailing.isCompliant, false);
    assert.equal(slaFailing.violations.length, 2); // p95 violation and error rate violation
  });
});
