import { prisma } from "./prisma";

export interface EditRecordPayload {
  entityType:
    | "ProductionLog"
    | "DowntimeLog"
    | "AttendanceLog"
    | "MovementLog"
    | "InventoryTransaction"
    | "QualityInspection"
    | "MaintenanceJob"
    | "ShiftHandover"
    | "ShiftCount"
    | "Tool"
    | "MaintenanceTool"
    | "PurchaseOrder"
    | "WorkOrder";
  entityId: string;
  updates: Record<string, any>;
  editorName: string;
  reason?: string;
}

export async function editSourceRecord(payload: EditRecordPayload) {
  const { entityType, entityId, updates, editorName, reason } = payload;
  const now = new Date();

  let previousValues: Record<string, any> = {};
  let updatedRecord: any = null;

  switch (entityType) {
    case "ProductionLog": {
      const existing = await prisma.productionLog.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`ProductionLog ${entityId} not found`);

      previousValues = {
        goodQuantity: existing.goodQuantity,
        scrapQuantity: existing.scrapQuantity,
        reworkQuantity: existing.reworkQuantity,
        startTime: existing.startTime,
        endTime: existing.endTime,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.goodQuantity !== undefined)
        dataToUpdate.goodQuantity = Number(updates.goodQuantity);
      if (updates.scrapQuantity !== undefined)
        dataToUpdate.scrapQuantity = Number(updates.scrapQuantity);
      if (updates.reworkQuantity !== undefined)
        dataToUpdate.reworkQuantity = Number(updates.reworkQuantity);
      if (updates.startTime)
        dataToUpdate.startTime = new Date(updates.startTime);
      if (updates.endTime) dataToUpdate.endTime = new Date(updates.endTime);

      updatedRecord = await prisma.productionLog.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "DowntimeLog": {
      const existing = await prisma.downtimeLog.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`DowntimeLog ${entityId} not found`);

      previousValues = {
        startTime: existing.startTime,
        endTime: existing.endTime,
        durationMinutes: existing.durationMinutes,
        reasonId: existing.reasonId,
        notes: existing.notes,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.startTime)
        dataToUpdate.startTime = new Date(updates.startTime);
      if (updates.endTime) dataToUpdate.endTime = new Date(updates.endTime);
      if (updates.durationMinutes !== undefined)
        dataToUpdate.durationMinutes = Number(updates.durationMinutes);
      if (updates.reasonId) dataToUpdate.reasonId = updates.reasonId;
      if (updates.notes !== undefined) dataToUpdate.notes = updates.notes;

      updatedRecord = await prisma.downtimeLog.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "AttendanceLog": {
      const existing = await prisma.attendanceLog.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`AttendanceLog ${entityId} not found`);

      previousValues = {
        clockIn: existing.clockIn,
        clockOut: existing.clockOut,
        status: existing.status,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.clockIn) dataToUpdate.clockIn = new Date(updates.clockIn);
      if (updates.clockOut) dataToUpdate.clockOut = new Date(updates.clockOut);
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await prisma.attendanceLog.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "MovementLog": {
      const existing = await prisma.movementLog.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`MovementLog ${entityId} not found`);

      previousValues = {
        quantity: existing.quantity,
        fromStation: existing.fromStation,
        toStation: existing.toStation,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.quantity !== undefined)
        dataToUpdate.quantity = Number(updates.quantity);
      if (updates.fromStation) dataToUpdate.fromStation = updates.fromStation;
      if (updates.toStation) dataToUpdate.toStation = updates.toStation;

      updatedRecord = await prisma.movementLog.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "InventoryTransaction": {
      const existing = await prisma.inventoryTransaction.findUnique({
        where: { id: entityId },
      });
      if (!existing)
        throw new Error(`InventoryTransaction ${entityId} not found`);

      previousValues = {
        qty: existing.qty,
        unitCost: existing.unitCost,
        batchNo: existing.batchNo,
        reference: existing.reference,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.qty !== undefined) dataToUpdate.qty = Number(updates.qty);
      if (updates.unitCost !== undefined)
        dataToUpdate.unitCost = Number(updates.unitCost);
      if (updates.batchNo !== undefined) dataToUpdate.batchNo = updates.batchNo;
      if (updates.reference !== undefined)
        dataToUpdate.reference = updates.reference;

      updatedRecord = await prisma.inventoryTransaction.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "QualityInspection": {
      const existing = await prisma.qualityInspection.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`QualityInspection ${entityId} not found`);

      previousValues = {
        totalInspected: existing.totalInspected,
        passed: existing.passed,
        failed: existing.failed,
        notes: existing.notes,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.totalInspected !== undefined)
        dataToUpdate.totalInspected = Number(updates.totalInspected);
      if (updates.passed !== undefined)
        dataToUpdate.passed = Number(updates.passed);
      if (updates.failed !== undefined)
        dataToUpdate.failed = Number(updates.failed);
      if (updates.notes !== undefined) dataToUpdate.notes = updates.notes;

      updatedRecord = await prisma.qualityInspection.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "MaintenanceJob": {
      const existing = await (prisma as any).maintenanceJob.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`MaintenanceJob ${entityId} not found`);

      previousValues = {
        priority: existing.priority,
        type: existing.type,
        status: existing.status,
        rootCause: existing.rootCause,
        countermeasure: existing.countermeasure,
        partsUsed: existing.partsUsed,
        costRupees: existing.costRupees,
        laborHours: existing.laborHours,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.priority) dataToUpdate.priority = updates.priority;
      if (updates.type) dataToUpdate.type = updates.type;
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.rootCause !== undefined)
        dataToUpdate.rootCause = updates.rootCause;
      if (updates.countermeasure !== undefined)
        dataToUpdate.countermeasure = updates.countermeasure;
      if (updates.partsUsed !== undefined)
        dataToUpdate.partsUsed = updates.partsUsed;
      if (updates.costRupees !== undefined)
        dataToUpdate.costRupees = Number(updates.costRupees);
      if (updates.laborHours !== undefined)
        dataToUpdate.laborHours = Number(updates.laborHours);

      updatedRecord = await (prisma as any).maintenanceJob.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "ShiftHandover": {
      const existing = await prisma.shiftHandover.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`ShiftHandover ${entityId} not found`);

      previousValues = {
        productionNotes: existing.productionNotes,
        downtimeNotes: existing.downtimeNotes,
        safetyNotes: existing.safetyNotes,
        nextShiftActions: existing.nextShiftActions,
        missReason: existing.missReason,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.productionNotes !== undefined)
        dataToUpdate.productionNotes = updates.productionNotes;
      if (updates.downtimeNotes !== undefined)
        dataToUpdate.downtimeNotes = updates.downtimeNotes;
      if (updates.safetyNotes !== undefined)
        dataToUpdate.safetyNotes = updates.safetyNotes;
      if (updates.nextShiftActions !== undefined)
        dataToUpdate.nextShiftActions = updates.nextShiftActions;
      if (updates.missReason !== undefined)
        dataToUpdate.missReason = updates.missReason;

      updatedRecord = await prisma.shiftHandover.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "ShiftCount": {
      const existing = await prisma.shiftCount.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`ShiftCount ${entityId} not found`);

      previousValues = {
        outCount: existing.outCount,
        inCount: existing.inCount,
        finalCount: existing.finalCount,
        status: existing.status,
        note: existing.note,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.outCount !== undefined)
        dataToUpdate.outCount = Number(updates.outCount);
      if (updates.inCount !== undefined)
        dataToUpdate.inCount = Number(updates.inCount);
      if (updates.finalCount !== undefined)
        dataToUpdate.finalCount = Number(updates.finalCount);
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.note !== undefined) dataToUpdate.note = updates.note;

      updatedRecord = await prisma.shiftCount.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "Tool": {
      const existing = await prisma.tool.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Tool ${entityId} not found`);

      previousValues = {
        currentCycles: existing.currentCycles,
        maxLifeCycles: existing.maxLifeCycles,
        warningThreshold: existing.warningThreshold,
        status: existing.status,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.currentCycles !== undefined)
        dataToUpdate.currentCycles = Number(updates.currentCycles);
      if (updates.maxLifeCycles !== undefined)
        dataToUpdate.maxLifeCycles = Number(updates.maxLifeCycles);
      if (updates.warningThreshold !== undefined)
        dataToUpdate.warningThreshold = Number(updates.warningThreshold);
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await prisma.tool.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "MaintenanceTool": {
      const existing = await (prisma as any).maintenanceTool.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`MaintenanceTool ${entityId} not found`);

      previousValues = {
        usedUnits: existing.usedUnits,
        ratedLifeUnits: existing.ratedLifeUnits,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.usedUnits !== undefined)
        dataToUpdate.usedUnits = Number(updates.usedUnits);
      if (updates.ratedLifeUnits !== undefined)
        dataToUpdate.ratedLifeUnits = Number(updates.ratedLifeUnits);

      updatedRecord = await (prisma as any).maintenanceTool.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "PurchaseOrder": {
      const existing = await prisma.purchaseOrder.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`PurchaseOrder ${entityId} not found`);

      previousValues = {
        qty: existing.qty,
        receivedQty: existing.receivedQty,
        unitCost: existing.unitCost,
        status: existing.status,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.qty !== undefined) dataToUpdate.qty = Number(updates.qty);
      if (updates.receivedQty !== undefined)
        dataToUpdate.receivedQty = Number(updates.receivedQty);
      if (updates.unitCost !== undefined)
        dataToUpdate.unitCost = Number(updates.unitCost);
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await prisma.purchaseOrder.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "WorkOrder": {
      const existing = await prisma.workOrder.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`WorkOrder ${entityId} not found`);

      previousValues = {
        plannedQuantity: existing.plannedQuantity,
        quotedPrice: existing.quotedPrice,
        setupTimeMinutes: existing.setupTimeMinutes,
        cycleTimeSeconds: existing.cycleTimeSeconds,
      };

      const history = (existing.adjustmentHistory as any[]) || [];
      const newHistory = [
        ...history,
        {
          editedBy: editorName,
          editedAt: now.toISOString(),
          previousValues,
          newValues: updates,
          reason: reason || "Admin Edit",
        },
      ];

      const dataToUpdate: any = { adjustmentHistory: newHistory };
      if (updates.plannedQuantity !== undefined)
        dataToUpdate.plannedQuantity = Number(updates.plannedQuantity);
      if (updates.quotedPrice !== undefined)
        dataToUpdate.quotedPrice = Number(updates.quotedPrice);
      if (updates.setupTimeMinutes !== undefined)
        dataToUpdate.setupTimeMinutes = Number(updates.setupTimeMinutes);
      if (updates.cycleTimeSeconds !== undefined)
        dataToUpdate.cycleTimeSeconds = Number(updates.cycleTimeSeconds);

      updatedRecord = await prisma.workOrder.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }
  }

  // Create AuditLog entry "EDITED_<ENTITY>"
  await prisma.auditLog.create({
    data: {
      actor: editorName,
      action: `EDITED_${entityType.toUpperCase()}`,
      entityType,
      entityId,
      details: JSON.stringify({
        previousValues,
        updates,
        reason: reason || "Admin Edit",
      }),
    },
  });

  return updatedRecord;
}
