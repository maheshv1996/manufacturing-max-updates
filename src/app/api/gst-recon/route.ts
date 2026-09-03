import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const normGstin = (s: string) => (s || "").replace(/\s+/g, "").toUpperCase();
const normInv = (s: string) =>
  (s || "").trim().toUpperCase().replace(/\s+/g, "");

// ₹ tolerance for "matched" amount equality
const AMOUNT_TOLERANCE = 5;

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["finance.view", "commercial.view"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const runs = await prisma.gstReconRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("GET /api/gst-recon error:", error);
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
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["finance.edit", "commercial.edit"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;

    if (action !== "create-run") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { period, label, rows } = body;
    if (!/^\d{4}-\d{2}$/.test(period || ""))
      return NextResponse.json(
        { error: "period must be YYYY-MM" },
        { status: 400 },
      );
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "rows required" }, { status: 400 });

    // 1. Build the purchase register index once.
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      take: 5000,
      include: { supplier: { select: { name: true, gstin: true } } },
    });
    const registerByKey = new Map<string, (typeof supplierInvoices)[number]>();
    for (const si of supplierInvoices) {
      if (!si.supplier?.gstin) continue;
      const g = normGstin(si.supplier.gstin);
      const k = `${g}|${normInv(si.invoiceNumber)}`;
      if (!registerByKey.has(k)) registerByKey.set(k, si);
    }

    // 2. Match every CSV row.
    const matchedKeys = new Set<string>();
    const reconciled = rows.map((r: any, idx: number) => {
      const gstin = normGstin(r.gstin);
      const invoiceNumber = normInv(r.invoiceNumber);
      const taxable = Number(r.taxable || 0);
      const tax = Number(r.tax || 0);
      const total = Number(r.total || 0) || taxable + tax;
      const invoiceDate = r.invoiceDate || "";
      const supplierName = (r.supplierName || "").trim();
      if (!gstin || !invoiceNumber) {
        return {
          idx,
          gstin,
          supplierName,
          invoiceNumber,
          invoiceDate,
          taxable,
          tax,
          total,
          status: "NOT_IN_REGISTER",
          diff: 0,
          note: "Missing GSTIN or invoice number in CSV row",
        };
      }
      const key = `${gstin}|${invoiceNumber}`;
      const reg = registerByKey.get(key);
      if (!reg) {
        return {
          idx,
          gstin,
          supplierName,
          invoiceNumber,
          invoiceDate,
          taxable,
          tax,
          total,
          status: "NOT_IN_REGISTER",
          diff: 0,
          note: "",
        };
      }
      if (
        Math.abs(taxable - reg.amount) > AMOUNT_TOLERANCE ||
        Math.abs(total - reg.totalAmount) > AMOUNT_TOLERANCE
      ) {
        return {
          idx,
          gstin,
          supplierName: supplierName || reg.supplier.name,
          invoiceNumber,
          invoiceDate,
          taxable,
          tax,
          total,
          status: "AMOUNT_DIFF",
          diff: Number((total - reg.totalAmount).toFixed(2)),
          note: `Register: net ${reg.amount} / total ${reg.totalAmount} (${reg.invoiceDate ? new Date(reg.invoiceDate).toISOString().slice(0, 10) : "?"})`,
        };
      }
      matchedKeys.add(key);
      return {
        idx,
        gstin,
        supplierName: supplierName || reg.supplier.name,
        invoiceNumber,
        invoiceDate,
        taxable,
        tax,
        total,
        status: "MATCHED",
        diff: 0,
        note: "",
      };
    });

    // 3. Reverse scan — register invoices for the period with NO CSV match.
    const periodVouchers = supplierInvoices.filter((si) => {
      if (!si.invoiceDate) return false;
      const d = si.invoiceDate;
      const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return mk === period;
    });
    const missingFromCsv = periodVouchers
      .filter((si) => {
        if (!si.supplier?.gstin) return false;
        const key = `${normGstin(si.supplier.gstin)}|${normInv(si.invoiceNumber)}`;
        return !matchedKeys.has(key);
      })
      .map((si) => ({
        idx: -1,
        gstin: normGstin(si.supplier!.gstin!),
        supplierName: si.supplier!.name,
        invoiceNumber: si.invoiceNumber,
        invoiceDate: si.invoiceDate.toISOString().slice(0, 10),
        taxable: si.amount,
        tax: si.taxAmount,
        total: si.totalAmount,
        status: "MISSING_FROM_CSV",
        diff: 0,
        note: "In period purchase register — absent from uploaded GSTR-2B",
      }));

    const allRows = [...reconciled, ...missingFromCsv];
    const count = (s: string) => allRows.filter((r) => r.status === s).length;
    const stats = {
      total: allRows.length,
      matched: count("MATCHED"),
      amountDiff: count("AMOUNT_DIFF"),
      notInRegister: count("NOT_IN_REGISTER"),
      missingFromCsv: count("MISSING_FROM_CSV"),
      registerTotal: periodVouchers.reduce((s, si) => s + si.totalAmount, 0),
      csvTotal: reconciled.reduce((s, r) => s + r.total, 0),
    };

    const run = await prisma.gstReconRun.create({
      data: {
        period,
        label:
          label?.slice(0, 120) ||
          `2B upload ${new Date().toISOString().slice(0, 10)}`,
        rows: allRows,
        stats,
        followUps: [],
        uploadedBy: actor,
      },
    });

    await logAudit({
      actor,
      action: "GST_RECON_UPLOADED",
      entityType: "GST_RECON",
      entityId: run.id,
      details: `${period} ${label || "2B"}: ${stats.total} rows → ${stats.matched} matched, ${stats.amountDiff + stats.notInRegister + stats.missingFromCsv} to follow up`,
    });

    return NextResponse.json({ run });
  } catch (error: any) {
    console.error("POST /api/gst-recon error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
