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
    | "WorkOrder"
    | "Quotation"
    | "PriceRevision"
    | "ScrapQuarantine"
    | "ReworkOrder"
    | "Idea"
    | "SafetyIncident"
    | "Supplier"
    | "RawMaterial"
    | "BomLine"
    | "Document"
    | "PMRule"
    | "DispatchRecord"
    | "Invoice"
    | "PermitToWork";
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

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
        fromStation: existing.fromStation,
        toStation: existing.toStation,
        quantity: existing.quantity,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.fromStation) dataToUpdate.fromStation = updates.fromStation;
      if (updates.toStation) dataToUpdate.toStation = updates.toStation;
      if (updates.quantity !== undefined)
        dataToUpdate.quantity = Number(updates.quantity);

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
      if (!existing) throw new Error(`InventoryTransaction ${entityId} not found`);

      previousValues = {
        qty: existing.qty,
        type: existing.type,
        reference: existing.reference,
        unitCost: existing.unitCost,
        batchNo: existing.batchNo,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.type) dataToUpdate.type = updates.type;
      if (updates.reference !== undefined) dataToUpdate.reference = updates.reference;
      if (updates.unitCost !== undefined) dataToUpdate.unitCost = Number(updates.unitCost);
      if (updates.batchNo !== undefined) dataToUpdate.batchNo = updates.batchNo;

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
        defectCodeId: existing.defectCodeId,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.defectCodeId !== undefined) dataToUpdate.defectCodeId = updates.defectCodeId;

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
        title: existing.title,
        status: existing.status,
        priority: existing.priority,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.title) dataToUpdate.title = updates.title;
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.priority) dataToUpdate.priority = updates.priority;

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
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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

      updatedRecord = await prisma.shiftHandover.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "ShiftCount": {
      const existing = await (prisma as any).shiftCount.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`ShiftCount ${entityId} not found`);

      previousValues = {
        outCount: existing.outCount,
        inCount: existing.inCount,
        finalCount: existing.finalCount,
        status: existing.status,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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

      updatedRecord = await (prisma as any).shiftCount.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "Tool": {
      const existing = await (prisma as any).tool.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Tool ${entityId} not found`);

      previousValues = {
        name: existing.name,
        currentLife: existing.currentLife,
        maxLife: existing.maxLife,
        status: existing.status,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.name) dataToUpdate.name = updates.name;
      if (updates.currentLife !== undefined)
        dataToUpdate.currentLife = Number(updates.currentLife);
      if (updates.maxLife !== undefined)
        dataToUpdate.maxLife = Number(updates.maxLife);
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await (prisma as any).tool.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "MaintenanceTool": {
      const existing = await prisma.maintenanceTool.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`MaintenanceTool ${entityId} not found`);

      previousValues = {
        name: existing.name,
        code: existing.code,
        ratedLifeUnits: existing.ratedLifeUnits,
        usedUnits: existing.usedUnits,
        regrinds: existing.regrinds,
        maxRegrinds: existing.maxRegrinds,
        lifeStatus: existing.lifeStatus,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.name !== undefined) dataToUpdate.name = updates.name;
      if (updates.code !== undefined) dataToUpdate.code = updates.code;
      if (updates.ratedLifeUnits !== undefined)
        dataToUpdate.ratedLifeUnits = Number(updates.ratedLifeUnits);
      if (updates.usedUnits !== undefined)
        dataToUpdate.usedUnits = Number(updates.usedUnits);
      if (updates.regrinds !== undefined)
        dataToUpdate.regrinds = Number(updates.regrinds);
      if (updates.maxRegrinds !== undefined)
        dataToUpdate.maxRegrinds = Number(updates.maxRegrinds);
      if (updates.lifeStatus) dataToUpdate.lifeStatus = updates.lifeStatus;

      updatedRecord = await prisma.maintenanceTool.update({
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

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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

    case "Quotation": {
      const existing = await prisma.quotation.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Quotation ${entityId} not found`);

      previousValues = {
        quotedPrice: existing.quotedPrice,
        estimatedCost: existing.estimatedCost,
        marginPct: existing.marginPct,
        discountPct: existing.discountPct,
        status: existing.status,
        notes: existing.notes,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.quotedPrice !== undefined) dataToUpdate.quotedPrice = Number(updates.quotedPrice);
      if (updates.estimatedCost !== undefined) dataToUpdate.estimatedCost = Number(updates.estimatedCost);
      if (updates.marginPct !== undefined) dataToUpdate.marginPct = Number(updates.marginPct);
      if (updates.discountPct !== undefined) dataToUpdate.discountPct = Number(updates.discountPct);
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.notes !== undefined) dataToUpdate.notes = updates.notes;

      updatedRecord = await prisma.quotation.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "PriceRevision": {
      const existing = await prisma.priceRevision.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`PriceRevision ${entityId} not found`);

      previousValues = {
        oldPrice: existing.oldPrice,
        newPrice: existing.newPrice,
        reason: existing.reason,
        status: existing.status,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.oldPrice !== undefined) dataToUpdate.oldPrice = Number(updates.oldPrice);
      if (updates.newPrice !== undefined) dataToUpdate.newPrice = Number(updates.newPrice);
      if (updates.reason) dataToUpdate.reason = updates.reason;
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await prisma.priceRevision.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "ScrapQuarantine": {
      const existing = await prisma.scrapQuarantine.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`ScrapQuarantine ${entityId} not found`);

      previousValues = {
        quantity: existing.quantity,
        defectCode: existing.defectCode,
        status: existing.status,
        dispositionNotes: existing.dispositionNotes,
        costEstimate: existing.costEstimate,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.quantity !== undefined) dataToUpdate.quantity = Number(updates.quantity);
      if (updates.defectCode !== undefined) dataToUpdate.defectCode = updates.defectCode;
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.dispositionNotes !== undefined) dataToUpdate.dispositionNotes = updates.dispositionNotes;
      if (updates.costEstimate !== undefined) dataToUpdate.costEstimate = Number(updates.costEstimate);

      updatedRecord = await prisma.scrapQuarantine.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "ReworkOrder": {
      const existing = await (prisma as any).reworkOrder.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`ReworkOrder ${entityId} not found`);

      previousValues = {
        quantity: existing.quantity,
        status: existing.status,
        notes: existing.notes,
        reworkCost: existing.reworkCost,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.quantity !== undefined) dataToUpdate.quantity = Number(updates.quantity);
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.notes !== undefined) dataToUpdate.notes = updates.notes;
      if (updates.reworkCost !== undefined) dataToUpdate.reworkCost = Number(updates.reworkCost);

      updatedRecord = await (prisma as any).reworkOrder.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "Idea": {
      const existing = await (prisma as any).idea.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Idea ${entityId} not found`);

      previousValues = {
        title: existing.title,
        description: existing.description,
        status: existing.status,
        category: existing.category,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.title) dataToUpdate.title = updates.title;
      if (updates.description) dataToUpdate.description = updates.description;
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.category) dataToUpdate.category = updates.category;

      updatedRecord = await (prisma as any).idea.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "SafetyIncident": {
      const existing = await (prisma as any).safetyIncident.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`SafetyIncident ${entityId} not found`);

      previousValues = {
        title: existing.title,
        description: existing.description,
        severity: existing.severity,
        status: existing.status,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.title) dataToUpdate.title = updates.title;
      if (updates.description) dataToUpdate.description = updates.description;
      if (updates.severity) dataToUpdate.severity = updates.severity;
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await (prisma as any).safetyIncident.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "Supplier": {
      const existing = await prisma.supplier.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Supplier ${entityId} not found`);

      previousValues = {
        name: existing.name,
        code: existing.code,
        rating: existing.rating,
        paymentTerms: existing.paymentTerms,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.name) dataToUpdate.name = updates.name;
      if (updates.code) dataToUpdate.code = updates.code;
      if (updates.rating !== undefined) dataToUpdate.rating = Number(updates.rating);
      if (updates.paymentTerms !== undefined) dataToUpdate.paymentTerms = updates.paymentTerms;

      updatedRecord = await prisma.supplier.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "RawMaterial": {
      const existing = await prisma.rawMaterial.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`RawMaterial ${entityId} not found`);

      previousValues = {
        name: existing.name,
        sku: existing.sku,
        unitCost: existing.unitCost,
        currentStock: existing.currentStock,
        minStock: existing.minStock,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.name) dataToUpdate.name = updates.name;
      if (updates.sku) dataToUpdate.sku = updates.sku;
      if (updates.unitCost !== undefined) dataToUpdate.unitCost = Number(updates.unitCost);
      if (updates.currentStock !== undefined) dataToUpdate.currentStock = Number(updates.currentStock);
      if (updates.minStock !== undefined) dataToUpdate.minStock = Number(updates.minStock);

      updatedRecord = await prisma.rawMaterial.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "BomLine": {
      const existing = await prisma.bomLine.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`BomLine ${entityId} not found`);

      previousValues = {
        qtyPerUnit: existing.qtyPerUnit,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.qtyPerUnit !== undefined) dataToUpdate.qtyPerUnit = Number(updates.qtyPerUnit);

      updatedRecord = await prisma.bomLine.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "Document": {
      const existing = await prisma.document.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Document ${entityId} not found`);

      previousValues = {
        title: existing.title,
        version: existing.version,
        status: existing.status,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.title) dataToUpdate.title = updates.title;
      if (updates.version !== undefined) dataToUpdate.version = Number(updates.version);
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await prisma.document.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "PMRule": {
      const existing = await (prisma as any).pMRule.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`PMRule ${entityId} not found`);

      previousValues = {
        name: existing.name,
        intervalDays: existing.intervalDays,
        intervalHours: existing.intervalHours,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.name) dataToUpdate.name = updates.name;
      if (updates.intervalDays !== undefined) dataToUpdate.intervalDays = Number(updates.intervalDays);
      if (updates.intervalHours !== undefined) dataToUpdate.intervalHours = Number(updates.intervalHours);

      updatedRecord = await (prisma as any).pMRule.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "DispatchRecord": {
      const existing = await (prisma as any).dispatchRecord.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`DispatchRecord ${entityId} not found`);

      previousValues = {
        dispatchQty: existing.dispatchQty,
        carrier: existing.carrier,
        trackingNumber: existing.trackingNumber,
        notes: existing.notes,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.dispatchQty !== undefined) dataToUpdate.dispatchQty = Number(updates.dispatchQty);
      if (updates.carrier !== undefined) dataToUpdate.carrier = updates.carrier;
      if (updates.trackingNumber !== undefined) dataToUpdate.trackingNumber = updates.trackingNumber;
      if (updates.notes !== undefined) dataToUpdate.notes = updates.notes;

      updatedRecord = await (prisma as any).dispatchRecord.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "Invoice": {
      const existing = await prisma.invoice.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`Invoice ${entityId} not found`);

      previousValues = {
        paidAmount: existing.paidAmount,
        status: existing.status,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.paidAmount !== undefined) dataToUpdate.paidAmount = Number(updates.paidAmount);
      if (updates.status) dataToUpdate.status = updates.status;

      updatedRecord = await prisma.invoice.update({
        where: { id: entityId },
        data: dataToUpdate,
      });
      break;
    }

    case "PermitToWork": {
      const existing = await prisma.permitToWork.findUnique({
        where: { id: entityId },
      });
      if (!existing) throw new Error(`PermitToWork ${entityId} not found`);

      previousValues = {
        type: existing.type,
        status: existing.status,
        description: existing.description,
        location: existing.location,
      };

      const history = Array.isArray(existing.adjustmentHistory) ? (existing.adjustmentHistory as any[]) : [];
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
      if (updates.type) dataToUpdate.type = updates.type;
      if (updates.status) dataToUpdate.status = updates.status;
      if (updates.description !== undefined) dataToUpdate.description = updates.description;
      if (updates.location !== undefined) dataToUpdate.location = updates.location;

      updatedRecord = await prisma.permitToWork.update({
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
