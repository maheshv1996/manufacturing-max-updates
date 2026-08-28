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

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { entity, action, data } = body;

    if (!entity || !action || !data) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    let result;

    switch (entity) {
      case "plants":
        if (action === "create") {
          result = await prisma.plant.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.plant.update({
            where: { id },
            data: updateData,
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
          result = await prisma.machine.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.machine.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "users":
        if (action === "create" || action === "update") {
          const { id, password, role, ...rest } = data;
          const payload: any = { ...rest };
          // The UI submits role as a NAME ("ADMIN" | "SUPERVISOR" | "OPERATOR");
          // resolve it to the Role row (find-or-create) since User.roleId is an FK.
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
                            "system.view",
                            "reports.print",
                            "terminal.use",
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
          // Session rotation: any change to role, password, active/owner status,
          // or level invalidates existing sessions — the proxy re-checks
          // sessionEpoch on every request, so revoked access takes effect now.
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
              : await prisma.user.update({ where: { id }, data: payload });
        }
        break;
      case "products":
        if (action === "create") {
          result = await prisma.product.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.product.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "lines":
        if (action === "create") {
          result = await prisma.productionLine.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.productionLine.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "shifts":
        if (action === "create") {
          result = await prisma.shift.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.shift.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "downtimeReasons":
        if (action === "create") {
          result = await prisma.downtimeReason.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.downtimeReason.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "defectCodes":
        if (action === "create") {
          result = await prisma.defectCode.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.defectCode.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "workOrders":
        if (action === "create") {
          result = await prisma.workOrder.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.workOrder.update({
            where: { id },
            data: updateData,
          });
        }
        break;
      case "operations":
        if (action === "create") {
          result = await prisma.operation.create({ data });
        } else if (action === "update") {
          const { id, ...updateData } = data;
          result = await prisma.operation.update({
            where: { id },
            data: updateData,
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
          const payload: any = { ...data };
          if (action === "update") delete payload.id;
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
          const payload: any = { ...data };
          if (action === "update") delete payload.id;
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
  } catch (error) {
    console.error("Admin POST error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
