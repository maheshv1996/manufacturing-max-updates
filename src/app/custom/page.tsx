import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/app/components/shared/PageHeader";
import { Layers } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomHubPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id || (!user.isOwner && !can(user, "system.view") && !can(user, "engineering.view") && !can(user, "ops.view"))) {
    redirect("/login");
  }
  const entities = await (prisma as any).customEntity.findMany({
    include: { _count: { select: { records: true } }, fields: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Custom Entities — Infinite Flex"
        description="Invent any department, cell, or tracker. Each entity gets its own fields, table, and Flow hooks — no deploy."
        icon={<Layers className="w-6 h-6" />}
        iconTone="violet"
        badge={{ label: `${entities.length} entities`, tone: "info" }}
      />

      {entities.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-3">
          <p className="text-sm text-white/70">No custom entities yet. Create your first — e.g., <span className="font-mono font-bold text-cyan-300">Titanium Blisk Cell</span> with 2 fields.</p>
          <p className="text-xs text-white/40">Use the API: POST /api/custom/entities with title + fields, or the Onboarding “+ Add Custom Department” for departments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((e: any) => (
            <Link
              key={e.id}
              href={`/custom/${e.slug}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-violet-500/30 p-5 space-y-3 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white">{e.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">{e._count.records} records</span>
              </div>
              <p className="text-xs text-white/50 line-clamp-2">{e.description || `${e.fields.length} fields`}</p>
              <div className="flex flex-wrap gap-1.5">
                {e.fields.map((f: any) => (
                  <span key={f.id} className="text-[10px] font-mono px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">{f.label} · {f.fieldType}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-violet-950/20 border border-violet-500/20 p-5">
        <h3 className="text-sm font-bold text-violet-200">Vertical Slice — Titanium Blisk Cell</h3>
        <p className="text-xs text-white/60 mt-1">Example entity with 2 fields: <span className="font-mono text-cyan-300">blisk_serial</span> (text, required) + <span className="font-mono text-cyan-300">coating_microns</span> (number). Create it via:</p>
        <pre className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono text-white/80 overflow-x-auto">{`POST /api/custom/entities
{
  "title": "Titanium Blisk Cell",
  "description": "5-Axis blisk milling cell — demo infinite entity",
  "icon": "Layers",
  "colorTone": "violet",
  "fields": [
    { "key": "blisk_serial", "label": "Blisk Serial", "fieldType": "text", "required": true, "placeholder": "BLK-001" },
    { "key": "coating_microns", "label": "Coating (µm)", "fieldType": "number", "required": false, "placeholder": "12.5" }
  ]
}
POST /api/custom/records
{ "slug": "titanium_blisk_cell", "values": { "blisk_serial": "BLK-001", "coating_microns": 12.5 } }`}</pre>
        <p className="text-[11px] text-white/40 mt-2">Flow hook: add a Flow in <span className="font-mono">/automation/flows</span> that triggers on <span className="font-mono">CustomRecord.created where slug=titanium_blisk_cell and coating_microns &gt; 90</span> → create NCR + webhook.</p>
      </div>
    </div>
  );
}
