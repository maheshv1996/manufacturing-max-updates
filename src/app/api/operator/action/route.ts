import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { checkFixtureGate } from "@/lib/fixtureGate";
import { requireManagerLevel } from "@/lib/managerGate";
import { computeCalibrationStatus } from "@/lib/calibration";
import { getUserFromHeaders } from "@/lib/permissions";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";
import { nextSequenceTx } from "@/lib/sequence";

async function incrementAssignedToolCyclesTx(
  tx: any,
  machineId: string,
  addCycles: number,
) {
  try {
    const assignedTools = await tx.tool.findMany({
      where: { assignedMachineId: machineId, status: { not: "RETIRED" } },
    });
    for (const t of assignedTools) {
      const newCycles = t.currentCycles + addCycles;
      const wearPct = (newCycles / t.maxLifeCycles) * 100;
      let newStatus = t.status;
      if (wearPct >= 100) newStatus = "MAINTENANCE";
      else if (wearPct >= (t.warningThreshold || 85.0)) newStatus = "WARNING";
      else newStatus = "ACTIVE";
      await tx.tool.update({ where: { id: t.id }, data: { currentCycles: newCycles, status: newStatus } });
    }
  } catch (err) {
    console.error("Tool cycle increment error:", err);
  }
}

async function incrementMaintenanceToolUnitsTx(
  tx: any,
  machineId: string,
  addUnits: number,
) {
  try {
    const mTools = await tx.maintenanceTool.findMany({ where: { machineId } });
    for (const t of mTools) {
      const newUsed = t.usedUnits + addUnits;
      await tx.maintenanceTool.update({ where: { id: t.id }, data: { usedUnits: newUsed } });
    }
  } catch (err) {
    console.error("MaintenanceTool unit increment error:", err);
  }
}

// Backwards compat shim — retained for non-tx callers (e.g., legacy REPORT_DOWNTIME); suppress unused warning
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function incrementAssignedToolCycles(machineId: string, addCycles: number) {
  try {
    const assignedTools = await (prisma as any).tool.findMany({ where: { assignedMachineId: machineId, status: { not: "RETIRED" } } });
    for (const t of assignedTools) {
      const newCycles = t.currentCycles + addCycles;
      const wearPct = (newCycles / t.maxLifeCycles) * 100;
      let newStatus = t.status;
      if (wearPct >= 100) newStatus = "MAINTENANCE";
      else if (wearPct >= (t.warningThreshold || 85.0)) newStatus = "WARNING";
      else newStatus = "ACTIVE";
      await (prisma as any).tool.update({ where: { id: t.id }, data: { currentCycles: newCycles, status: newStatus } });
    }
  } catch (err) { console.error("Tool cycle increment error:", err); }
}
void incrementAssignedToolCycles;

