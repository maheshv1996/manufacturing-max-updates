import { prisma } from "@/lib/prisma";
import { computeSpcStats } from "@/lib/spcData";
import type { SpcMeasurement } from "@/lib/spcData";
import {
  CapabilityCards,
  HistogramChart,
  XBarChart,
  RangeChart,
  PChart,
} from "./SpcChartsClient";
import { Activity } from "lucide-react";
import DateRangeBar from "@/app/components/dashboard/DateRangeBar";
import { parseDateRange, ParsedDateRange } from "@/lib/date-utils";
import SpcFilterClient from "./SpcFilterClient";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSpcData(
  parsedRange: ParsedDateRange,
  machineId?: string,
  characteristic?: string,
) {
  // Find distinct machines that have measurements
  const machinesWithMeasurements = await prisma.qualityMeasurement.findMany({
    select: { machineId: true },
    distinct: ["machineId"],
  });

  const machineIds = machinesWithMeasurements.map((m) => m.machineId);
  const machines = await prisma.machine.findMany({
    where: { id: { in: machineIds } },
    select: { id: true, name: true, code: true },
  });

  const selectedMachineId =
    machineId || (machines.length > 0 ? machines[0].id : undefined);

  // Find distinct characteristics for the selected machine
  let characteristics: string[] = [];
  if (selectedMachineId) {
    const chars = await prisma.qualityMeasurement.findMany({
      where: { machineId: selectedMachineId },
      select: { characteristic: true },
      distinct: ["characteristic"],
    });
    characteristics = chars.map((c) => c.characteristic);
  }

  const selectedChar =
    characteristic ||
    (characteristics.length > 0 ? characteristics[0] : undefined);

  const machine = selectedMachineId
    ? await prisma.machine.findUnique({ where: { id: selectedMachineId } })
    : null;

  if (!machine || !selectedChar)
    return {
      machines,
      characteristics,
      data: null,
      selectedMachineId,
      selectedChar,
    };

  const rawMeasurements = await prisma.qualityMeasurement.findMany({
    where: {
      machineId: machine.id,
      characteristic: selectedChar,
      measuredAt: {
        gte: parsedRange.current.from,
        lte: parsedRange.current.to,
      },
    },
    orderBy: { measuredAt: "asc" },
  });

  const measurements: SpcMeasurement[] = rawMeasurements.map((m) => ({
    id: m.id,
    value: m.value,
    measuredAt: m.measuredAt.toISOString(),
    characteristic: m.characteristic,
    lsl: m.lsl,
    usl: m.usl,
    target: m.target,
  }));

  const productionLogs = await prisma.productionLog.findMany({
    where: {
      machineId: machine.id,
      startTime: { gte: parsedRange.current.from, lte: parsedRange.current.to },
    },
    orderBy: { startTime: "asc" },
  });

  const dailyMap = new Map<string, { good: number; scrap: number }>();
  for (const log of productionLogs) {
    const date = log.startTime.toISOString().slice(0, 10);
    const existing = dailyMap.get(date) || { good: 0, scrap: 0 };
    existing.good += log.goodQuantity;
    existing.scrap += log.scrapQuantity;
    dailyMap.set(date, existing);
  }

  const pChartInput = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))
    .filter((d) => d.good + d.scrap > 0);

  if (measurements.length === 0 && pChartInput.length === 0) {
    return {
      machines,
      characteristics,
      data: null,
      selectedMachineId: machine.id,
      selectedChar,
    };
  }

  const stats = computeSpcStats(measurements, pChartInput);
  return {
    machines,
    characteristics,
    selectedMachineId: machine.id,
    selectedChar,
    data: {
      machine: { id: machine.id, name: machine.name, code: machine.code },
      characteristic: selectedChar,
      ...stats,
    },
  };
}

export default async function SpcPage(props: {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
    machineId?: string;
    characteristic?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const parsedRange = parseDateRange(searchParams || {});

  const spcResult = await getSpcData(
    parsedRange,
    searchParams?.machineId,
    searchParams?.characteristic,
  );

  if (!spcResult || !spcResult.data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col p-8 space-y-4">
        <DateRangeBar />
        {spcResult && (
          <SpcFilterClient
            machines={spcResult.machines}
            characteristics={spcResult.characteristics}
            currentMachineId={spcResult.selectedMachineId || ""}
            currentCharacteristic={spcResult.selectedChar || ""}
          />
        )}
        <div className="flex flex-col flex-1 items-center justify-center space-y-4">
          <p className="text-slate-400">
            No SPC measurement data found for the selected criteria and date
            range.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <a
              href="/system/admin"
              className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Go to Admin &gt; QC Parameters
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { data, machines, characteristics, selectedMachineId, selectedChar } =
    spcResult;
  const { capability, histogram, xbarChart, rChart, pChart } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-600 rounded-xl shadow-lg shadow-violet-600/30">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Statistical Process Control
              </h1>
            </div>
            <p className="text-slate-400 text-sm">
              View process variation and capability metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <PrintButton />
          </div>
        </div>

        <DateRangeBar />

        <SpcFilterClient
          machines={machines}
          characteristics={characteristics}
          currentMachineId={selectedMachineId}
          currentCharacteristic={selectedChar}
        />

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2">
            <p className="text-xs text-slate-500 mb-0.5">LSL</p>
            <p className="text-lg font-bold text-rose-400">
              {capability.lsl} mm
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2">
            <p className="text-xs text-slate-500 mb-0.5">Target</p>
            <p className="text-lg font-bold text-emerald-400">
              {capability.target} mm
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2">
            <p className="text-xs text-slate-500 mb-0.5">USL</p>
            <p className="text-lg font-bold text-rose-400">
              {capability.usl} mm
            </p>
          </div>
        </div>
        {/* ── Capability Cards ── */}
        {/* Rendered as server-side data, passed to client component */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            Process Capability
          </h2>
          <CapabilityCards cap={capability} />
        </section>

        {/* ── Histogram ── */}
        <section>
          <HistogramChart
            data={histogram}
            lsl={capability.lsl}
            usl={capability.usl}
            target={capability.target}
          />
        </section>

        {/* ── X-bar & R Charts ── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            X-bar & R Control Charts — Subgroups of 5
          </h2>
          <div className="space-y-4">
            <XBarChart data={xbarChart} />
            <RangeChart data={rChart} />
          </div>
        </section>

        {/* ── P Chart ── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            P Chart — Attribute Control
          </h2>
          <PChart data={pChart} />
        </section>
      </div>
    </div>
  );
}
