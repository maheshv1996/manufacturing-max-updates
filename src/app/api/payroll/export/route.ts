import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function csvCell(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = getUserFromHeaders(request.headers);
  if (!user.isOwner && !canAny(user, ["people.view", "system.view"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const month = request.nextUrl.searchParams.get("month") || "";
    // P23 — approval chain: export is only allowed once the run is LOCKED.
    if (month) {
      const run = await (prisma as any).payrollRun.findUnique({
        where: { month },
      });
      if (run && run.status !== "LOCKED") {
        return NextResponse.json(
          {
            error: `Payroll run for ${month} is ${run.status} — approve and lock it before export.`,
          },
          { status: 400 },
        );
      }
    }
    const payslips = await prisma.payslip.findMany({
      where: month ? { month } : {},
      orderBy: [
        { month: "desc" },
        { salaryStructure: { employeeCode: "asc" } },
      ],
      include: { salaryStructure: true },
      take: 5000,
    });

    const header = [
      "Month",
      "Employee Code",
      "Employee Name",
      "Designation",
      "Basic Pay",
      "HRA",
      "Special Allowance",
      "Conveyance",
      "Other Allowance",
      "Gross Pay",
      "PF Deduction",
      "PT Deduction",
      "Net Pay",
    ];
    const rows = payslips.map((p) => {
      const s = p.salaryStructure;
      return [
        p.month,
        s.employeeCode,
        s.employeeName,
        s.designation || "",
        s.basicPay,
        s.hra,
        s.specialAllowance,
        s.conveyance,
        s.otherAllowance,
        p.grossPay,
        p.pfDeduction,
        p.ptDeduction,
        p.netPay,
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");
    const filename = month ? `payslips-${month}.csv` : "payslips.csv";

    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Payroll export error:", error);
    return NextResponse.json(
      { error: "Failed to export payslips" },
      { status: 500 },
    );
  }
}
