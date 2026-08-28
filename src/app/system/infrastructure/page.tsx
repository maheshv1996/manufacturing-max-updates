"use client";

import { useState } from "react";
import DynamicRegister from "@/app/components/shared/DynamicRegister";
import { Server, DatabaseBackup } from "lucide-react";

export default function InfrastructurePage() {
  const [tab, setTab] = useState<"assets" | "backups">("assets");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("assets")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "assets"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Server className="w-4 h-4" /> Infrastructure & Networks
        </button>
        <button
          onClick={() => setTab("backups")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "backups"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <DatabaseBackup className="w-4 h-4" /> Data & Backups
        </button>
      </div>

      {tab === "assets" && (
        <DynamicRegister
          config={{
            title: "Infrastructure Assets",
            description:
              "Servers, network, workstations and peripherals with status and warranty.",
            entity: "infrastructureAssets",
            icon: Server,
            accent: "bg-rose-500/10 text-rose-400 border-rose-500/30",
            fields: [
              {
                key: "assetType",
                label: "Type",
                type: "select",
                options: [
                  "SERVER",
                  "NETWORK",
                  "WORKSTATION",
                  "PRINTER",
                  "UPS",
                  "OTHER",
                ],
              },
              { key: "name", label: "Asset Name", required: true },
              {
                key: "ipAddress",
                label: "IP Address",
                placeholder: "e.g. 10.0.0.5",
              },
              {
                key: "location",
                label: "Location",
                placeholder: "e.g. Server Room",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: ["OPERATIONAL", "DEGRADED", "OFFLINE"],
              },
              { key: "warrantyUntil", label: "Warranty Until", type: "date" },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
            columns: [
              { key: "assetType", label: "Type" },
              { key: "name", label: "Asset" },
              { key: "ipAddress", label: "IP" },
              { key: "location", label: "Location" },
              { key: "status", label: "Status" },
              { key: "warrantyUntil", label: "Warranty", format: "date" },
            ],
            statusKey: "status",
            searchKeys: ["name", "ipAddress", "location"],
          }}
        />
      )}

      {tab === "backups" && (
        <DynamicRegister
          config={{
            title: "Backup Jobs",
            description: "Database backup run log — status, size, and target.",
            entity: "backupJobs",
            icon: DatabaseBackup,
            accent: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
            fields: [
              { key: "startedAt", label: "Started", type: "date" },
              { key: "completedAt", label: "Completed", type: "date" },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: ["RUNNING", "SUCCESS", "FAILED"],
              },
              { key: "sizeMb", label: "Size (MB)", type: "number" },
              {
                key: "target",
                label: "Target",
                placeholder: "e.g. PostgreSQL",
              },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
            columns: [
              { key: "startedAt", label: "Started", format: "date" },
              { key: "completedAt", label: "Completed", format: "date" },
              { key: "status", label: "Status" },
              { key: "sizeMb", label: "Size (MB)", format: "number" },
              { key: "target", label: "Target" },
            ],
            statusKey: "status",
            searchKeys: ["target"],
          }}
        />
      )}
    </div>
  );
}
