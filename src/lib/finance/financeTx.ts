/**
 * C6-5 — Typed finance transaction adapters (DEPTH_04 W5/W6).
 * Every mutation runs the pure engine first and only then writes,
 * inside one `$transaction`, guarded by the C1 idempotency core when a
 * clientId is present, with in-tx audit rows. No `as any`; the engine is the
 * only source of truth for posting and reversals.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { AppError, notFound, validation } from "../core/errors";
import { runIdempotent } from "../core/integrityDb";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { postJournalEntry, reverseJournalEntry, type JournalLine } from "./glPosting";
import { reconcileBank } from "./treasury";
import { monthDepreciation } from "./fixedAssets";
import { periodForDate } from "./glCore";

type Tx = Prisma.TransactionClient;

async function audit(tx: Tx, actorName: string, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor || actorName,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface FinanceActor {
  id: string;
  name?: string;
}

async function withIdempotency<T>(
  db: PrismaClient,
  clientId: string | undefined,
  scope: string,
  fn: () => Promise<T>,
): Promise<{ duplicate: boolean; value?: T }> {
  if (!clientId?.trim()) return { duplicate: false, value: await fn() };
  const r = await runIdempotent(db, { clientId, scope }, fn);
  return r.applied ? { duplicate: false, value: r.value } : { duplicate: true };
}

// ------------------------------------------------------------------ JOURNAL ENTRY ----

export interface PostJournalEntryInput {
  actor: FinanceActor;
  clientId?: string;
  entryNumber: string;
  date: string; // ISO
  period?: string; // YYYY-MM
  memo: string;
  source: "MANUAL" | "VOUCHER" | "INVOICE" | "PAYMENT" | "DEPRECIATION" | "SYSTEM";
  sourceId?: string;
  lines: Array<{ accountId: string; side: "DEBIT" | "CREDIT"; amount: number; reference?: string; narration?: string }>;
}

export async function postJournalEntryTx(db: PrismaClient, input: PostJournalEntryInput) {
  const run = async () => {
    const period = input.period || periodForDate(new Date(input.date));
    const engineLines: JournalLine[] = input.lines.map((l) => ({
      accountCode: l.accountId,
      side: l.side,
      amount: Math.round(l.amount),
      narration: l.narration,
    }));
    const gate = postJournalEntry({
      date: input.date,
      period,
      narration: input.memo,
      lines: engineLines,
    });
    if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code, totalDebit: gate.totalDebit, totalCredit: gate.totalCredit } });

    const created = await db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber: input.entryNumber,
          date: new Date(input.date),
          period,
          memo: input.memo,
          status: "POSTED",
          source: input.source,
          sourceId: input.sourceId,
          totalDebit: gate.totalDebit,
          totalCredit: gate.totalCredit,
          createdBy: input.actor.id,
          postedBy: input.actor.id,
          postedAt: new Date(),
          lines: {
            create: input.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.side === "DEBIT" ? Math.round(l.amount) : 0,
              credit: l.side === "CREDIT" ? Math.round(l.amount) : 0,
              reference: l.reference,
              narration: l.narration,
            })),
          },
        },
        select: { id: true, entryNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Finance", {
        actor: input.actor.id,
        action: "JOURNAL_POSTED",
        entityType: "JournalEntry",
        entityId: entry.id,
        details: JSON.stringify({ entryNumber: entry.entryNumber, totalDebit: gate.totalDebit, totalCredit: gate.totalCredit }),
      });
      return entry;
    });
    return created;
  };
  const r = await withIdempotency(db, input.clientId, `finance:journal:post:${input.entryNumber}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface ReverseJournalEntryInput {
  actor: FinanceActor;
  clientId?: string;
  journalEntryId: string;
  reason: string;
}

export async function reverseJournalEntryTx(db: PrismaClient, input: ReverseJournalEntryInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const original = await tx.journalEntry.findUnique({
        where: { id: input.journalEntryId },
        select: { id: true, entryNumber: true, status: true, period: true, memo: true, lines: { select: { accountId: true, debit: true, credit: true, narration: true } } },
      });
      if (!original) throw notFound("Journal entry not found");
      if (original.status === "REVERSED") throw validation("Journal entry is already reversed");

      const engineLines: JournalLine[] = original.lines.map((l) => ({
        accountCode: l.accountId,
        side: l.debit > 0 ? "CREDIT" : "DEBIT",
        amount: l.debit > 0 ? l.debit : l.credit,
        narration: `Reversal: ${input.reason}`,
      }));

      const reversal = reverseJournalEntry({
        originalEntry: {
          date: new Date().toISOString().split("T")[0],
          period: original.period || periodForDate(new Date()),
          narration: original.memo,
          lines: engineLines,
        },
        reason: input.reason,
      });

      const reversed = await tx.journalEntry.create({
        data: {
          entryNumber: `REV-${original.entryNumber}`,
          date: new Date(reversal.date),
          period: reversal.period,
          memo: reversal.narration,
          status: "POSTED",
          source: "MANUAL",
          totalDebit: reversal.lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0),
          totalCredit: reversal.lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0),
          createdBy: input.actor.id,
          postedBy: input.actor.id,
          postedAt: new Date(),
          reversalOfId: original.id,
          lines: {
            create: reversal.lines.map((l) => ({
              accountId: l.accountCode,
              debit: l.side === "DEBIT" ? l.amount : 0,
              credit: l.side === "CREDIT" ? l.amount : 0,
              narration: l.narration,
            })),
          },
        },
        select: { id: true, entryNumber: true, status: true },
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: "REVERSED", reversedById: reversed.id },
        select: { id: true, status: true },
      });

      await audit(tx, input.actor.name ?? "Finance", {
        actor: input.actor.id,
        action: "JOURNAL_REVERSED",
        entityType: "JournalEntry",
        entityId: original.id,
        details: JSON.stringify({ originalEntryNumber: original.entryNumber, reversalEntryNumber: reversed.entryNumber, reason: input.reason }),
      });
      return reversed;
    });
  const r = await withIdempotency(db, input.clientId, `finance:journal:reverse:${input.journalEntryId}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------------------ TREASURY ----

export interface ReconcileBankInput {
  actor: FinanceActor;
  clientId?: string;
  bankAccountId: string;
  statement: Array<{ date: string; description: string; amount: number; reference?: string }>;
  book: Array<{ date: string; description: string; amount: number; reference?: string }>;
  tolerancePaise?: number;
}

export async function reconcileBankTx(db: PrismaClient, input: ReconcileBankInput) {
  const result = reconcileBank(input.statement, input.book, input.tolerancePaise ?? 0);
  const r = await withIdempotency(db, input.clientId, `finance:treasury:reconcile:${input.bankAccountId}`, async () => result);
  return r.duplicate ? { duplicate: true, result: undefined } : { ...r.value };
}

// ------------------------------------------------------------------ FIXED ASSETS ----

export interface BookDepreciationInput {
  actor: FinanceActor;
  clientId?: string;
  assetId: string;
  period: string; // YYYY-MM
}

export async function bookDepreciationTx(db: PrismaClient, input: BookDepreciationInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.findUnique({
        where: { id: input.assetId },
        select: { id: true, assetCode: true, name: true, cost: true, salvageValue: true, usefulLifeMonths: true, method: true, accumulatedDepreciation: true, bookValue: true, purchaseDate: true },
      });
      if (!asset) throw notFound("Fixed asset not found");

      const existing = await tx.assetDepreciationEntry.findUnique({
        where: { assetId_period: { assetId: input.assetId, period: input.period } },
      });
      if (existing) throw validation("Depreciation already booked for this period");

      const charge = monthDepreciation(
        { cost: asset.cost, salvageValue: asset.salvageValue, usefulLifeMonths: asset.usefulLifeMonths, method: asset.method as "STRAIGHT_LINE" | "WDV", purchaseDate: asset.purchaseDate },
        input.period,
        asset.accumulatedDepreciation,
      );

      const entry = await tx.assetDepreciationEntry.create({
        data: {
          assetId: input.assetId,
          period: input.period,
          amount: charge,
          bookedBy: input.actor.id,
        },
        select: { id: true, period: true, amount: true },
      });

      const newAccumulated = asset.accumulatedDepreciation + charge;
      const newBookValue = Math.max(0, asset.cost - newAccumulated);

      await tx.fixedAsset.update({
        where: { id: input.assetId },
        data: { accumulatedDepreciation: newAccumulated, bookValue: newBookValue },
        select: { id: true, accumulatedDepreciation: true, bookValue: true },
      });

      await audit(tx, input.actor.name ?? "Finance", {
        actor: input.actor.id,
        action: "DEPRECIATION_BOOKED",
        entityType: "FixedAsset",
        entityId: input.assetId,
        details: JSON.stringify({ assetCode: asset.assetCode, period: input.period, amount: charge, newBookValue }),
      });
      return entry;
    });
  const r = await withIdempotency(db, input.clientId, `finance:fixedasset:depreciate:${input.assetId}:${input.period}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}
