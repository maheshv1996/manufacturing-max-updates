import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { hashPassword } from "@/lib/auth";
import { canAddMachine } from "@/lib/licenseEngine";
import { logAudit } from "@/lib/audit";
import {
  computeCalibrationStatus,
  computeVendorStatus,
} from "@/lib/calibration";

function cleanPrismaData(data: any): any {
  if (!data || typeof data !== "object") return {};
  const cleaned: any = {};
  const ignoreKeys = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "line",
    "plant",
    "product",
    "assignments",
    "productionLogs",
    "operator",
    "shift",
    "machine",
    "shifts",
    "users",
    "downtimeReasons",
    "defectCodes",
    "workOrders",
    "routingSteps",
    "operation",
    "operations",
    "shiftHandovers",
    "attendanceLogs",
    "fromShiftCounts",
    "toShiftCounts",
    "rosterEntries",
    "logsheets",
    "packagingScanLogs",
    "readings",
    "device",
    "operatorStats",
    "password",
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (ignoreKeys.has(key)) continue;
    if (Array.isArray(value)) continue;
    if (typeof value === "object" && value !== null && !(value instanceof Date)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entity, action, data } = body;

    if (!entity || !action || !data) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    let result;
    const cleanData = cleanPrismaData(data);

    switch (entity) {
      case "plants":
        if (action === "create") {
          result = await prisma.plant.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.plant.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "machines":
        if (action === "create") {
          const cap = await canAddMachine();
          if (!cap.allowed) {
            return NextResponse.json(
              {
                error: `Machine limit reached. Upgrade to ${cap.requiredPlan} to add more.`,
              },
              { status: 403 },
            );
          }
          if (!cleanData.lineId) {
            let defLine = await prisma.productionLine.findFirst({ where: { isActive: true } });
            if (!defLine) {
              let defPlant = await prisma.plant.findFirst({ where: { isActive: true } });
              if (!defPlant) {
                defPlant = await prisma.plant.create({
                  data: { name: "Main Plant", code: "PL-01", city: "Shopfloor" },
                });
              }
              defLine = await prisma.productionLine.create({
                data: { name: "Line 1", plantId: defPlant.id },
              });
            }
            cleanData.lineId = defLine.id;
          }
          if (!cleanData.code) {
            cleanData.code = `M-${Date.now().toString().slice(-4)}`;
          }
          result = await prisma.machine.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.machine.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "users":
        if (action === "create" || action === "update") {
          const { id, password, role, ...rest } = data;
          const payload: any = cleanPrismaData(rest);
          if (role) {
            let roleRow = await prisma.role.findUnique({
              where: { name: role },
            });
            if (!roleRow) {
              roleRow = await prisma.role.create({
                data: {
                  name: role,
                  isSystem: true,
                  permissions:
                    role === "ADMIN"
                      ? [
                          "ops.view",
                          "ops.edit",
                          "supply.view",
                          "supply.edit",
                          "commercial.view",
                          "commercial.edit",
                          "people.view",
                          "people.edit",
                          "system.view",
                          "system.edit",
                          "users.manage",
                          "terminal.use",
                          "reports.print",
                          "records.edit",
                          "kpi.override",
                          "audit.view",
                        ]
                      : role === "SUPERVISOR"
                        ? [
                            "ops.view",
                            "ops.edit",
                            "supply.view",
                            "commercial.view",
                            "people.view",
                            "people.edit",
                            "system.view",
                            "terminal.use",
                            "reports.print",
                          ]
                        : ["terminal.use"],
                },
              });
            }
            payload.roleId = roleRow.id;
          }
          if (password) {
            payload.passwordHash = hashPassword(password);
            payload.lastSetPassword = password;
            payload.passwordChangedAt = new Date();
          }
          if (
            action === "update" &&
            (role ||
              password ||
              "isActive" in rest ||
              "isOwner" in rest ||
              "level" in rest)
          ) {
            payload.sessionEpoch = { increment: 1 };
          }
          result =
            action === "create"
              ? await prisma.user.create({ data: payload })
              : await prisma.user.update({ where: { id: data.id }, data: payload });
        }
        break;
      case "products":
        if (action === "create") {
          result = await prisma.product.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.product.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "lines":
        if (action === "create") {
          result = await prisma.productionLine.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.productionLine.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "shifts":
        const shiftPayload: any = {
          name: String(data.name || "").trim(),
          startTime: String(data.startTime || "06:00").trim(),
          endTime: String(data.endTime || "14:00").trim(),
          isActive: data.isActive !== false,
        };
        if (!shiftPayload.name) {
          return NextResponse.json({ error: "Shift name is required" }, { status: 400 });
        }
        if (action === "create") {
          result = await prisma.shift.create({ data: shiftPayload });
        } else if (action === "update") {
          result = await prisma.shift.update({
            where: { id: data.id },
            data: shiftPayload,
          });
        }
        break;
      case "downtimeReasons":
        if (action === "create") {
          result = await prisma.downtimeReason.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.downtimeReason.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "defectCodes":
        if (action === "create") {
          result = await prisma.defectCode.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.defectCode.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "workOrders":
        if (action === "create") {
          if (!cleanData.productId) {
            let defProd = await prisma.product.findFirst({ where: { isActive: true } });
            if (!defProd) {
              defProd = await prisma.product.create({
                data: { sku: "PART-001", name: "Machined Component" },
              });
            }
            cleanData.productId = defProd.id;
          }
          if (!cleanData.woNumber) {
            cleanData.woNumber = `WO-${Date.now().toString().slice(-6)}`;
          }
          if (!cleanData.plannedQuantity) {
            cleanData.plannedQuantity = 100;
          }
          if (!cleanData.plannedStartDate) {
            cleanData.plannedStartDate = new Date();
          }
          if (!cleanData.plannedEndDate) {
            cleanData.plannedEndDate = new Date(Date.now() + 7 * 86400000);
          }
          result = await prisma.workOrder.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.workOrder.update({
            where: { id: data.id },
            data: cleanData,
          });
        }
        break;
      case "operations":
        if (action === "create") {
          result = await prisma.operation.create({ data: cleanData });
        } else if (action === "update") {
          result = await prisma.operation.update({
            where: { id: data.id },
            data: cleanData,
          });
        } else if (action === "delete") {
          result = await prisma.operation.delete({ where: { id: data.id } });
        }
        break;
      case "routingSteps":
        if (action === "create") {
          const {
            productId,
            operationId,
            seq,
            stationName,
            standardCycleTimeSeconds,
            specialProcessVendorId,
          } = data;
          result = await prisma.routingStep.create({
            data: {
              productId,
              operationId,
              seq: Number(seq),
              stationName,
              standardCycleTimeSeconds: standardCycleTimeSeconds
                ? Number(standardCycleTimeSeconds)
                : null,
              specialProcessVendorId: specialProcessVendorId || null,
            },
          });
        } else if (action === "update") {
          const {
            id,
            productId,
            operationId,
            seq,
            stationName,
            standardCycleTimeSeconds,
            specialProcessVendorId,
          } = data;
          result = await prisma.routingStep.update({
            where: { id },
            data: {
              productId,
              operationId,
              seq: Number(seq),
              stationName,
              standardCycleTimeSeconds: standardCycleTimeSeconds
                ? Number(standardCycleTimeSeconds)
                : null,
              specialProcessVendorId: specialProcessVendorId || null,
            },
          });
        } else if (action === "delete") {
          result = await prisma.routingStep.delete({ where: { id: data.id } });
        }
        break;
      case "calibratedTools":
        if (action === "create" || action === "update") {
          const payload: any = cleanPrismaData(data);
          if (payload.expiresAt)
            payload.status = computeCalibrationStatus(payload.expiresAt);
          result =
            action === "create"
              ? await prisma.calibratedTool.create({ data: payload })
              : await prisma.calibratedTool.update({
                  where: { id: data.id },
                  data: payload,
                });
        } else if (action === "delete") {
          result = await prisma.calibratedTool.delete({
            where: { id: data.id },
          });
        }
        break;
      case "specialProcessVendors":
        if (action === "create" || action === "update") {
          const payload: any = cleanPrismaData(data);
          if (payload.expiresAt)
            payload.status = computeVendorStatus(payload.expiresAt);
          result =
            action === "create"
              ? await prisma.specialProcessVendor.create({ data: payload })
              : await prisma.specialProcessVendor.update({
                  where: { id: data.id },
                  data: payload,
                });
        } else if (action === "delete") {
          result = await prisma.specialProcessVendor.delete({
            where: { id: data.id },
          });
        }
        break;
      default:
        return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }

    const actor = headersList.get("x-user-name") || "Admin";

    await logAudit({
      actor: actor,
      action: action.toUpperCase() + "_" + entity.toUpperCase(),
      entityType: entity.toUpperCase(),
      entityId: result?.id || "unknown",
      details: `Admin ${actor} performed ${action} on ${entity}`,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Admin POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
