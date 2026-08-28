#!/usr/bin/env node
/**
 * Sweep dynamic (id-parameterised) pages + APIs with REAL ids from the DB.
 * Usage: node scripts/sweep-dynamic.mjs [baseUrl]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const BASE = process.argv[2] || "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const firstId = async (table) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT id::text FROM "${table}" LIMIT 1`);
    return rows[0]?.id || null;
  } catch {
    return null;
  }
};

async function login() {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "1001", password: "factory123" }),
  });
  const sc = res.headers.get("set-cookie");
  return sc.split(";")[0];
}

const cookie = await login();
console.log(`sweeping dynamic routes on ${BASE} (DATABASE_URL from env)`);

// table -> routes to GET (pages first, then APIs)
const targets = [
  ["WorkOrder", ["/ops/work-orders/", "/api/work-orders/"]],
  ["Machine", ["/api/machines/"]],
  ["Quotation", ["/api/quotations/"]],
  ["CustomerComplaint", ["/api/complaints/"]],
  ["Project", ["/api/projects/"]],
  ["Eco", ["/eco/", "/api/eco/", "/api/eco//items"]],
  ["FaiReport", ["/fai/", "/api/fai/", "/reports/fai/"]],
  ["Grievance", ["/api/grievances/"]],
  ["DisciplinaryCase", ["/api/disciplinary/"]],
  ["NcrReport", ["/api/mrb/"]],
  ["PermitToWork", ["/api/permits/"]],
  ["Voucher", ["/api/vouchers/"]],
  ["SupplierInvoice", ["/api/invoices/", "/reports/invoice/"]],
  ["MaintenanceJob", ["/api/maintenance/jobs/"]],
  ["Kaizen", ["/system/kaizen/", "/api/kaizen/"]],
  ["LeaveRequest", ["/api/leaves/"]],
  ["PerformanceAppraisal", ["/reports/appraisal/"]],
  ["DataPackage", ["/reports/data-package/"]],
  ["CollectionAccount", ["/reports/dunning/"]],
  ["EightDReport", ["/reports/eight-d/"]],
  ["DispatchRecord", ["/reports/gate-pass/"]],
  ["MrmMeeting", ["/reports/mrm-minutes/"]],
  ["SerialUnit", ["/reports/serial/"]],
  ["RndCampaign", ["/rnd/", "/rnd/campaign/", "/api/rnd/campaign/"]],
  ["GstReconRun", ["/api/gst-recon/"]],
];

const failures = [];
const ok = [];

for (const [table, routes] of targets) {
  const id = await firstId(table);
  for (const r of routes) {
    const url = BASE + (r.endsWith("//") ? r.slice(0, -1) + id : r + id);
    try {
      const res = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
      const s = res.status;
      const line = `${s} ${table} ${r.replace("//", "[").replace(/\/$/, "")}...`;
      if (s === 200) ok.push(line);
      else failures.push(`${s} ${line} (id=${id || "NONE"})`);
    } catch (e) {
      failures.push(`ERR ${table} ${r} ${e.message}`);
    }
  }
}

console.log(`\n=== OK (${ok.length}) ===`);
console.log(ok.join("\n"));
console.log(`\n=== FAILURES (${failures.length}) ===`);
console.log(failures.join("\n") || "(none)");

await prisma.$disconnect();
await pool.end();
process.exit(failures.length ? 1 : 0);
