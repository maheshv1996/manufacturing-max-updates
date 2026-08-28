import { prisma } from "@/lib/prisma";

export async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;

  const latestQuote = await prisma.quotation.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: "desc" },
  });

  if (!latestQuote) {
    return `${prefix}001`;
  }

  const parts = latestQuote.quoteNumber.split("-");
  const lastSeq = parseInt(parts[parts.length - 1], 10);
  const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
  return `${prefix}${nextSeq.toString().padStart(3, "0")}`;
}

export async function convertQuoteToWorkOrders(
  quotationId: string,
  actorName = "Admin",
) {
  const quote = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        include: { product: true },
      },
    },
  });

  if (!quote) {
    throw new Error("Quotation not found");
  }

  if (quote.status === "CONVERTED") {
    throw new Error("Quotation has already been converted to Work Order(s)");
  }

  if (quote.lines.length === 0) {
    throw new Error("Quotation has no line items to convert");
  }

  const createdWorkOrders: any[] = [];

  for (let i = 0; i < quote.lines.length; i++) {
    const line = quote.lines[i];
    const seqSuffix = quote.lines.length > 1 ? `-${i + 1}` : "";
    const woNumber = `WO-${quote.quoteNumber.replace("QT-", "")}${seqSuffix}`;

    const startDate = new Date();
    const endDate = quote.validUntil
      ? new Date(quote.validUntil)
      : new Date(Date.now() + 14 * 86400000);

    const wo = await prisma.workOrder.create({
      data: {
        woNumber,
        productId: line.productId,
        plannedQuantity: Math.max(1, Math.round(line.plannedQty)),
        status: "PLANNED",
        plannedStartDate: startDate,
        plannedEndDate: endDate,
        setupTimeMinutes: 15,
        cycleTimeSeconds: line.product.targetCycleTimeSeconds || 60,
        customerName: quote.customerName,
        customerEmail: quote.customerContact || null,
        quotedPrice: line.subtotal > 0 ? line.subtotal : quote.quotedPrice,
      },
    });

    createdWorkOrders.push(wo);
  }

  const primaryWoId = createdWorkOrders[0]?.id || null;

  // Update Quotation status to CONVERTED and link primary workOrderId
  const updatedQuote = await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      status: "CONVERTED",
      workOrderId: primaryWoId,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actor: actorName,
      action: "CONVERTED_QUOTATION",
      entityType: "Quotation",
      entityId: quotationId,
      details: JSON.stringify({
        quoteNumber: quote.quoteNumber,
        customerName: quote.customerName,
        workOrdersCreated: createdWorkOrders.map((w) => w.woNumber),
      }),
    },
  });

  return {
    quotation: updatedQuote,
    workOrders: createdWorkOrders,
  };
}
