/**
 * C13 — Plant-Server Concurrency Benchmark Engine (DEPTH_06).
 * Pure & DB-free scale testing framework for simulating high-concurrency
 * shopfloor and terminal traffic on single-tenant plant servers (500+ users).
 */

export interface BenchmarkTaskResult {
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface BenchmarkOptions {
  totalTasks: number;
  concurrency: number;
}

export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface BenchmarkReport {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  errorRate: number;
  totalDurationMs: number;
  throughputOpsPerSec: number;
  latencies: LatencyStats;
}

export interface SlaCriteria {
  maxP95Ms: number;
  maxP99Ms: number;
  maxErrorRate: number;
}

export interface SlaEvaluation {
  isCompliant: boolean;
  violations: string[];
}

/**
 * Computes sorted latency percentiles with exact linear interpolation.
 */
export function calculatePercentiles(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / count) * 100) / 100;

  function getPercentile(p: number): number {
    const rank = (p / 100) * (count - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    if (upper === lower) {
      return sorted[lower];
    }
    const val = sorted[lower] * (1 - weight) + sorted[upper] * weight;
    return Math.round(val * 100) / 100;
  }

  return {
    count,
    min: sorted[0],
    max: sorted[count - 1],
    avg,
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}

/**
 * Executes tasks concurrently bounded by `options.concurrency`.
 */
export async function runConcurrencyBenchmark(
  taskRunner: (taskId: number) => Promise<BenchmarkTaskResult>,
  options: BenchmarkOptions,
): Promise<BenchmarkReport> {
  const { totalTasks, concurrency } = options;
  const latencies: number[] = [];
  let successfulTasks = 0;
  let failedTasks = 0;

  const startTime = Date.now();
  let nextTaskIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const taskId = nextTaskIndex++;
      if (taskId >= totalTasks) {
        break;
      }

      const taskStart = Date.now();
      try {
        const result = await taskRunner(taskId);
        const taskDuration = Math.max(Date.now() - taskStart, 0.1);
        latencies.push(taskDuration);

        if (result.success) {
          successfulTasks++;
        } else {
          failedTasks++;
        }
      } catch {
        const taskDuration = Math.max(Date.now() - taskStart, 0.1);
        latencies.push(taskDuration);
        failedTasks++;
      }
    }
  }

  const workerCount = Math.min(concurrency, totalTasks);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  const totalDurationMs = Math.max(Date.now() - startTime, 1);
  const throughputOpsPerSec =
    Math.round((totalTasks / (totalDurationMs / 1000)) * 100) / 100;
  const errorRate = Math.round((failedTasks / totalTasks) * 10000) / 10000;

  return {
    totalTasks,
    successfulTasks,
    failedTasks,
    errorRate,
    totalDurationMs,
    throughputOpsPerSec,
    latencies: calculatePercentiles(latencies),
  };
}

/**
 * Checks if benchmark statistics satisfy defined SLA criteria.
 */
export function evaluateSlaCompliance(
  stats: LatencyStats,
  errorRate: number,
  criteria: SlaCriteria,
): SlaEvaluation {
  const violations: string[] = [];

  if (stats.p95 > criteria.maxP95Ms) {
    violations.push(`P95 latency (${stats.p95}ms) exceeds SLA limit (${criteria.maxP95Ms}ms)`);
  }

  if (stats.p99 > criteria.maxP99Ms) {
    violations.push(`P99 latency (${stats.p99}ms) exceeds SLA limit (${criteria.maxP99Ms}ms)`);
  }

  if (errorRate > criteria.maxErrorRate) {
    violations.push(`Error rate (${(errorRate * 100).toFixed(2)}%) exceeds allowed maximum (${(criteria.maxErrorRate * 100).toFixed(2)}%)`);
  }

  return {
    isCompliant: violations.length === 0,
    violations,
  };
}