// incrementMaintenanceToolUnits shim removed — use Tx variant inside transactions

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;
    const headerList = await headers();

    const clientId: string | null = (body.clientId ? String(body.clientId).trim() : null) || (headerList.get("x-client-id") ? String(headerList.get("x-client-id")!).trim() : null);
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Action already processed (idempotent duplicate request ignored)" });
      }
    }

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter is required" },
        { status: 400 },
      );
    }

    const rawClientTime =
      body.clientTimestamp || headerList.get("x-client-timestamp");
    const clientTimestamp = rawClientTime
      ? parseInt(String(rawClientTime), 10)
      : null;

    // Safety Gate: Certification Check
    const requiresCert = ["START_JOB", "LOG_GOOD"];
    if (requiresCert.includes(action)) {
      const opId = body.operatorId;
      const mId = body.machineId;
      if (opId && mId) {
        const cert = await prisma.certification.findUnique({
          where: { userId_machineId: { userId: opId, machineId: mId } },
        });
        const now = new Date();
        const validUntil = cert?.validUntil ? new Date(cert.validUntil) : null;
        const isCertified = cert?.isActive && (!validUntil || validUntil > now);

        if (!isCertified) {
          await logAudit({
            actor: headerList.get("x-user-name") || "Operator",
            action: "CERTIFICATION_BLOCKED",
            entityType: "MACHINE",
            entityId: mId,
            details: `Unauthorized attempt to perform ${action} without valid certification.`,
          });
          return NextResponse.json(
            {
              error:
                "Safety Gate Active: You are not certified to operate this machine.",
            },
            { status: 403 },
          );
        }
      }
    }

    switch (action) {
      case "START_JOB": {
        const { workOrderId, machineId, operatorId, shiftId } = body;
        if (!workOrderId || !machineId) {
          return NextResponse.json(
            { error: "Work Order ID and Machine ID are required to start job" },
            { status: 400 },
          );
        }

        // P4 — Tooling & Fixture gate: WO cannot start unless the product's
        // fixture is AVAILABLE. Managers may override with a written reason
        // (audited FIXTURE_OVERRIDE).
        const fixtureGate = await checkFixtureGate(workOrderId);
        if (fixtureGate.blocked) {
          const overrideReason = body.fixtureOverrideReason
            ? String(body.fixtureOverrideReason).trim()
            : "";
          const opUser = getUserFromHeaders(headerList);
          const managerOk = await requireManagerLevel(opUser);
          if (!overrideReason || !managerOk.ok) {
            return NextResponse.json(
              {
                error: fixtureGate.error,
                fixture: fixtureGate.fixture,
                code: "FIXTURE_BLOCKED",
              },
              { status: 403 },
            );
          }
          // Manager override — proceed and audit.
          await logAudit({
            actor: opUser.name || "Operator",
            action: "FIXTURE_OVERRIDE",
            entityType: "FIXTURE",
            entityId: fixtureGate.fixture?.id || "unknown",
            details: `WO ${workOrderId} started despite ${fixtureGate.fixture?.code} (${fixtureGate.fixture?.status}) — ${overrideReason}`,
          });
        }

        // State Locking + atomic START_JOB (single transaction, idempotent)
        const startJobResult = await prisma.$transaction(async (tx) => {
          if (clientId) {
            const reserved = await reserveIdempotency(tx as any, clientId, "/api/operator/action:START_JOB");
            if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
          }

          if (clientTimestamp) {
            const targetMachine = await (tx as any).machine.findUnique({ where: { id: machineId } });
            if (targetMachine && targetMachine.updatedAt.getTime() > clientTimestamp + 3000) {
              throw Object.assign(
                new Error(`State Conflict: Machine '${targetMachine.name}' status (${targetMachine.status}) was updated by another terminal. Preserved server authority.`),
                { code: "STATE_CONFLICT", serverTimestamp: targetMachine.updatedAt.getTime() },
              );
            }
          }

          await (tx as any).workOrder.update({ where: { id: workOrderId }, data: { status: "IN_PROGRESS" } });
          await (tx as any).productionLog.create({
            data: {
              workOrderId,
              machineId,
              operatorId: operatorId || null,
              shiftId: shiftId || null,
              goodQuantity: 0,
              scrapQuantity: 0,
              reworkQuantity: 0,
              startTime: new Date(),
            },
          });
          await (tx as any).machine.update({ where: { id: machineId }, data: { status: "RUNNING" } });
          await (tx as any).auditLog.create({
            data: {
              actor: headerList.get("x-user-name") || "Operator",
              action: "START_JOB",
              entityType: "MACHINE",
              entityId: machineId,
              details: `Started job for WO ${workOrderId} on machine ${machineId}`,
            },
          });
          // Fixture override already audited outside tx (best-effort)
          return { ok: true };
        }).catch((e: any) => {
          if (e?.code === "STATE_CONFLICT") {
            return { conflict: true, message: e.message, serverTimestamp: e.serverTimestamp } as any;
          }
          if (e?.code === "DUPLICATE") throw e;
          throw e;
        });

        if ((startJobResult as any)?.conflict) {
          return NextResponse.json(
            { conflict: true, message: (startJobResult as any).message, serverTimestamp: (startJobResult as any).serverTimestamp },
            { status: 412 },
          );
        }

        const payloadStart = { success: true, message: "Job started successfully" };
        if (clientId) await completeIdempotency(clientId, payloadStart);
        return NextResponse.json(payloadStart);
      }

      case "LOG_GOOD": {
        const {
          workOrderId,
          machineId,
          operatorId,
          shiftId,
          quantity,
          serialInput,
          serialCaptureType,
        } = body;
        const addQty = Number(quantity);

        if (!workOrderId || !machineId || !addQty || addQty <= 0) {
          return NextResponse.json(
            {
              error:
                "Valid Work Order ID, Machine ID, and Positive Quantity required",
            },
            { status: 400 },
          );
        }

        const woInfo = await prisma.workOrder.findUnique({
          where: { id: workOrderId },
          include: { faiReports: true },
        });

        if (!woInfo) {
          return NextResponse.json(
            { error: "Work Order not found" },
            { status: 404 },
          );
        }

        if (woInfo.faiRequired) {
          const hasApprovedFai = woInfo.faiReports.some(
            (r) => r.status === "APPROVED",
          );
          if (!hasApprovedFai) {
            return NextResponse.json(
              {
                error:
                  "An Approved FAI Report is required before logging production.",
              },
              { status: 403 },
            );
          }
        }

        // Atomic LOG_GOOD: log increment + tool life + serials + audit in one transaction, idempotent
        await prisma.$transaction(async (tx) => {
          if (clientId) {
            const reserved = await reserveIdempotency(tx as any, clientId, "/api/operator/action:LOG_GOOD");
            if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
          }

          let activeLog = await (tx as any).productionLog.findFirst({
            where: { workOrderId, machineId, endTime: null },
            orderBy: { startTime: "desc" },
          });

          if (!activeLog) {
            activeLog = await (tx as any).productionLog.create({
              data: {
                workOrderId,
                machineId,
                operatorId: operatorId || null,
                shiftId: shiftId || null,
                goodQuantity: addQty,
                scrapQuantity: 0,
                reworkQuantity: 0,
                startTime: new Date(),
              },
            });
          } else {
            await (tx as any).productionLog.update({
              where: { id: activeLog.id },
              data: { goodQuantity: { increment: addQty } },
            });
          }

          await incrementAssignedToolCyclesTx(tx as any, machineId, addQty);
          await incrementMaintenanceToolUnitsTx(tx as any, machineId, addQty);

          const wo = await (tx as any).workOrder.findUnique({ where: { id: workOrderId } });
          if (wo && wo.trackingMode === "SERIAL") {
            let serialsToCreate: string[] = [];
            if (serialCaptureType === "MANUAL" && serialInput) {
              serialsToCreate = serialInput.split(",").map((s: string) => s.trim()).filter(Boolean);
            } else if (serialCaptureType === "AUTO") {
              const currentUnits = await (tx as any).serialUnit.count({ where: { workOrderId } });
              for (let i = 0; i < addQty; i++) {
                serialsToCreate.push(`${wo.woNumber}-S${(currentUnits + i + 1).toString().padStart(3, "0")}`);
              }
            }
            const actorName = headerList.get("x-user-name") || "Operator";
            for (const s of serialsToCreate) {
              const unit = await (tx as any).serialUnit.upsert({
                where: { serialNo: s },
                create: { serialNo: s, workOrderId, productId: wo.productId, status: "WIP" },
                update: { status: "WIP" },
              });
              await (tx as any).serialEvent.create({
                data: { serialUnitId: unit.id, type: "OPERATION_COMPLETE", description: `Operation completed on machine ${machineId}`, actorName },
              });
            }
            if (serialsToCreate.length > 0) {
              await (tx as any).auditLog.create({
                data: {
                  actor: headerList.get("x-user-name") || "Operator",
                  action: "SERIAL_CREATED",
                  entityType: "WORK_ORDER",
                  entityId: workOrderId,
                  details: `Created/Updated ${serialsToCreate.length} serials for WO ${wo.woNumber}`,
                },
              });
            }
          }

          await (tx as any).auditLog.create({
            data: {
              actor: headerList.get("x-user-name") || "Operator",
              action: "LOG_GOOD",
              entityType: "MACHINE",
              entityId: machineId,
              details: `Logged ${addQty} good units for WO ${workOrderId}`,
            },
          });
        }).catch((e: any) => {
          if (e?.code === "DUPLICATE") throw e;
          throw e;
        });

        const payloadGood = { success: true, message: `Logged ${addQty} good units` };
        if (clientId) await completeIdempotency(clientId, payloadGood);
        return NextResponse.json(payloadGood);
      }

      case "LOG_SCRAP": {
        const {
          workOrderId,
          machineId,
          operatorId,
          shiftId,
          quantity,
          defectCodeId,
          notes,
          scrappedSerialNo,
          calibratedToolId,
        } = body;
        const addQty = Number(quantity);

        if (!workOrderId || !machineId || !addQty || addQty <= 0) {
          return NextResponse.json(
            {
              error:
                "Valid Work Order ID, Machine ID, and Positive Quantity required",
            },
            { status: 400 },
          );
        }

        // --- CALIBRATION ENFORCEMENT (Nadcap) ---
        // Aerospace (SERIAL) inspections require the calibrated tool used;
        // an EXPIRED tool HARD-BLOCKS the inspection.
        const wo = await prisma.workOrder.findUnique({
          where: { id: workOrderId },
        });
        if (defectCodeId && wo && wo.trackingMode === "SERIAL") {
          if (!calibratedToolId) {
            return NextResponse.json(
              {
                error:
                  "Calibrated tool required for aerospace (SERIAL) inspections",
                code: "CALIBRATION_TOOL_REQUIRED",
              },
              { status: 400 },
            );
          }
          const tool = await prisma.calibratedTool.findUnique({
            where: { id: calibratedToolId },
          });
          if (!tool) {
            return NextResponse.json(
              { error: "Calibrated tool not found" },
              { status: 400 },
            );
          }
          if (computeCalibrationStatus(tool.expiresAt) === "EXPIRED") {
            await prisma.auditLog.create({
              data: {
                actor: headerList.get("x-user-name") || "Operator",
                action: "CALIBRATION_BLOCKED",
                entityType: "QUALITY_INSPECTION",
                entityId: workOrderId,
                details: `Inspection blocked: tool ${tool.name} (${tool.serialNumber}) calibration EXPIRED (expired ${tool.expiresAt.toISOString()})`,
              },
            });
            return NextResponse.json(
              {
                error: "CALIBRATION EXPIRED - Inspection Invalid",
                code: "CALIBRATION_EXPIRED",
                toolName: tool.name,
                toolSerial: tool.serialNumber,
                expiresAt: tool.expiresAt,
              },
              { status: 403 },
            );
          }
        }

        // PR4: Atomic scrap transaction (productionLog + inspection + quarantine + tool + serial NCR) with idempotency
        const scrapPayload = await prisma.$transaction(async (tx) => {
          if (clientId) {
            const reserved = await reserveIdempotency(tx as any, clientId, "/api/operator/action:LOG_SCRAP");
            if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
          }

          // Re-read activeLog inside tx to avoid duplicate log creation race
          let activeLogTx = await (tx as any).productionLog.findFirst({
            where: { workOrderId, machineId, endTime: null },
            orderBy: { startTime: "desc" },
          });
          if (!activeLogTx) {
            activeLogTx = await (tx as any).productionLog.create({
              data: {
                workOrderId,
                machineId,
                operatorId: operatorId || null,
                shiftId: shiftId || null,
                goodQuantity: 0,
                scrapQuantity: addQty,
                reworkQuantity: 0,
                startTime: new Date(),
              },
            });
          } else {
            await (tx as any).productionLog.update({
              where: { id: activeLogTx.id },
              data: { scrapQuantity: { increment: addQty } },
            });
          }

          if (defectCodeId) {
            await (tx as any).qualityInspection.create({
              data: {
                workOrderId,
                inspectorId: operatorId || null,
                totalInspected: addQty,
                passed: 0,
                failed: addQty,
                defectCodeId,
                calibratedToolId: calibratedToolId || null,
                notes: notes || "Scrap logged by operator",
              },
            });
          }

          const quarantineRecordTx = await (tx as any).scrapQuarantine.create({
            data: {
              workOrderId,
              quantity: addQty,
              defectCode: defectCodeId || "DEFECT_GENERIC",
              loggedBy: headerList.get("x-user-name") || "Operator",
              status: "PENDING",
              dispositionNotes: notes || "Auto-quarantined from Operator Station scrap log.",
              costEstimate: addQty * 15.0,
            },
          });

          await incrementAssignedToolCyclesTx(tx as any, machineId, addQty);

          if (wo && wo.trackingMode === "SERIAL" && scrappedSerialNo) {
            const unit = await (tx as any).serialUnit.findUnique({ where: { serialNo: scrappedSerialNo } });
            if (unit) {
              await (tx as any).serialUnit.update({ where: { id: unit.id }, data: { status: "QUARANTINED" } });
              await (tx as any).serialEvent.create({
                data: {
                  serialUnitId: unit.id,
                  type: "NCR",
                  description: `Scrapped/Defected on machine ${machineId} (Code: ${defectCodeId || "Unknown"})`,
                  actorName: headerList.get("x-user-name") || "Operator",
                },
              });
              const ncrNo = await nextSequenceTx(tx as any, "NCR", 4);
              await (tx as any).ncrReport.create({
                data: {
                  ncrNumber: ncrNo,
                  quarantineId: quarantineRecordTx.id,
                  workOrderId: wo.id,
                  serialUnitId: unit.id,
                  productId: wo.productId,
                  quantity: 1,
                  defectCodeId: defectCodeId || null,
                  severity: "HIGH",
                  description: notes || `Auto-raised from Serial Quarantine (Unit: ${scrappedSerialNo})`,
                  status: "OPEN",
                  raisedBy: headerList.get("x-user-name") || "Operator",
                },
              });
              await (tx as any).auditLog.create({
                data: {
                  actor: headerList.get("x-user-name") || "Operator",
                  action: "NCR_RAISED",
                  entityType: "NCR",
                  entityId: quarantineRecordTx.id,
                  details: `Auto-raised NCR ${ncrNo} for Serial ${scrappedSerialNo}`,
                },
              });
              await (tx as any).auditLog.create({
                data: {
                  actor: headerList.get("x-user-name") || "Operator",
                  action: "SERIAL_QUARANTINED",
                  entityType: "WORK_ORDER",
                  entityId: workOrderId,
                  details: `Serial ${scrappedSerialNo} quarantined for WO ${wo.woNumber}`,
                },
              });
            }
          }

          await (tx as any).auditLog.create({
            data: {
              actor: headerList.get("x-user-name") || "Operator",
              action: "LOG_SCRAP",
              entityType: "MACHINE",
              entityId: machineId,
              details: `Logged ${addQty} scrap units for WO ${workOrderId}`,
            },
          });

          return { success: true, message: `Logged ${addQty} scrap units` };
        });

        if (clientId) await completeIdempotency(clientId, scrapPayload);
        return NextResponse.json(scrapPayload);
      }

      case "REPORT_DOWNTIME": {
        const { machineId, workOrderId, reasonId, notes, operatorId } = body;

        if (!machineId || !reasonId) {
          return NextResponse.json(
            {
              error: "Machine ID and Reason ID are required to report downtime",
            },
            { status: 400 },
          );
        }

        // Close any existing open downtime log first
        await prisma.downtimeLog.updateMany({
          where: { machineId, endTime: null },
          data: { endTime: new Date() },
        });

        // Create new open downtime log
        const downtimeLog = await prisma.downtimeLog.create({
          data: {
            machineId,
            workOrderId: workOrderId || null,
            reasonId,
            operatorId: operatorId || null,
            startTime: new Date(),
            endTime: null,
            notes: notes || null,
          },
        });

        // Set machine status to DOWN
        await prisma.machine.update({
          where: { id: machineId },
          data: { status: "DOWN" },
        });

        await logAudit({
          actor: headerList.get("x-user-name") || "Operator",
          action: "REPORT_DOWNTIME",
          entityType: "MACHINE",
          entityId: machineId,
          details: `Reported downtime for machine ${machineId}, reason ${reasonId}`,
        });

        return NextResponse.json({ success: true, downtimeLog });
      }

      case "END_DOWNTIME": {
        const { machineId, downtimeLogId } = body;

        if (!machineId) {
          return NextResponse.json(
            { error: "Machine ID is required to end downtime" },
            { status: 400 },
          );
        }

        const now = new Date();

        const openLog = downtimeLogId
          ? await prisma.downtimeLog.findUnique({
              where: { id: downtimeLogId },
            })
          : await prisma.downtimeLog.findFirst({
              where: { machineId, endTime: null },
              orderBy: { startTime: "desc" },
            });

        if (openLog) {
          const diffMs = now.getTime() - new Date(openLog.startTime).getTime();
          const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

          await prisma.downtimeLog.update({
            where: { id: openLog.id },
            data: {
              endTime: now,
              durationMinutes,
            },
          });
        }

        // Restore machine status to RUNNING
        await prisma.machine.update({
          where: { id: machineId },
          data: { status: "RUNNING" },
        });

        await logAudit({
          actor: headerList.get("x-user-name") || "Operator",
          action: "END_DOWNTIME",
          entityType: "MACHINE",
          entityId: machineId,
          details: `Ended downtime for machine ${machineId}`,
        });

        return NextResponse.json({
          success: true,
          message: "Downtime resolved",
        });
      }

      case "SETUP": {
        const { machineId, workOrderId, operatorId } = body;

        if (!machineId) {
          return NextResponse.json(
            { error: "Machine ID is required to start setup" },
            { status: 400 },
          );
        }

        // Close any open production log so setup time is not counted as run time
        await prisma.productionLog.updateMany({
          where: { machineId, endTime: null },
          data: { endTime: new Date() },
        });

        // Close any open downtime log too — setup is a productive activity
        await prisma.downtimeLog.updateMany({
          where: { machineId, endTime: null },
          data: { endTime: new Date() },
        });

        await prisma.machine.update({
          where: { id: machineId },
          data: { status: "SETUP", currentState: "SETUP" },
        });

        await logAudit({
          actor: headerList.get("x-user-name") || "Operator",
          action: "SETUP_STARTED",
          entityType: "MACHINE",
          entityId: machineId,
          details: workOrderId
            ? `Setup started for WO ${workOrderId} by ${operatorId || "unknown"}`
            : `Setup started on machine ${machineId}`,
        });

        return NextResponse.json({
          success: true,
          message: "Machine set to SETUP",
        });
      }

      case "RUN": {
        const { machineId } = body;

        if (!machineId) {
          return NextResponse.json(
            { error: "Machine ID is required to start run" },
            { status: 400 },
          );
        }

        await prisma.machine.update({
          where: { id: machineId },
          data: { status: "RUNNING", currentState: "RUNNING" },
        });

        await logAudit({
          actor: headerList.get("x-user-name") || "Operator",
          action: "RUN_STARTED",
          entityType: "MACHINE",
          entityId: machineId,
          details: `Run started on machine ${machineId}`,
        });

        return NextResponse.json({
          success: true,
          message: "Machine now RUNNING",
        });
      }

      case "CHANGEOVER": {
        const { machineId, workOrderId } = body;

        if (!machineId) {
          return NextResponse.json(
            { error: "Machine ID is required for changeover" },
            { status: 400 },
          );
        }

        // Close the current job's production log — changeover begins setup time
        await prisma.productionLog.updateMany({
          where: { machineId, endTime: null },
          data: { endTime: new Date() },
        });

        await prisma.downtimeLog.updateMany({
          where: { machineId, endTime: null },
          data: { endTime: new Date() },
        });

        await prisma.machine.update({
          where: { id: machineId },
          data: { status: "SETUP", currentState: "SETUP" },
        });

        await logAudit({
          actor: headerList.get("x-user-name") || "Operator",
          action: "CHANGEOVER_STARTED",
          entityType: "MACHINE",
          entityId: machineId,
          details: workOrderId
            ? `Changeover started to WO ${workOrderId}`
            : `Changeover started on machine ${machineId}`,
        });

        return NextResponse.json({
          success: true,
          message: "Changeover started — machine SETUP",
        });
      }

      case "COMPLETE_JOB": {
        const { workOrderId, machineId } = body;

        if (!workOrderId) {
          return NextResponse.json(
            { error: "Work Order ID is required to complete job" },
            { status: 400 },
          );
        }

        const now = new Date();

        // Update Work Order to COMPLETED
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: { status: "COMPLETED" },
        });

        // Close any open production log
        await prisma.productionLog.updateMany({
          where: { workOrderId, endTime: null },
          data: { endTime: now },
        });

        // Close any open downtime log
        if (machineId) {
          await prisma.downtimeLog.updateMany({
            where: { machineId, endTime: null },
            data: { endTime: now },
          });

          await prisma.machine.update({
            where: { id: machineId },
            data: { status: "IDLE" },
          });
        }

        await logAudit({
          actor: headerList.get("x-user-name") || "Operator",
          action: "COMPLETE_JOB",
          entityType: "WORK_ORDER",
          entityId: workOrderId,
          details: `Completed work order ${workOrderId}`,
        });

        return NextResponse.json({
          success: true,
          message: "Work Order completed",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error: any) {
    if (error?.code === "DUPLICATE") {
      return NextResponse.json({ success: true, duplicate: true, message: "Action already processed (idempotent duplicate request ignored)" });
    }
    if (error?.code === "STATE_CONFLICT") {
      return NextResponse.json({ conflict: true, message: error.message, serverTimestamp: error.serverTimestamp }, { status: 412 });
    }
    console.error("Error processing operator action:", error);
    return NextResponse.json(
      { error: "Failed to process operator action" },
      { status: 500 },
    );
  }
}
