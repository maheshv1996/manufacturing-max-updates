/**
 * C12 — System Settings & Terminology Typed Transaction Adapter (DEPTH_03 F12).
 * Strictly typed database transactions over Prisma:
 *   - getTerminologyMapTx, updateTerminologyMapTx
 *   - getSystemConstantsTx, updateSystemConstantsTx
 * Single Prisma $transaction mutations with in-tx auditLog.create via buildAuditEvent.
 */
import type { PrismaClient } from "@prisma/client";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { validation } from "../core/errors";
import {
  DEFAULT_TERMINOLOGY,
  validateTerminologyOverrides,
  type TerminologyMap,
} from "./terminologyEngine";

type Tx = import("@prisma/client").Prisma.TransactionClient;

async function audit(tx: Tx, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
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
}

export interface SettingsActor {
  id: string;
  name?: string;
}

export async function getTerminologyMapTx(
  db: PrismaClient,
): Promise<{ effective: TerminologyMap; overrides: TerminologyMap }> {
  const row = await db.setting.findUnique({
    where: { key: "org_terminology_config" },
  });

  let overrides: TerminologyMap = {};
  if (row?.value) {
    try {
      overrides = JSON.parse(row.value) as TerminologyMap;
    } catch {
      overrides = {};
    }
  }

  const effective: TerminologyMap = {
    ...DEFAULT_TERMINOLOGY,
    ...overrides,
  };

  return { effective, overrides };
}

export async function updateTerminologyMapTx(
  db: PrismaClient,
  rawOverrides: unknown,
  actor: SettingsActor,
) {
  const check = validateTerminologyOverrides(rawOverrides);
  if (!check.valid || !check.sanitized) {
    throw validation(check.error || "Invalid terminology overrides");
  }

  const sanitized = check.sanitized ?? {};

  return await db.$transaction(async (tx) => {
    const setting = await tx.setting.upsert({
      where: { key: "org_terminology_config" },
      update: { value: JSON.stringify(sanitized) },
      create: {
        key: "org_terminology_config",
        value: JSON.stringify(sanitized),
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "TERMINOLOGY_UPDATED",
      entityType: "Setting",
      entityId: setting.key,
      details: JSON.stringify({ overriddenKeys: Object.keys(sanitized) }),
    });

    return { success: true, overrides: sanitized };
  });
}

export interface SystemConstantsConfig {
  oeeTargetPct: number;
  countTolerancePct: number;
  requireMillCerts: boolean;
  maxOvertimeHoursWeekly: number;
  defaultTimezone: string;
  currencyCode: string;
}

export const DEFAULT_SYSTEM_CONSTANTS: SystemConstantsConfig = {
  oeeTargetPct: 85.0,
  countTolerancePct: 2.0,
  requireMillCerts: true,
  maxOvertimeHoursWeekly: 12,
  defaultTimezone: "Asia/Kolkata",
  currencyCode: "INR",
};

export async function getSystemConstantsTx(
  db: PrismaClient,
): Promise<SystemConstantsConfig> {
  const row = await db.setting.findUnique({
    where: { key: "system_constants" },
  });

  if (!row?.value) {
    return DEFAULT_SYSTEM_CONSTANTS;
  }

  try {
    const parsed = JSON.parse(row.value) as Partial<SystemConstantsConfig>;
    return { ...DEFAULT_SYSTEM_CONSTANTS, ...parsed };
  } catch {
    return DEFAULT_SYSTEM_CONSTANTS;
  }
}

export async function updateSystemConstantsTx(
  db: PrismaClient,
  input: Partial<SystemConstantsConfig>,
  actor: SettingsActor,
) {
  const current = await getSystemConstantsTx(db);
  const merged: SystemConstantsConfig = {
    ...current,
    ...input,
  };

  return await db.$transaction(async (tx) => {
    const setting = await tx.setting.upsert({
      where: { key: "system_constants" },
      update: { value: JSON.stringify(merged) },
      create: {
        key: "system_constants",
        value: JSON.stringify(merged),
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "SYSTEM_CONSTANTS_UPDATED",
      entityType: "Setting",
      entityId: setting.key,
      details: JSON.stringify(input),
    });

    return merged;
  });
}
