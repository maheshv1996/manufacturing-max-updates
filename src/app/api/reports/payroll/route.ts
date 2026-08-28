import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { computeMonthlyPayroll } from "@/lib/payrollEngine";
import { logAudit } from "@/lib/audit";

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/\r?\n|\r/g, " ");
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(
      searchParams.get("year") || String(now.getFullYear()),
      10,
    );
    const month = parseInt(
      searchParams.get("month") || String(now.getMonth() + 1),
      10,
    );
    const isExport = searchParams.get("export") === "true";

    const summary = await computeMonthlyPayroll(year, month);
    const monthStr = String(month).padStart(2, "0");

    if (isExport) {
      const headersList = await nextHeaders();
      const actor = headersList.get("x-user-name") || "Accountant";

      // Write required audit log
      await logAudit({
        actor,
        action: "PAYROLL_EXPORTED",
        entityType: "PAYROLL",
        entityId: `${year}-${monthStr}`,
        details: `Exported monthly payroll CSV for ${year}-${monthStr}`,
      });

      const csvHeaders = [
        "Operator",
        "PresentDays",
        "LateDays",
        "WorkedHours",
        "OtHours",
        "RegularPay",
        "OtPay",
        "GrossPay",
      ];

      const csvDataRows = summary.rows.map((r) => [
        r.operatorName,
        r.presentDays,
        r.lateDays,
        r.workedHours,
        r.otHours,
        r.regularPay,
        r.otPay,
        r.grossPay,
      ]);

      const totalsRow = [
        "TOTAL",
        summary.totals.presentDays,
        summary.totals.lateDays,
        summary.totals.workedHours,
        summary.totals.otHours,
        summary.totals.regularPay,
        summary.totals.otPay,
        summary.totals.grossPay,
      ];

      // Build CSV with UTF-8 BOM prefix \uFEFF for seamless Excel/Tally parsing
      const csvLines = [
        csvHeaders.map(escapeCsv).join(","),
        ...csvDataRows.map((row) => row.map(escapeCsv).join(",")),
        totalsRow.map(escapeCsv).join(","),
      ];
      const csvContent = "\uFEFF" + csvLines.join("\n");

      const filename = `payroll-${year}-${monthStr}.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error in payroll API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
