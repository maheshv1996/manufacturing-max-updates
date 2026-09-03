import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { approvalFor, formatRupees } from "@/lib/poApproval";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [statements, rawMaterials, suppliers] = await Promise.all([
      prisma.comparativeStatement.findMany({
        include: { quotes: { include: { supplier: true } }, rawMaterial: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.rawMaterial.findMany({ orderBy: { name: "asc" }, take: 300 }),
      prisma.supplier.findMany({ orderBy: { name: "asc" }, take: 300 }),
    ]);
    return NextResponse.json({ statements, rawMaterials, suppliers });
  } catch (error) {
    console.error("GET /api/comparative error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || "Admin";
    const canEdit =
      user.isOwner ||
      canAny(user, [
        "supply.edit",
        "commercial.edit",
        "ops.edit",
        "people.edit",
        "system.edit",
      ]);
    const isManager =
      user.isOwner ||
      user.level === "MANAGER" ||
      can(user, "supply.edit") ||
      can(user, "commercial.edit");

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;

    if (action === "create_statement") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { rawMaterialId, qty, requiredBy, quotes } = body;
      if (
        !rawMaterialId ||
        !qty ||
        !quotes ||
        !Array.isArray(quotes) ||
        quotes.length === 0
      ) {
        return NextResponse.json(
          { error: "Material, qty and at least one quote are required" },
          { status: 400 },
        );
      }
      const year = new Date().getFullYear();
      const count = await prisma.comparativeStatement.count();
      const statementNumber = `CS-${year}-${String(count + 1).padStart(3, "0")}`;

      const statement = await prisma.comparativeStatement.create({
        data: {
          statementNumber,
          rawMaterialId,
          qty: parseFloat(qty),
          requiredBy: requiredBy ? new Date(requiredBy) : null,
          createdBy: actor,
          quotes: {
            create: quotes.map((q: any) => ({
              supplierId: q.supplierId,
              unitRate: parseFloat(q.unitRate),
              leadDays: parseInt(q.leadDays || "7", 10),
              paymentTerms: q.paymentTerms || "NET30",
              notes: q.notes || null,
            })),
          },
        },
        include: { quotes: { include: { supplier: true } }, rawMaterial: true },
      });

      await logAudit({
        actor,
        action: "COMPARATIVE_STATEMENT_CREATED",
        entityType: "COMPARATIVE_STATEMENT",
        entityId: statement.id,
        details: `${statementNumber} — ${statement.rawMaterial.name} × ${qty}, ${quotes.length} quote(s)`,
      });
      return NextResponse.json({ success: true, statement });
    }

    if (action === "add_quote") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const {
        statementId,
        supplierId,
        unitRate,
        leadDays,
        paymentTerms,
        notes,
      } = body;
      if (!statementId || !supplierId || !unitRate) {
        return NextResponse.json(
          { error: "statementId, supplierId and unitRate are required" },
          { status: 400 },
        );
      }
      const statement = await prisma.comparativeStatement.findUnique({
        where: { id: statementId },
      });
      if (!statement)
        return NextResponse.json(
          { error: "Statement not found" },
          { status: 404 },
        );
      if (statement.status !== "OPEN") {
        return NextResponse.json(
          { error: `Cannot add quotes to a ${statement.status} statement` },
          { status: 400 },
        );
      }
      const quote = await prisma.comparativeQuote.create({
        data: {
          statementId,
          supplierId,
          unitRate: parseFloat(unitRate),
          leadDays: parseInt(leadDays || "7", 10),
          paymentTerms: paymentTerms || "NET30",
          notes: notes || null,
        },
        include: { supplier: true },
      });
      await logAudit({
        actor,
        action: "COMPARATIVE_QUOTE_ADDED",
        entityType: "COMPARATIVE_QUOTE",
        entityId: quote.id,
        details: `${statement.statementNumber} — ${quote.supplier.name} @ ${formatRupees(quote.unitRate)}`,
      });
      return NextResponse.json({ success: true, quote });
    }

    if (action === "remove_quote") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { quoteId } = body;
      if (!quoteId)
        return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
      const quote = await prisma.comparativeQuote.findUnique({
        where: { id: quoteId },
        include: { statement: true, supplier: true },
      });
      if (!quote)
        return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      if (quote.statement.status !== "OPEN") {
        return NextResponse.json(
          { error: "Cannot remove quotes from an awarded/closed statement" },
          { status: 400 },
        );
      }
      await prisma.comparativeQuote.delete({ where: { id: quoteId } });
      await logAudit({
        actor,
        action: "COMPARATIVE_QUOTE_REMOVED",
        entityType: "COMPARATIVE_QUOTE",
        entityId: quoteId,
        details: `${quote.statement.statementNumber} — removed ${quote.supplier?.name || "quote"}`,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "award") {
      if (!isManager) {
        return NextResponse.json(
          {
            error:
              "Manager approval required to award a comparative statement.",
          },
          { status: 403 },
        );
      }
      const { statementId, quoteId, reason } = body;
      if (!statementId || !quoteId) {
        return NextResponse.json(
          { error: "statementId and quoteId are required" },
          { status: 400 },
        );
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: "A written reason is required for awarding (audit trail)." },
          { status: 400 },
        );
      }
      const statement = await prisma.comparativeStatement.findUnique({
        where: { id: statementId },
        include: { rawMaterial: true },
      });
      if (!statement)
        return NextResponse.json(
          { error: "Statement not found" },
          { status: 404 },
        );
      if (statement.status !== "OPEN") {
        return NextResponse.json(
          { error: `Statement is already ${statement.status}` },
          { status: 400 },
        );
      }
      const quote = await prisma.comparativeQuote.findUnique({
        where: { id: quoteId },
        include: { supplier: true },
      });
      if (!quote || quote.statementId !== statementId) {
        return NextResponse.json(
          { error: "Quote not found on this statement" },
          { status: 404 },
        );
      }

      const updated = await prisma.comparativeStatement.update({
        where: { id: statementId },
        data: { status: "AWARDED", awardedQuoteId: quoteId },
        include: { quotes: { include: { supplier: true } }, rawMaterial: true },
      });

      const total = statement.qty * quote.unitRate;
      const approval = approvalFor(total);
      const poCount = await prisma.purchaseOrder.count();
      const year = new Date().getFullYear();
      const poNumber = `PO-${year}-${String(poCount + 1).padStart(3, "0")}`;
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: quote.supplierId,
          rawMaterialId: statement.rawMaterialId,
          qty: statement.qty,
          unitCost: quote.unitRate,
          lines: {
            create: {
              rawMaterialId: statement.rawMaterialId,
              lineNo: 1,
              qty: statement.qty,
              unitCost: quote.unitRate,
            },
          },
          status: "ORDERED",
          expectedDate: statement.requiredBy,
          createdBy: actor,
          approvalStatus: approval.approvalStatus,
          approvalLevel: approval.approvalLevel,
        },
      });

      await logAudit({
        actor,
        action: "COMPARATIVE_AWARDED",
        entityType: "COMPARATIVE_STATEMENT",
        entityId: statement.id,
        details: `${statement.statementNumber} awarded to ${quote.supplier.name} @ ${formatRupees(quote.unitRate)} — PO ${poNumber} created (${approval.approvalStatus}). Reason: ${reason}`,
      });

      return NextResponse.json({
        success: true,
        statement: updated,
        purchaseOrder: po,
      });
    }

    if (action === "close") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { statementId } = body;
      if (!statementId)
        return NextResponse.json(
          { error: "Missing statementId" },
          { status: 400 },
        );
      const statement = await prisma.comparativeStatement.findUnique({
        where: { id: statementId },
      });
      if (!statement)
        return NextResponse.json(
          { error: "Statement not found" },
          { status: 404 },
        );
      if (statement.status !== "OPEN") {
        return NextResponse.json(
          { error: `Statement is already ${statement.status}` },
          { status: 400 },
        );
      }
      const updated = await prisma.comparativeStatement.update({
        where: { id: statementId },
        data: { status: "CLOSED" },
      });
      await logAudit({
        actor,
        action: "COMPARATIVE_CLOSED",
        entityType: "COMPARATIVE_STATEMENT",
        entityId: statement.id,
        details: `Closed ${statement.statementNumber} without award`,
      });
      return NextResponse.json({ success: true, statement: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/comparative error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
