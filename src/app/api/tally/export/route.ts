import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = [
  "INVOICES",
  "PAYMENTS",
  "PAYABLES",
  "PARTIES",
  "XML_SALES",
] as const;
type TallyType = (typeof TYPES)[number];

function csvCell(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function xmlEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ageBucket(due: Date | string | null | undefined): string {
  if (!due) return "0-30";
  const days = Math.floor((Date.now() - new Date(due).getTime()) / 86400000);
  if (days > 90) return "90+";
  if (days > 60) return "61-90";
  if (days > 30) return "31-60";
  return "0-30";
}

async function invoicesCsv() {
  const invoices = await (prisma as any).invoice.findMany({
    orderBy: { invoiceDate: "asc" },
  });
  const header = [
    "Date",
    "Invoice No",
    "Party Name",
    "GSTIN/UIN",
    "Taxable Amount",
    "CGST",
    "SGST",
    "IGST",
    "Total",
    "Status",
  ];
  const rows = invoices.map((inv: any) => [
    fmtDate(inv.invoiceDate),
    inv.invoiceNumber,
    inv.customerName,
    inv.customerGstin || "",
    inv.taxableValue,
    inv.cgstAmt || 0,
    inv.sgstAmt || 0,
    inv.igstAmt || 0,
    inv.totalValue,
    inv.status,
  ]);
  return { header, rows };
}

async function paymentsCsv() {
  const [treasury, supplierPayments, customerPayments] = await Promise.all([
    prisma.treasuryTransaction.findMany({ orderBy: { date: "asc" } }),
    prisma.supplierPayment.findMany({
      include: { supplier: true },
      orderBy: { paymentDate: "asc" },
    }),
    (prisma as any).invoice.findMany({
      include: { payments: true },
      orderBy: { invoiceDate: "asc" },
    }),
  ]);

  const rows: any[][] = [];
  // Voucher Type follows Tally convention: Receipt = money in, Payment = money out.
  for (const t of treasury) {
    rows.push([
      fmtDate(t.date),
      t.account,
      t.type === "INFLOW" ? "Receipt" : "Payment",
      t.reference || "",
      t.amount,
    ]);
  }
  for (const p of supplierPayments) {
    rows.push([
      fmtDate(p.paymentDate),
      p.supplier?.name || p.supplierId,
      "Payment",
      p.reference || p.method || "",
      p.amount,
    ]);
  }
  for (const inv of customerPayments) {
    for (const p of inv.payments || []) {
      rows.push([
        fmtDate(p.paymentDate),
        inv.customerName,
        "Receipt",
        p.reference || p.method || "",
        p.amount,
      ]);
    }
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const header = [
    "Date",
    "Party Name",
    "Voucher Type (Receipt/Payment)",
    "Ref No",
    "Amount",
  ];
  return { header, rows };
}

async function payablesCsv() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchaseOrders: { where: { status: "RECEIVED" } },
      payments: true,
    },
    orderBy: { name: "asc" },
  });

  const header = [
    "Party Name",
    "GSTIN",
    "PO Ref",
    "Due Date",
    "Outstanding",
    "Age Bucket",
  ];
  const rows: any[][] = [];
  for (const s of suppliers) {
    for (const po of s.purchaseOrders) {
      const poValue = po.receivedQty * po.unitCost;
      const paid = s.payments
        .filter((p: any) => p.purchaseOrderId === po.id)
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const outstanding = Number((poValue - paid).toFixed(2));
      if (outstanding <= 0) continue;
      rows.push([
        s.name,
        "",
        po.poNumber,
        fmtDate(po.expectedDate || po.receivedAt),
        outstanding,
        ageBucket(po.expectedDate || po.receivedAt),
      ]);
    }
  }
  return { header, rows };
}

async function partiesCsv() {
  const invoices = await (prisma as any).invoice.findMany();
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchaseOrders: { where: { status: "RECEIVED" } },
      payments: true,
    },
    orderBy: { name: "asc" },
  });
  // Customer master (added in the import wizard wave) enriches emails/phones/states;
  // invoice rows that predate it fall back to the old GSTIN-from-invoice + address-tail guess.
  const customers = await prisma.customer.findMany({
    select: { name: true, email: true, phone: true, state: true, gstin: true },
  });
  const masterByName = new Map(
    customers.map((c: any) => [c.name.trim().toLowerCase(), c]),
  );

  const header = [
    "Name",
    "GSTIN",
    "State",
    "Phone",
    "Email",
    "Opening Balance",
  ];
  const rows: any[][] = [];
  const byParty = new Map<
    string,
    { name: string; gstin: string; address: string }
  >();
  for (const inv of invoices) {
    const key = inv.customerName.trim().toLowerCase();
    const existing = byParty.get(key) || {
      name: inv.customerName,
      gstin: "",
      address: "",
    };
    if (inv.customerGstin) existing.gstin = inv.customerGstin;
    if (inv.customerAddress) existing.address = inv.customerAddress;
    byParty.set(key, existing);
  }
  for (const [key, cust] of byParty) {
    const ops = invoices
      .filter((i: any) => i.customerName.trim().toLowerCase() === key)
      .reduce(
        (sum: number, i: any) => sum + (i.totalValue - (i.paidAmount || 0)),
        0,
      );
    const master = masterByName.get(key);
    const stateGuess =
      master?.state || (cust.address || "").split(",").pop()?.trim() || "";
    rows.push([
      cust.name,
      master?.gstin || cust.gstin,
      stateGuess,
      master?.phone || "",
      master?.email || "",
      Number(ops.toFixed(2)),
    ]);
  }
  for (const s of suppliers) {
    const purchased = s.purchaseOrders.reduce(
      (sum: number, po: any) => sum + po.receivedQty * po.unitCost,
      0,
    );
    const paid = s.payments.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0,
    );
    const balance = Number((purchased - paid).toFixed(2));
    rows.push([
      s.name,
      (s as any).gstin || "",
      "",
      s.phone || s.contactPhone || "",
      s.email || "",
      balance > 0 ? -balance : 0,
    ]);
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return { header, rows };
}

