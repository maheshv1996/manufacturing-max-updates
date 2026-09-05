#!/usr/bin/env node
/**
 * C6-6 — Real-DB smoke test for /api/v2/commercial and /api/v2/finance routes.
 * Starts Next.js server, exercises each route against mfgmax_v2_test, then exits.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:1996@localhost:5432/mfgmax_v2_test" node scripts/v2-smoke-routes.mjs
 */

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";
let sessionCookie = "";

function log(msg) { console.log(`[smoke-routes] ${msg}`); }

function waitForServer(port, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/api/health`, (res) => {
        resolve();
      }).on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error("Server did not start in time"));
        setTimeout(check, 500);
      });
    };
    check();
  });
}

function request(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, "http://localhost:3000");
    const headers = {
      "Content-Type": "application/json",
      Cookie: `app_session=${sessionCookie}`,
      ...extraHeaders,
    };
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  log("starting Next.js dev server...");
  const server = spawn("node", ["--import", "tsx", "node_modules/next/dist/bin/next", "dev", "-p", "3000"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL, NODE_ENV: "development" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let serverLogs = [];
  server.stdout.on("data", (d) => {
    const text = d.toString();
    serverLogs.push(text);
    if (text.includes("Ready") || text.includes("started server") || text.includes("Local:")) {
      log("Next.js server started");
    }
  });
  server.stderr.on("data", (d) => log(`stderr: ${d.toString().trim()}`));

  try {
    await waitForServer(3000, 60000);
  } catch (e) {
    console.error("Server logs:", serverLogs.slice(-20).join("\n"));
    server.kill("SIGTERM");
    process.exit(1);
  }

  const results = { pass: 0, fail: 0, tests: [] };

  // Obtain app_session cookie via login API
  const loginRes = await new Promise((resolve, reject) => {
    const url = new URL("/api/auth/login", "http://localhost:3000");
    const body = JSON.stringify({ username: "admin", password: "factory123" });
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        const setCookie = res.headers["set-cookie"];
        const cookie = Array.isArray(setCookie) ? setCookie.find((c) => c.startsWith("app_session="))?.split(";")[0]?.split("=")[1] : null;
        resolve({ status: res.statusCode, body: parsed, cookie });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  if (!loginRes.cookie || loginRes.status !== 200) {
    console.error("login failed:", loginRes.status, JSON.stringify(loginRes.body));
    server.kill("SIGTERM");
    process.exit(1);
  }
  sessionCookie = loginRes.cookie;
  log(`obtained app_session cookie`);

  // Seed minimal prerequisite records for HTTP smoke tests
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  const product = await prisma.product.create({
    data: { sku: `SKU-SMOKE-${Date.now()}`, name: "Smoke Product", unit: "PCS", sellingPricePerUnit: 1500, materialCostPerUnit: 1000 },
  });
  log(`seeded product ${product.id}`);
  const customer = await prisma.customer.create({
    data: { name: "Smoke Client", type: "DOMESTIC", isActive: true },
  });
  log(`seeded customer ${customer.id}`);
  let glAccount = await prisma.glAccount.findFirst();
  if (!glAccount) {
    glAccount = await prisma.glAccount.create({
      data: { code: "4000", name: "Smoke Revenue", type: "REVENUE", normalBalance: "CREDIT" },
    });
  }
  log(`using GL account ${glAccount.id} (${glAccount.code})`);

  const workOrder = await prisma.workOrder.create({
    data: {
      woNumber: `WO-SMOKE-${Date.now()}`,
      productId: product.id,
      plannedQuantity: 10,
      plannedStartDate: new Date("2024-01-01"),
      plannedEndDate: new Date("2024-01-31"),
    },
    select: { id: true, woNumber: true },
  });
  log(`seeded work order ${workOrder.id}`);

  const fixedAsset = await prisma.fixedAsset.create({
    data: {
      assetCode: `FA-SMOKE-${Date.now()}`,
      name: "Smoke Machine",
      category: "MACHINERY",
      purchaseDate: new Date("2024-01-01"),
      cost: 100000,
      salvageValue: 10000,
      usefulLifeMonths: 60,
      method: "STRAIGHT_LINE",
      accumulatedDepreciation: 0,
      bookValue: 100000,
    },
    select: { id: true, assetCode: true },
  });
  log(`seeded fixed asset ${fixedAsset.id}`);

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

  const created = {};

  await smoke("POST /api/v2/commercial/quotations — create", async () => {
    const r = await request("POST", "/api/v2/commercial/quotations", {
      quoteNumber: `QT-SMOKE-${Date.now()}`,
      customerId: customer.id,
      customerName: "Smoke Client",
      estimatedCost: 1000,
      quotedPrice: 1500,
      lines: [{ productId: product.id, plannedQty: 1, unitPrice: 1500, subtotal: 1500 }],
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
    created.quotationId = r.body.quotation?.id;
    if (!created.quotationId) throw new Error("no quotation id in response");
  });

  await smoke("POST /api/v2/commercial/quotations/[id]/action — SEND", async () => {
    if (!created.quotationId) throw new Error("no quotationId");
    const r = await request("POST", `/api/v2/commercial/quotations/${created.quotationId}/action`, {
      quotationId: created.quotationId,
      action: { action: "SEND" },
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/commercial/sales-orders — create", async () => {
    const r = await request("POST", "/api/v2/commercial/sales-orders", {
      orderNumber: `SO-SMOKE-${Date.now()}`,
      customerId: customer.id,
      customerName: "Smoke Client",
      lines: [{ productName: "Test", quantity: 1, unitPrice: 100 }],
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
    created.salesOrderId = r.body.salesOrder?.id;
    if (!created.salesOrderId) throw new Error("no salesOrder id in response");
  });

  await smoke("POST /api/v2/commercial/sales-orders/[id]/action — CONFIRM", async () => {
    if (!created.salesOrderId) throw new Error("no salesOrderId");
    const r = await request("POST", `/api/v2/commercial/sales-orders/${created.salesOrderId}/action`, {
      salesOrderId: created.salesOrderId,
      action: { action: "CONFIRM" },
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/commercial/invoices — create", async () => {
    const r = await request("POST", "/api/v2/commercial/invoices", {
      invoiceNumber: `INV-SMOKE-${Date.now()}`,
      customerName: "Smoke Client",
      taxableValue: 100,
      lines: [{ taxableValue: 100, cgstPct: 9, sgstPct: 9, igstPct: 0 }],
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
    created.invoiceId = r.body.invoice?.id;
    if (!created.invoiceId) throw new Error("no invoice id in response");
  });

  await smoke("POST /api/v2/commercial/invoices/[id]/action — SEND", async () => {
    if (!created.invoiceId) throw new Error("no invoiceId");
    const r = await request("POST", `/api/v2/commercial/invoices/${created.invoiceId}/action`, {
      invoiceId: created.invoiceId,
      action: { action: "SEND" },
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/commercial/invoices/[id]/action — MARK_PARTIAL", async () => {
    if (!created.invoiceId) throw new Error("no invoiceId");
    const r = await request("POST", `/api/v2/commercial/invoices/${created.invoiceId}/action`, {
      invoiceId: created.invoiceId,
      action: { action: "MARK_PARTIAL", amount: 50 },
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/commercial/payments — create", async () => {
    const r = await request("POST", "/api/v2/commercial/payments", {
      invoiceId: created.invoiceId,
      amount: 50,
      method: "CASH",
      receivedBy: "Smoke User",
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
    created.paymentId = r.body.payment?.id;
    if (!created.paymentId) throw new Error("no payment id in response");
  });

  await smoke("POST /api/v2/commercial/payments/[id]/action — CLEAR", async () => {
    if (!created.paymentId) throw new Error("no paymentId");
    const r = await request("POST", `/api/v2/commercial/payments/${created.paymentId}/action`, {
      paymentId: created.paymentId,
      action: { action: "CLEAR", clearedAt: new Date().toISOString() },
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/commercial/dispatch — create", async () => {
    const r = await request("POST", "/api/v2/commercial/dispatch", {
      challanNumber: `CH-SMOKE-${Date.now()}`,
      workOrderId: workOrder.id,
      dispatchedQty: 5,
      vehicleNumber: "MH-01-SMOKE",
      driverName: "Smoke Driver",
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
    created.dispatchId = r.body.dispatch?.id;
    if (!created.dispatchId) throw new Error("no dispatch id in response");
  });

  await smoke("POST /api/v2/finance/treasury — reconcile", async () => {
    const r = await request("POST", "/api/v2/finance/treasury", {
      bankAccountId: "ACC-SMOKE-1",
      statement: [{ date: new Date().toISOString().split("T")[0], description: "SmokeEntry", amount: 1000, reference: "ST-1" }],
      book: [{ date: new Date().toISOString().split("T")[0], description: "SmokeEntry", amount: 1000, reference: "BK-1" }],
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/finance/fixed-assets — book depreciation", async () => {
    const r = await request("POST", "/api/v2/finance/fixed-assets", {
      assetId: fixedAsset.id,
      period: "2024-01",
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await smoke("POST /api/v2/finance/journal-entries — post", async () => {
    const r = await request("POST", "/api/v2/finance/journal-entries", {
      entryNumber: `JE-SMOKE-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      memo: "Smoke test entry",
      source: "MANUAL",
      lines: [
        { accountId: glAccount.id, side: "DEBIT", amount: 10000 },
        { accountId: glAccount.id, side: "CREDIT", amount: 10000 },
      ],
    });
    if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
    created.journalEntryId = r.body.journalEntry?.id;
    if (!created.journalEntryId) throw new Error("no journalEntry id in response");
  });

  await smoke("POST /api/v2/finance/journal-entries/[id]/action — reverse", async () => {
    if (!created.journalEntryId) throw new Error("no journalEntryId");
    const r = await request("POST", `/api/v2/finance/journal-entries/${created.journalEntryId}/action`, {
      journalEntryId: created.journalEntryId,
      reason: "Smoke test reversal",
    });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  log("shutting down server...");
  server.kill("SIGTERM");

  log(`\n=== SMOKE RESULTS ===`);
  results.tests.forEach((t) => log(`${t.status}: ${t.name}${t.error ? ` — ${t.error}` : ""}`));
  log(`total: ${results.pass + results.fail} | pass: ${results.pass} | fail: ${results.fail}`);

  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
