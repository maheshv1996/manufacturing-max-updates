import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { applyJobAction } from "@/lib/shopfloor/applyJobAction";

export const dynamic = "force-dynamic";

const meta = {
  clientId: z.string().trim().min(1).max(128).optional(),
  clientTimestamp: z.number().int().positive().optional(),
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("START_JOB"),
    workOrderId: z.string().trim().min(1),
    machineId: z.string().trim().min(1),
    operatorId: z.string().trim().min(1).optional().nullable(),
    shiftId: z.string().trim().min(1).optional().nullable(),
    // Fixture/readiness override — requires ops.approve (checked below).
    overrideReason: z.string().trim().min(1).optional(),
    ...meta,
  }),
  z.object({
    action: z.enum(["LOG_GOOD", "LOG_SCRAP", "LOG_REWORK"]),
    workOrderId: z.string().trim().min(1),
    machineId: z.string().trim().min(1),
    qty: z.number().int().positive(),
    defectCode: z.string().trim().min(1).optional(),
    operatorId: z.string().trim().min(1).optional().nullable(),
    shiftId: z.string().trim().min(1).optional().nullable(),
    ...meta,
  }),
  z.object({
    action: z.literal("REPORT_DOWNTIME"),
    machineId: z.string().trim().min(1),
    reasonId: z.string().trim().min(1),
    workOrderId: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
    operatorId: z.string().trim().min(1).optional().nullable(),
    ...meta,
  }),
  z.object({
    action: z.literal("END_DOWNTIME"),
    machineId: z.string().trim().min(1),
    ...meta,
  }),
  z.object({
    action: z.enum(["SETUP", "RUN", "CHANGEOVER"]),
    machineId: z.string().trim().min(1),
    operatorId: z.string().trim().min(1).optional().nullable(),
    ...meta,
  }),
  z.object({
    action: z.literal("COMPLETE_JOB"),
    workOrderId: z.string().trim().min(1),
    machineId: z.string().trim().min(1).optional().nullable(),
    // Authorized short-closure — requires ops.approve (checked below).
    overrideReason: z.string().trim().min(1).optional(),
    ...meta,
  }),
]);

function requireAuth(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id) throw forbidden("Authentication required");
}

/** POST — apply a shopfloor action (operator terminal / service). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireAuth(user);

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(actionSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    // Override paths (fixture gate / short closure) need ops.approve authority;
    // the adapter still requires a written reason regardless.
    if ((a.action === "START_JOB" || a.action === "COMPLETE_JOB") && a.overrideReason) {
      if (!can(user, "ops.approve")) {
        throw forbidden("ops.approve required for overrides");
      }
    }

    const result = await applyJobAction(prisma, {
      action: a.action,
      actorId: user.id,
      actorName: user.name ?? undefined,
      clientId: a.clientId,
      clientTimestamp: a.clientTimestamp,
      workOrderId: "workOrderId" in a ? a.workOrderId : undefined,
      machineId: "machineId" in a ? a.machineId : undefined,
      operatorId: "operatorId" in a ? a.operatorId ?? null : undefined,
      shiftId: "shiftId" in a ? a.shiftId ?? null : undefined,
      qty: "qty" in a ? a.qty : undefined,
      defectCode: "defectCode" in a ? a.defectCode : undefined,
      reasonId: "reasonId" in a ? a.reasonId : undefined,
      notes: "notes" in a ? a.notes ?? null : undefined,
      overrideReason: "overrideReason" in a ? a.overrideReason : undefined,
    });

    if (result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Action already processed (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, message: result.message });
  } catch (e) {
    const api = toApiError(e);
    const stateConflict = api.details?.stateConflict === true;
    const status =
      api.error === "FORBIDDEN" ? 403
        : api.error === "NOT_FOUND" ? 404
          : api.error === "VALIDATION" ? 422
            : stateConflict ? 412
              : api.error === "CONFLICT" ? 409
                : 400;
    return NextResponse.json(api, { status });
  }
}
