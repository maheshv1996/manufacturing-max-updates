import PageHeader from "@/app/components/shared/PageHeader";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Play, Square, Wrench, Plus } from "lucide-react";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const machines = await prisma.machine.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      productionLogs: {
        where: { status: "DRAFT" },
        include: { workOrder: true },
        take: 1,
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machines & Equipment"
        description="Manage machines, status, and capacities."
        icon={<Wrench className="w-5 h-5" />}
        iconTone="blue"
        action={{
          label: "Add Machine",
          href: "/system/admin?tab=machines",
          icon: <Plus className="w-4 h-4" />,
          primary: true,
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map((machine) => {
          const isRunning = machine.status === "RUNNING";
          const isDown = machine.status === "DOWN";
          const isIdle = machine.status === "IDLE";

          return (
            <Link href={`/system/machines/${machine.id}`} key={machine.id}>
              <div className="bg-surface-1 border border-border rounded-card p-5 hover:border-slate-600 transition-colors cursor-pointer flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-text-1 text-lg">
                      {machine.name}
                    </h3>
                    <p className="text-text-3 text-sm">{machine.code}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      isRunning
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isDown
                          ? "bg-rose-500/10 text-rose-500"
                          : isIdle
                            ? "bg-slate-500/10 text-slate-400"
                            : "bg-orange-500/10 text-orange-500"
                    }`}
                  >
                    {isRunning ? (
                      <Play className="w-3 h-3" />
                    ) : isDown ? (
                      <Wrench className="w-3 h-3" />
                    ) : (
                      <Square className="w-3 h-3" />
                    )}
                    {machine.status}
                  </span>
                </div>

                <div className="pt-4 border-t border-border mt-auto">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-2 text-xs uppercase tracking-wider">
                      Active Job
                    </span>
                    <span className="font-medium text-text-1 truncate max-w-[150px]">
                      {machine.productionLogs[0]?.workOrder?.woNumber || "None"}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