async function invoicesXml() {
  const invoices = await (prisma as any).invoice.findMany({
    orderBy: { invoiceDate: "asc" },
  });
  let vouchers = "";
  for (const inv of invoices) {
    const taxType = inv.taxType === "INTRA" ? "CGST+SGST" : "IGST";
    let taxEntries = "";
    if (inv.taxType === "INTRA") {
      taxEntries += `<LEDGERENTRY><LEDGERNAME>CGST</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${Number(inv.cgstAmt || 0).toFixed(2)}</AMOUNT></LEDGERENTRY>`;
      taxEntries += `<LEDGERENTRY><LEDGERNAME>SGST</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${Number(inv.sgstAmt || 0).toFixed(2)}</AMOUNT></LEDGERENTRY>`;
    } else {
      taxEntries += `<LEDGERENTRY><LEDGERNAME>IGST</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${Number(inv.igstAmt || 0).toFixed(2)}</AMOUNT></LEDGERENTRY>`;
    }
    vouchers += `
    <VOUCHER VCHTYPE="Sales">
      <DATE>${fmtDate(inv.invoiceDate)}</DATE>
      <GUID>${inv.id}</GUID>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(inv.invoiceNumber)}</VOUCHERNUMBER>
      <NARRATION>${xmlEscape(`Invoice ${inv.invoiceNumber} - ${inv.customerName} (${taxType})`)}</NARRATION>
      <LEDGERENTRIES>
        <LEDGERENTRY>
          <LEDGERNAME>${xmlEscape(inv.customerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${Number(inv.totalValue).toFixed(2)}</AMOUNT>
        </LEDGERENTRY>
        <LEDGERENTRY>
          <LEDGERNAME>Sales</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${Number(inv.taxableValue).toFixed(2)}</AMOUNT>
        </LEDGERENTRY>
        ${taxEntries}
      </LEDGERENTRIES>
    </VOUCHER>`;
  }
  return vouchers;
}

export async function GET(request: NextRequest) {
  const user = getUserFromHeaders(request.headers);
  if (!user.isOwner && !canAny(user, ["commercial.view", "commercial.edit"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const typeParam = (
      request.nextUrl.searchParams.get("type") || "INVOICES"
    ).toUpperCase();
    const format = (
      request.nextUrl.searchParams.get("format") || "csv"
    ).toLowerCase();
    const type: TallyType = TYPES.includes(typeParam as TallyType)
      ? (typeParam as TallyType)
      : "INVOICES";

    // XML_SALES is a first-class type (and &format=xml stays for backward compat).
    if (type === "XML_SALES" || format === "xml") {
      const vouchers = await invoicesXml();
      const rowCount = (vouchers.match(/<VOUCHER /g) || []).length;
      await logAudit({
        actor: user.name || "Admin",
        action: "TALLY_DATA_EXPORTED",
        entityType: "Tally",
        details: JSON.stringify({ type: "XML_SALES", format: "xml", rowCount }),
      });
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n    <TYPE>Data</TYPE>\n    <ID>Vouchers</ID>\n  </HEADER>\n` +
        `  <BODY>\n    <DESC><VOUCHERS></DESC>\n    <DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">` +
        vouchers +
        `\n    </TALLYMESSAGE></DATA>\n  </BODY>\n</ENVELOPE>\n`;
      return new NextResponse(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": 'attachment; filename="tally-sales.xml"',
        },
      });
    }

    let result: { header: string[]; rows: any[][] };
    if (type === "INVOICES") result = await invoicesCsv();
    else if (type === "PAYMENTS") result = await paymentsCsv();
    else if (type === "PAYABLES") result = await payablesCsv();
    else result = await partiesCsv();

    await logAudit({
      actor: user.name || "Admin",
      action: "TALLY_DATA_EXPORTED",
      entityType: "Tally",
      details: JSON.stringify({ type, format, rowCount: result.rows.length }),
    });

    const csv = [result.header, ...result.rows]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");
    const filename = `tally-${type.toLowerCase()}.csv`;

    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Tally export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
