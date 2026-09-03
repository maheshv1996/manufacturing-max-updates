"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import Link from "next/link";
import DynamicRegister from "@/app/components/shared/DynamicRegister";
import {BadgeIndianRupee, FileSignature,
  Users
} from "lucide-react";

export default function StatutoryPageClient() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Statutory"
        description="Roster, attendance, leave and workforce operations."
        icon={<Users className="w-6 h-6" />}
        iconTone="violet"
      />

      <div className="flex justify-end">
        <Link
          href="/reports/pf-esi-challan"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
        >
          <FileSignature className="w-4 h-4" />
          Generate PF/ESI Challan
        </Link>
      </div>
      <DynamicRegister
        config={{
          title: "PF / ESI Statutory Register",
          description:
            "Monthly Provident Fund & Employee State Insurance contributions per employee (12% PF, 0.75% ESI employee / 3.25% employer).",
          entity: "statutoryContributions",
          icon: BadgeIndianRupee,
          accent: "bg-orange-500/10 text-orange-400 border-orange-500/30",
          fields: [
            {
              key: "month",
              label: "Month (YYYY-MM)",
              required: true,
              placeholder: "e.g. 2026-07",
            },
            { key: "employeeName", label: "Employee Name", required: true },
            { key: "employeeCode", label: "Employee Code" },
            {
              key: "pfNumber",
              label: "PF Number",
              placeholder: "e.g. MH/PUN/123456",
            },
            {
              key: "esiNumber",
              label: "ESI Number",
              placeholder: "e.g. 27-1234567-8",
            },
            { key: "pfWage", label: "PF Wage (₹)", type: "number" },
            { key: "pfEmployee", label: "PF Employee (₹)", type: "number" },
            { key: "pfEmployer", label: "PF Employer (₹)", type: "number" },
            { key: "esiWage", label: "ESI Wage (₹)", type: "number" },
            { key: "esiEmployee", label: "ESI Employee (₹)", type: "number" },
            { key: "esiEmployer", label: "ESI Employer (₹)", type: "number" },
            { key: "notes", label: "Notes", type: "textarea" },
          ],
          columns: [
            { key: "month", label: "Month" },
            { key: "employeeName", label: "Employee" },
            { key: "employeeCode", label: "Code" },
            { key: "pfNumber", label: "PF No." },
            { key: "pfWage", label: "PF Wage", format: "currency" },
            { key: "pfEmployee", label: "PF Emp", format: "currency" },
            { key: "pfEmployer", label: "PF Empr", format: "currency" },
            { key: "esiWage", label: "ESI Wage", format: "currency" },
            { key: "esiEmployee", label: "ESI Emp", format: "currency" },
            { key: "esiEmployer", label: "ESI Empr", format: "currency" },
          ],
          searchKeys: [
            "employeeName",
            "employeeCode",
            "month",
            "pfNumber",
            "esiNumber",
          ],
        }}
      />
    </div>
  );
}
