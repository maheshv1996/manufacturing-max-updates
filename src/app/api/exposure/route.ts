import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { termsDays } from "@/lib/winLoss";
import { fromPaiseRow } from "@/lib/money";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PLANNED", "IN_PROGRESS", "ON_HOLD"];

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["commercial.view", "finance.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [workOrders, invoices, customers] = await Promise.all([
      prisma.workOrder.findMany({
        select: {
          customerName: true,
          status: true,
          quotedPrice: true,
          promisedDispatchDate: true,
        },
        take: 2000,
      }),
      prisma.invoice.findMany({
        select: {
          invoiceNumber: true,
          customerName: true,
          invoiceDate: true,
          dueDate: true,
          totalValue: true,
          paidAmount: true,
          status: true,
        },
        take: 2000,
      }),
      prisma.customer.findMany({
        select: { id: true, name: true, paymentTerms: true },
        take: 1000,
      }),
    ]);

    const termsByName = new Map<string, string>();
    for (const c of customers)
      termsByName.set(c.name.trim().toLowerCase(), c.paymentTerms);

    const ordersByCustomer = new Map<
      string,
      { count: number; value: number }
    >();
    for (const wo of workOrders) {
      const name = (wo.customerName || "").trim();
      if (!name || !OPEN_STATUSES.includes(wo.status)) continue;
      const row = ordersByCustomer.get(name) || { count: 0, value: 0 };
      row.count += 1;
      row.value += wo.quotedPrice || 0;
      ordersByCustomer.set(name, row);
    }

    const exposureByCustomer = new Map<
      string,
      {
        receivables: number;
        overdueAmt: number;
        maxOverdueDays: number;
        invoiceCount: number;
        oldestDue: Date | null;
      }
    >();
    const now = new Date();
    for (const inv of invoices) {
      const name = (inv.customerName || "").trim();
      if (!name || inv.status === "PAID") continue;
      // Ledger-style fixed point: rows store paise — compute in rupees.
      const invR = fromPaiseRow("Invoice", inv);
      const outstanding = Number(invR.totalValue) - Number(invR.paidAmount || 0);
      if (outstanding <= 0) continue;
      const row = exposureByCustomer.get(name) || {
        receivables: 0,
        overdueAmt: 0,
        maxOverdueDays: 0,
        invoiceCount: 0,
        oldestDue: null,
      };
      row.receivables += outstanding;
      row.invoiceCount += 1;
      if (inv.dueDate && inv.dueDate < now) {
        const days = Math.floor(
          (now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (days > row.maxOverdueDays) {
          row.maxOverdueDays = days;
          row.oldestDue = inv.dueDate;
        }
        row.overdueAmt += outstanding;
      }
      exposureByCustomer.set(name, row);
    }

    const names = new Set<string>([
      ...ordersByCustomer.keys(),
      ...exposureByCustomer.keys(),
    ]);
    const rows = [...names]
      .map((name) => {
        const orders = ordersByCustomer.get(name) || { count: 0, value: 0 };
        const recv = exposureByCustomer.get(name) || {
          receivables: 0,
          overdueAmt: 0,
          maxOverdueDays: 0,
          invoiceCount: 0,
          oldestDue: null,
        };
        const terms = termsByName.get(name.toLowerCase()) || "NET30";
        const td = termsDays(terms);
        const exposure = orders.value + recv.receivables;
        const warning =
          recv.maxOverdueDays > td
            ? "CRITICAL"
            : recv.overdueAmt > 0
              ? "ATTENTION"
              : "NONE";
        return {
          customerName: name,
          terms,
          termsDays: td,
          openOrders: orders.count,
          openOrderValue: orders.value,
          receivables: recv.receivables,
          invoiceCount: recv.invoiceCount,
          overdueAmt: recv.overdueAmt,
          maxOverdueDays: recv.maxOverdueDays,
          oldestDue: recv.oldestDue,
          exposure,
          warning,
        };
      })
      .sort((a, b) => b.exposure - a.exposure);

    return NextResponse.json({
      rows,
      totals: {
        exposure: rows.reduce((a, r) => a + r.exposure, 0),
        receivables: rows.reduce((a, r) => a + r.receivables, 0),
        overdueAmt: rows.reduce((a, r) => a + r.overdueAmt, 0),
        openOrderValue: rows.reduce((a, r) => a + r.openOrderValue, 0),
        critical: rows.filter((r) => r.warning === "CRITICAL").length,
        attention: rows.filter((r) => r.warning === "ATTENTION").length,
      },
    });
  } catch (error) {
    console.error("GET /api/exposure error:", error);
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
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["commercial.edit", "finance.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, customerName, paymentTerms } = body;
    if (action !== "set-terms") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!customerName || !paymentTerms) {
      return NextResponse.json(
        { error: "customerName and paymentTerms are required" },
        { status: 400 },
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: { name: customerName },
      });
      const cust = existing
        ? await tx.customer.update({
            where: { id: existing.id },
            data: { paymentTerms },
          })
        : await tx.customer.create({
            data: { name: customerName, paymentTerms },
          });

      await logAuditTx(tx, {
        actor,
        action: "CUSTOMER_TERMS_UPDATED",
        entityType: "CUSTOMER",
        entityId: cust.id,
        details: `${customerName} payment terms → ${paymentTerms}`,
      });
      return cust;
    });
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("POST /api/exposure error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
