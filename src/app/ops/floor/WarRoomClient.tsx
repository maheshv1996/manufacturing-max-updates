"use client";

import {
  Activity,
  AlertTriangle,
  Users,
  ClipboardList,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { format } from "date-fns";

export default function WarRoomClient({
  machines,
  activeWorkOrders,
  overloadedMachines,
  lastHandover,
  pendingDisputes,
}: any) {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">Running</span>
            <Activity className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">
              {machines.filter((m: any) => m.status === "RUNNING").length}
            </span>
            <span className="text-text-3 text-xs ml-2">
              / {machines.length}
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">Faults</span>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-red-500">
              {
                machines.filter(
                  (m: any) => m.status === "FAULT" || m.status === "DOWN",
                ).length
              }
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">Active WOs</span>
            <ClipboardList className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">
              {activeWorkOrders.length}
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">
              Handover Disputes
            </span>
            <Users className="h-5 w-5 text-orange-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">{pendingDisputes}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Andon Grid (Takes 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-text-1 flex items-center gap-2">
            <Activity className="h-5 w-5" /> Live Andon
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {machines.map((machine: any) => {
              const isFault =
                machine.status === "FAULT" || machine.status === "DOWN";
              const isIdle = machine.status === "IDLE";
              const bgClass = isFault
                ? "bg-red-500/10 border-red-500/50"
                : isIdle
                  ? "bg-orange-500/10 border-orange-500/50"
                  : "bg-emerald-500/10 border-emerald-500/50";
              const textClass = isFault
                ? "text-red-500"
                : isIdle
                  ? "text-orange-500"
                  : "text-emerald-500";

              const currentAssignment = machine.assignments?.[0];

              return (
                <div
                  key={machine.id}
                  className={`rounded-card border p-3 flex flex-col gap-2 ${bgClass}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-text-1 truncate">
                      {machine.name}
                    </span>
                    <div
                      className={`h-2 w-2 rounded-full ${isFault ? "bg-red-500" : isIdle ? "bg-orange-500" : "bg-emerald-500"}`}
                    />
                  </div>
                  <div className={`text-xs font-bold ${textClass}`}>
                    {machine.status}
                  </div>
                  {currentAssignment ? (
                    <div className="text-xs text-text-2 truncate mt-1">
                      <span className="block">
                        {currentAssignment.workOrder?.orderNumber || "No WO"}
                      </span>
                      <span className="block mt-0.5">
                        {currentAssignment.user?.name || "No Operator"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-text-3 mt-1">
                      No active assignment
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <h2 className="text-lg font-bold text-text-1 flex items-center gap-2 pt-4">
            <ClipboardList className="h-5 w-5" /> Active Work Orders
          </h2>
          <div className="space-y-3">
            {activeWorkOrders.length === 0 ? (
              <p className="text-sm text-text-3">
                No active work orders right now.
              </p>
            ) : (
              activeWorkOrders.map((wo: any) => {
                const progress =
                  wo.targetQuantity > 0
                    ? (wo.producedQuantity / wo.targetQuantity) * 100
                    : 0;
                return (
                  <div
                    key={wo.id}
                    className="bg-surface-1 border border-border rounded-card p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-text-1">
                          {wo.orderNumber}
                        </span>
                        <span className="text-xs text-text-3 ml-2">
                          {wo.product?.name}
                        </span>
                      </div>
                      <span className="text-xs font-medium bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                        {wo.status}
                      </span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-2 mt-3">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-text-2 mt-2">
                      <span>{wo.producedQuantity} produced</span>
                      <span>{wo.targetQuantity} target</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right sidebar for risks and handovers */}
        <div className="space-y-6">
          <div className="bg-surface-1 border border-border rounded-card p-5">
            <h3 className="font-bold text-text-1 flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> Today's Risk
            </h3>
            {overloadedMachines.length === 0 ? (
              <div className="text-sm text-text-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Capacity
                normal.
              </div>
            ) : (
              <ul className="space-y-3">
                {overloadedMachines.map((m: any, i: number) => (
                  <li
                    key={i}
                    className="flex justify-between items-center text-sm"
                  >
                    <span
                      className="text-text-1 truncate"
                      title={m.machineName}
                    >
                      {m.machineName}
                    </span>
                    <span className="text-red-500 font-medium whitespace-nowrap">
                      {m.loadPercentage.toFixed(0)}% load
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-surface-1 border border-border rounded-card p-5">
            <h3 className="font-bold text-text-1 flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-blue-500" /> Handover Status
            </h3>
            {lastHandover ? (
              <div className="text-sm text-text-2 space-y-2">
                <div className="flex justify-between">
                  <span>Last shift:</span>
                  <span className="text-text-1">
                    {lastHandover.fromShift?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Count:</span>
                  <span className="text-text-1">
                    {lastHandover.finalCount ?? lastHandover.outCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span
                    className={
                      lastHandover.status === "AGREED"
                        ? "text-emerald-500"
                        : lastHandover.status === "DISPUTED"
                          ? "text-red-500"
                          : "text-orange-500"
                    }
                  >
                    {lastHandover.status}
                  </span>
                </div>
                <div className="pt-2 text-xs text-text-3">
                  At: {format(new Date(lastHandover.createdAt), "MMM d, HH:mm")}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-3">No handovers found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
