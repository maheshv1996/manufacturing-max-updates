"use client";

import { useEffect, useState } from "react";
import { Package, Warehouse } from "lucide-react";
import DynamicRegister from "@/app/components/shared/DynamicRegister";
import type { RegisterConfig } from "@/app/components/shared/DynamicRegister";
import { KpiCard } from "@/app/components/ui";

const registerConfig: RegisterConfig = {
  title: "Bin Location Register",
  description:
    "Bin map of the stores — warehouse → zone → location, with the material assigned to each bin.",
  entity: "binLocations",
  icon: Package,
  accent: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  fields: [
    {
      key: "warehouse",
      label: "Warehouse",
      required: true,
      placeholder: "e.g. RM Stores",
    },
    { key: "zone", label: "Zone", required: true, placeholder: "e.g. A" },
    {
      key: "location",
      label: "Location",
      required: true,
      placeholder: "e.g. A-03-2 (aisle-rack-level)",
    },
    {
      key: "rawMaterialId",
      label: "Raw Material ID",
      placeholder: "Material record ID…",
    },
    { key: "qty", label: "Qty in Bin", type: "number" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  columns: [
    { key: "warehouse", label: "Warehouse" },
    { key: "zone", label: "Zone" },
    { key: "location", label: "Location" },
    { key: "rawMaterialId", label: "Material" },
    { key: "qty", label: "Qty", format: "number" },
  ],
  searchKeys: ["warehouse", "zone", "location", "rawMaterialId"],
};

export default function BinMapClient() {
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/register/binLocations");
        const json = await res.json();
        if (res.ok) setBins(json.rows || []);
      } catch {
        /* register below still renders */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const warehouses = new Map<string, Map<string, number>>();
  for (const b of bins) {
    if (!warehouses.has(b.warehouse)) warehouses.set(b.warehouse, new Map());
    const zones = warehouses.get(b.warehouse)!;
    zones.set(b.zone, (zones.get(b.zone) || 0) + 1);
  }

  const occupiedBins = bins.filter((b) => b.rawMaterialId).length;
  const emptyBins = bins.length - occupiedBins;

  return (
    <div className="space-y-6">
      {loading && bins.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-800/60 bg-slate-800/40"
            />
          ))}
        </div>
      ) : warehouses.size > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KpiCard
              title="Warehouses"
              value={warehouses.size}
              tone="sky"
              icon={<Warehouse className="h-4 w-4" />}
            />
            <KpiCard
              title="Occupied Bins"
              value={occupiedBins}
              tone="emerald"
              icon={<Package className="h-4 w-4" />}
            />
            <KpiCard
              title="Empty Bins"
              value={emptyBins}
              tone="slate"
              icon={<Package className="h-4 w-4" />}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[...warehouses.entries()].map(([wh, zones]) => (
              <div
                key={wh}
                className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4"
              >
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                  <Warehouse className="h-4 w-4 text-sky-400" /> {wh}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[...zones.entries()].map(([zone, count]) => (
                    <div
                      key={zone}
                      className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
                      title={`${count} bin(s) in zone ${zone}`}
                    >
                      <span className="text-slate-300">Zone {zone}</span>
                      <span className="ml-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-slate-500">
                  {
                    bins.filter((b) => b.warehouse === wh && b.rawMaterialId)
                      .length
                  }{" "}
                  occupied ·{" "}
                  {
                    bins.filter((b) => b.warehouse === wh && !b.rawMaterialId)
                      .length
                  }{" "}
                  empty
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <DynamicRegister config={registerConfig} />
    </div>
  );
}
