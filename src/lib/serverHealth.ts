import { prisma } from "@/lib/prisma";
import { networkInterfaces } from "os";
import { existsSync, readdirSync, statSync, statfsSync } from "fs";
import { join } from "path";
import { getBuildMonitor } from "@/lib/buildMonitor";
import { APP_VERSION } from "@/lib/appVersion";

export const APP_STARTED_AT = Date.now();

export function lanIps(): string[] {
  const out: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        out.push(net.address);
      }
    }
  }
  return out;
}

export function diskFreeGb(): { freeGb: number; totalGb: number } | null {
  try {
    const st = statfsSync(process.cwd());
    const freeGb = (Number(st.bavail) * Number(st.bsize)) / 1024 ** 3;
    const totalGb = (Number(st.blocks) * Number(st.bsize)) / 1024 ** 3;
    return {
      freeGb: Math.round(freeGb * 10) / 10,
      totalGb: Math.round(totalGb * 10) / 10,
    };
  } catch {
    return null;
  }
}

export function lastBackup(): {
  file: string;
  sizeMb: number;
  at: string;
} | null {
  try {
    const dir = process.env.BACKUP_DIR;
    if (!dir || !existsSync(dir)) return null;
    const files = readdirSync(dir)
      .filter((f) => /\.(dump|backup|db|sqlite)$/i.test(f))
      .map((f) => {
        const p = join(dir, f);
        return {
          file: f,
          sizeMb: Math.round((statSync(p).size / 1024 / 1024) * 10) / 10,
          at: statSync(p).mtime.toISOString(),
        };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
    return files[0] || null;
  } catch {
    return null;
  }
}

export interface HealthPayload {
  ok: boolean;
  status: "healthy" | "degraded";
  mode: "desktop" | "cloud";
  version: string;
  node: string;
  uptimeSeconds: number;
  startedAt: string;
  db: { ok: boolean; error?: string | null; sizeMb: number | null };
  disk: { freeGb: number; totalGb: number; warn: boolean } | null;
  backup: { file: string; sizeMb: number; at: string } | null;
  lanIps: string[];
  staleBuild: {
    bootBuildId: string | null;
    currentBuildId: string | null;
    since: string | null;
  } | null;
  time: string;
}

export async function collectHealth(): Promise<HealthPayload> {
  let dbOk = false;
  let dbError: string | null = null;
  let dbSizeMb: number | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    try {
      const rows: any =
        await prisma.$queryRaw`SELECT pg_database_size(current_database()) AS size`;
      if (rows?.[0]?.size != null)
        dbSizeMb = Math.round((Number(rows[0].size) / 1024 / 1024) * 10) / 10;
    } catch {
      dbSizeMb = null; // non-Postgres adapter (e.g. SQLite desktop) — fine
    }
  } catch (e: any) {
    dbError = e?.message || "database unreachable";
  }

  const disk = diskFreeGb();
  const backup = lastBackup();

  return {
    ok: dbOk,
    status: dbOk ? "healthy" : "degraded",
    mode: process.env.DESKTOP_MODE === "true" ? "desktop" : "cloud",
    version: APP_VERSION,
    node: process.version,
    uptimeSeconds: Math.round((Date.now() - APP_STARTED_AT) / 1000),
    startedAt: new Date(APP_STARTED_AT).toISOString(),
    db: { ok: dbOk, error: dbError, sizeMb: dbSizeMb },
    disk: disk
      ? { freeGb: disk.freeGb, totalGb: disk.totalGb, warn: disk.freeGb < 10 }
      : null,
    backup,
    lanIps: lanIps(),
    staleBuild: (() => {
      const m = getBuildMonitor();
      return m.stale
        ? {
            bootBuildId: m.bootBuildId,
            currentBuildId: m.currentBuildId,
            since: m.staleSince,
          }
        : null;
    })(),
    time: new Date().toISOString(),
  };
}
