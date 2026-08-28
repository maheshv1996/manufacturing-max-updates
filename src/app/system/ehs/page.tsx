"use client";

import { useState } from "react";
import DynamicRegister from "@/app/components/shared/DynamicRegister";
import { HeartPulse, Recycle, Flame } from "lucide-react";

export default function EhsPage() {
  const [tab, setTab] = useState<"health" | "environment" | "fire">("health");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap print:hidden">
        <button
          onClick={() => setTab("health")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "health"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <HeartPulse className="w-4 h-4" /> Occupational Health
        </button>
        <button
          onClick={() => setTab("environment")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "environment"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Recycle className="w-4 h-4" /> Environmental Compliance
        </button>
        <button
          onClick={() => setTab("fire")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "fire"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Flame className="w-4 h-4" /> Fire & Emergency Drills
        </button>
      </div>

      {tab === "health" && (
        <DynamicRegister
          config={{
            title: "Occupational Health Register",
            description:
              "Periodic employee health checks (BP, vision, audiometry) and fitness classification.",
            entity: "healthChecks",
            icon: HeartPulse,
            accent: "bg-rose-500/10 text-rose-400 border-rose-500/30",
            fields: [
              { key: "employeeName", label: "Employee Name", required: true },
              { key: "employeeCode", label: "Employee Code" },
              { key: "checkDate", label: "Check Date", type: "date" },
              {
                key: "bloodPressure",
                label: "Blood Pressure",
                placeholder: "e.g. 120/80",
              },
              { key: "vision", label: "Vision", placeholder: "e.g. 6/6" },
              {
                key: "audiometry",
                label: "Audiometry",
                placeholder: "e.g. Normal",
              },
              { key: "weightKg", label: "Weight (kg)", type: "number" },
              {
                key: "fitnessStatus",
                label: "Fitness Status",
                type: "select",
                options: ["FIT", "FIT_WITH_NOTES", "UNFIT"],
              },
              { key: "conductedBy", label: "Conducted By" },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
            columns: [
              { key: "employeeName", label: "Employee" },
              { key: "employeeCode", label: "Code" },
              { key: "checkDate", label: "Date", format: "date" },
              { key: "bloodPressure", label: "BP" },
              { key: "vision", label: "Vision" },
              { key: "audiometry", label: "Audiometry" },
              { key: "fitnessStatus", label: "Fitness" },
              { key: "conductedBy", label: "By" },
            ],
            statusKey: "fitnessStatus",
            searchKeys: ["employeeName", "employeeCode"],
          }}
        />
      )}

      {tab === "environment" && (
        <DynamicRegister
          config={{
            title: "Environmental Compliance Register",
            description:
              "Waste, emission, effluent and permit compliance records with due dates.",
            entity: "environmentalRecords",
            icon: Recycle,
            accent: "bg-lime-500/10 text-lime-400 border-lime-500/30",
            fields: [
              {
                key: "recordType",
                label: "Type",
                type: "select",
                options: ["WASTE", "EMISSION", "EFFLUENT", "PERMIT", "OTHER"],
              },
              { key: "title", label: "Title", required: true },
              { key: "description", label: "Description", type: "textarea" },
              { key: "permitNumber", label: "Permit / Consent Number" },
              {
                key: "complianceStatus",
                label: "Compliance Status",
                type: "select",
                options: ["COMPLIANT", "PARTIAL", "NON_COMPLIANT"],
              },
              { key: "recordedAt", label: "Recorded Date", type: "date" },
              { key: "dueDate", label: "Due Date", type: "date" },
              { key: "owner", label: "Owner" },
            ],
            columns: [
              { key: "recordType", label: "Type" },
              { key: "title", label: "Title" },
              { key: "permitNumber", label: "Permit No." },
              { key: "complianceStatus", label: "Status" },
              { key: "recordedAt", label: "Recorded", format: "date" },
              { key: "dueDate", label: "Due", format: "date" },
              { key: "owner", label: "Owner" },
            ],
            statusKey: "complianceStatus",
            searchKeys: ["title", "permitNumber", "owner"],
          }}
        />
      )}

      {tab === "fire" && (
        <DynamicRegister
          config={{
            title: "Fire & Emergency Drill Register",
            description:
              "Fire drills, evacuation exercises and emergency response records.",
            entity: "fireDrills",
            icon: Flame,
            accent: "bg-orange-500/10 text-orange-400 border-orange-500/30",
            fields: [
              { key: "drillDate", label: "Drill Date", type: "date" },
              {
                key: "location",
                label: "Location",
                required: true,
                placeholder: "e.g. Shopfloor Block B",
              },
              { key: "participants", label: "Participants", type: "number" },
              { key: "durationMin", label: "Duration (min)", type: "number" },
              {
                key: "passed",
                label: "Passed",
                type: "select",
                options: ["true", "false"],
              },
              { key: "conductedBy", label: "Conducted By" },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
            columns: [
              { key: "drillDate", label: "Date", format: "date" },
              { key: "location", label: "Location" },
              { key: "participants", label: "Participants", format: "number" },
              { key: "durationMin", label: "Duration (min)", format: "number" },
              { key: "passed", label: "Passed", format: "boolean" },
              { key: "conductedBy", label: "By" },
            ],
            searchKeys: ["location", "conductedBy"],
          }}
        />
      )}
    </div>
  );
}
