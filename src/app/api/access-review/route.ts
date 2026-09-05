import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { getAccessReviewState } from "@/lib/accessReview";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "system.view") && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const state = await getAccessReviewState();
    return NextResponse.json(state);
  } catch (error: any) {
    console.error("GET /api/access-review error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      );
    }
    const actor = user.name || headerList.get("x-user-name") || "Admin";

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;

    if (action === "create-cycle") {
      const { name, dueDate } = body;
      if (!name || !dueDate) {
        return NextResponse.json(
          { error: "Cycle name and due date required" },
          { status: 400 },
        );
      }
      const cycle = await prisma.$transaction(async (tx) => {
        const created = await tx.accessReviewCycle.create({
          data: {
            name,
            periodStart: new Date(),
            dueDate: new Date(dueDate),
            createdBy: actor,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "ACCESS_REVIEW_CYCLE_OPEN",
          entityType: "ACCESS_REVIEW",
          entityId: created.id,
          details: `Opened access review "${name}" due ${new Date(dueDate).toLocaleDateString()}`,
        });
        return created;
      });
      return NextResponse.json({ cycle }, { status: 201 });
    }

    if (action === "certify") {
      const { userId, depts, notes } = body;
      if (!userId || !Array.isArray(depts)) {
        return NextResponse.json(
          { error: "userId and depts[] required" },
          { status: 400 },
        );
      }
      const cycle = await prisma.accessReviewCycle.findFirst({
        where: { status: "OPEN" },
        orderBy: { dueDate: "desc" },
      });
      if (!cycle) {
        return NextResponse.json(
          { error: "No open access review cycle — create one first" },
          { status: 400 },
        );
      }
      if (cycle.dueDate < new Date()) {
        return NextResponse.json(
          {
            error:
              "Review cycle is past due — enforcements already ran; open a new cycle",
          },
          { status: 400 },
        );
      }
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (target.isOwner) {
        return NextResponse.json(
          { error: "Owners are outside the access review" },
          { status: 400 },
        );
      }
      const certification = await prisma.$transaction(async (tx) => {
        const up = await tx.accessCertification.upsert({
          where: { cycleId_userId: { cycleId: cycle.id, userId } },
          update: {
            depts,
            certifiedBy: actor,
            certifiedAt: new Date(),
            notes: notes || null,
          },
          create: {
            cycleId: cycle.id,
            userId,
            depts,
            certifiedBy: actor,
            notes: notes || null,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "ACCESS_CERTIFIED",
          entityType: "USER",
          entityId: userId,
          details: `Certified ${target.name} in "${cycle.name}" for ${depts.length} department(s): ${depts.join(", ")}${notes ? ` — ${notes}` : ""}`,
        });
        return up;
      });
      return NextResponse.json({ certification });
    }

    if (action === "drill") {
      const { backupJobId, backupName, result, durationSec, notes } = body;
      if (!backupName || !["PASS", "FAIL", "PARTIAL"].includes(result)) {
        return NextResponse.json(
          { error: "backupName and result (PASS|FAIL|PARTIAL) required" },
          { status: 400 },
        );
      }
      let sizeMb: number | null = null;
      if (backupJobId) {
        const job = await prisma.backupJob.findUnique({
          where: { id: backupJobId },
        });
        if (job) sizeMb = job.sizeMb ?? null;
      }
      const drill = await prisma.$transaction(async (tx) => {
        const created = await tx.restoreDrill.create({
          data: {
            performedBy: actor,
            backupJobId: backupJobId || null,
            backupName,
            backupSizeMb: sizeMb,
            result,
            durationSec: durationSec ? Number(durationSec) : null,
            verifiedAt: new Date(),
            notes: notes || null,
          },
          include: { backupJob: { select: { startedAt: true, status: true } } },
        });
        await logAuditTx(tx, {
          actor,
          action: "RESTORE_DRILL",
          entityType: "BACKUP",
          entityId: created.id,
          details: `Restore drill ${result} — restored "${backupName}"${durationSec ? ` in ${durationSec}s` : ""}${notes ? ` (${notes})` : ""}`,
        });
        return created;
      });
      return NextResponse.json({ drill }, { status: 201 });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("POST /api/access-review error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
