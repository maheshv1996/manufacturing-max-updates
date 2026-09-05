#!/usr/bin/env node
/**
 * C6-6 — Real-DB smoke test for v2 commercial + finance transaction adapters.
 * Exercises the core C6-5 engines against mfgmax_v2_test without HTTP layer.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  createQuotation,
  transitionQuotationTx,
  createSalesOrder,
  transitionSalesOrderTx,
  createInvoice,
  transitionInvoiceTx,
  createPayment,
  transitionPaymentTx,
  createDispatch,
} from "../src/lib/commercial/commercialTx.ts";
import {
  postJournalEntryTx,
  reverseJournalEntryTx,
  reconcileBankTx,
  bookDepreciationTx,
} from "../src/lib/finance/financeTx.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

function log(msg) { console.log(`[smoke-adapters] ${msg}`); }

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

async function main() {
  await prisma.$connect();
  log("connected to DB");

  // Seed prerequisites
  const product = await prisma.product.create({
    data: { sku: `SKU-SMOKE-${Date.now()}`, name: "Smoke Product", unit: "PCS", sellingPricePerUnit: 1500, materialCostPerUnit: 1000 },
  });
  log(`created product ${product.id}`);

  const customer = await prisma.customer.create({
    data: { name: "Smoke Client", type: "DOMESTIC", isActive: true },
  });
  log(`created customer ${customer.id}`);

  let glAccount = await prisma.glAccount.findFirst();
  if (!glAccount) {
    glAccount = await prisma.glAccount.create({
      data: { code: "4000", name: "Smoke Revenue", type: "REVENUE", normalBalance: "CREDIT" },
    });
  }
  log(`using GL account ${glAccount.id} (${glAccount.code})`);

  const actor = { id: "smoke-user", name: "Smoke User" };

  // Quotation
  await smoke("createQuotation", async () => {
    const r = await createQuotation(prisma, {
      actor,
      quoteNumber: `QT-SMOKE-${Date.now()}`,
      customerName: "Smoke Client",
      estimatedCost: 1000,
      quotedPrice: 1500,
      lines: [{ productId: product.id, plannedQty: 1, unitPrice: 1500, subtotal: 1500 }],
    });
    if (!r.id) throw new Error("no id");
    created.quotationId = r.id;
  });

  await smoke("transitionQuotation SEND", async () => {
    if (!created.quotationId) throw new Error("no quotationId");
    const r = await transitionQuotationTx(prisma, {
      actor,
      quotationId: created.quotationId,
      action: { action: "SEND" },
    });
    if (!r.id) throw new Error(`unexpected: ${JSON.stringify(r)}`);
  });

  // Sales Order
  await smoke("createSalesOrder", async () => {
    const r = await createSalesOrder(prisma, {
      actor,
      orderNumber: `SO-SMOKE-${Date.now()}`,
      customerId: customer.id,
      customerName: "Smoke Client",
      lines: [{ productName: "Test", quantity: 1, unitPrice: 100 }],
    });
    if (!r.id) throw new Error("no id");
    created.salesOrderId = r.id;
  });

  await smoke("transitionSalesOrder CONFIRM", async () => {
    if (!created.salesOrderId) throw new Error("no salesOrderId");
    const r = await transitionSalesOrderTx(prisma, {
      actor,
      salesOrderId: created.salesOrderId,
      action: { action: "CONFIRM" },
    });
    if (!r.id) throw new Error(`unexpected: ${JSON.stringify(r)}`);
  });

  // Invoice
  await smoke("createInvoice", async () => {
    const r = await createInvoice(prisma, {
      actor,
      invoiceNumber: `INV-SMOKE-${Date.now()}`,
      customerName: "Smoke Client",
      taxableValue: 100,
      lines: [{ taxableValue: 100, cgstPct: 9, sgstPct: 9, igstPct: 0 }],
    });
    if (!r.id) throw new Error("no id");
    created.invoiceId = r.id;
  });

  await smoke("transitionInvoice SEND", async () => {
    if (!created.invoiceId) throw new Error("no invoiceId");
    const r = await transitionInvoiceTx(prisma, {
      actor,
      invoiceId: created.invoiceId,
      action: { action: "SEND" },
    });
    if (!r.id) throw new Error(`unexpected: ${JSON.stringify(r)}`);
  });

  await smoke("transitionInvoice MARK_PARTIAL", async () => {
    if (!created.invoiceId) throw new Error("no invoiceId");
    const r = await transitionInvoiceTx(prisma, {
      actor,
      invoiceId: created.invoiceId,
      action: { action: "MARK_PARTIAL", amount: 50 },
    });
    if (!r.id) throw new Error(`unexpected: ${JSON.stringify(r)}`);
  });

  // Payment
  await smoke("createPayment", async () => {
    const r = await createPayment(prisma, {
      actor,
      invoiceId: created.invoiceId,
      amount: 50,
      method: "CASH",
      receivedBy: "Smoke User",
    });
    if (!r.id) throw new Error("no id");
    created.paymentId = r.id;
  });

  // Finance: Journal Entry
  await smoke("postJournalEntryTx", async () => {
    const r = await postJournalEntryTx(prisma, {
      actor,
      entryNumber: `JE-SMOKE-${Date.now()}`,
      date: new Date().toISOString(),
      memo: "Smoke test entry",
      source: "MANUAL",
      lines: [
        { accountId: glAccount.id, side: "DEBIT", amount: 10000 },
        { accountId: glAccount.id, side: "CREDIT", amount: 10000 },
      ],
    });
    if (!r.id) throw new Error("no id");
    created.journalEntryId = r.id;
  });

  await smoke("reverseJournalEntryTx", async () => {
    if (!created.journalEntryId) throw new Error("no journalEntryId");
    const r = await reverseJournalEntryTx(prisma, {
      actor,
      journalEntryId: created.journalEntryId,
      reason: "Smoke reversal",
    });
    if (!r.id) throw new Error("no id");
  });

  // Payment transition
  await smoke("transitionPaymentTx CLEAR", async () => {
    if (!created.paymentId) throw new Error("no paymentId");
    const r = await transitionPaymentTx(prisma, {
      actor,
      paymentId: created.paymentId,
      action: { action: "CLEAR", clearedAt: new Date() },
    });
    if (!r.id) throw new Error(`unexpected: ${JSON.stringify(r)}`);
  });

  // Finance: Treasury reconcileBankTx (pure function through DB idempotency)
  await smoke("reconcileBankTx", async () => {
    const today = new Date().toISOString().split("T")[0];
    const r = await reconcileBankTx(prisma, {
      actor,
      clientId: customer.id,
      bankAccountId: "ACC-SMOKE-1",
      statement: [{ date: today, description: "SmokeEntry", amount: 1000, reference: "ST-1" }],
      book: [{ date: today, description: "SmokeEntry", amount: 1000, reference: "BK-1" }],
    });
    if (r.duplicate) throw new Error("duplicate");
    log(`reconcile result: ${JSON.stringify(r)}`);
    if (!r || r.matched.length !== 1) throw new Error(`expected 1 matched, got ${r?.matched?.length ?? 0}`);
  });

  // Finance: Fixed Assets bookDepreciationTx
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
  log(`created fixed asset ${fixedAsset.id}`);

  await smoke("bookDepreciationTx", async () => {
    const r = await bookDepreciationTx(prisma, {
      actor,
      assetId: fixedAsset.id,
      period: "2024-01",
    });
    if (r && "duplicate" in r && r.duplicate) throw new Error("duplicate");
    if (!r.id) throw new Error(`unexpected: ${JSON.stringify(r)}`);
  });

  await prisma.$disconnect();

  log(`\n=== SMOKE RESULTS ===`);
  results.tests.forEach((t) => log(`${t.status}: ${t.name}${t.error ? ` — ${t.error}` : ""}`));
  log(`total: ${results.pass + results.fail} | pass: ${results.pass} | fail: ${results.fail}`);

  process.exit(results.fail > 0 ? 1 : 0);
}

const created = {};
main().catch((e) => { console.error(e); process.exit(1); });
