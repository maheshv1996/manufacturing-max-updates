import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

async function getMaintenanceData() {
  const [jobs, pmRules, tools] = await Promise.all([
    (prisma as any).maintenanceJob.findMany({
      include: { machine: { select: { name: true, code: true } } },
      orderBy: { openedAt: "desc" },
    }),
    (prisma as any).pMRule.findMany({
      include: { machine: { select: { name: true, code: true } } },
      where: { isActive: true },
      orderBy: { machineId: "asc" },
    }),
    (prisma as any).maintenanceTool.findMany({
      include: { machine: { select: { name: true, code: true } } },
      orderBy: { code: "asc" },
    }),
  ]);

  const now = new Date();
  const enrichedPM = pmRules.map((r: any) => {
    let nextDue: Date | null = null;
    let isOverdue = false;
    if (r.lastDoneAt && r.intervalDays) {
      nextDue = new Date(r.lastDoneAt);
      nextDue.setDate(nextDue.getDate() + r.intervalDays);
      isOverdue = nextDue < now;
    } else if (!r.lastDoneAt) {
      isOverdue = true;
    }
    return { ...r, nextDue, isOverdue };
  });

  const enrichedTools = tools.map((t: any) => {
    const lifePct =
      t.ratedLifeUnits > 0 ? (t.usedUnits / t.ratedLifeUnits) * 100 : 0;
    const toolStatus =
      lifePct >= 100 ? "REPLACE" : lifePct >= 90 ? "WARN" : "OK";
    return { ...t, lifePct: Number(lifePct.toFixed(1)), toolStatus };
  });

  return { jobs, pmRules: enrichedPM, tools: enrichedTools };
}

function fmt(dt?: string | Date | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#6b7280",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#dc2626",
  IN_PROGRESS: "#2563eb",
  CLOSED: "#16a34a",
};

export default async function MaintenanceRegisterPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports/maintenance");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const { jobs, pmRules, tools } = await getMaintenanceData();
  const totalCost = jobs.reduce(
    (s: number, j: any) => s + (j.costRupees || 0),
    0,
  );
  const totalLabor = jobs.reduce(
    (s: number, j: any) => s + (j.laborHours || 0),
    0,
  );
  const openJobs = jobs.filter((j: any) => j.status !== "CLOSED");
  const closedJobs = jobs.filter((j: any) => j.status === "CLOSED");
  const overduePM = pmRules.filter((r: any) => r.isOverdue);
  const criticalTools = tools.filter((t: any) => t.toolStatus !== "OK");

  return (
    <html lang="en">
      <head>
        <title>Maintenance Register — Manufacturing MES</title>
        <meta charSet="utf-8" />
        <style>{`
          @page { size: A4 portrait; margin: 18mm 15mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1e293b; margin: 0; }
          h1 { font-size: 20px; font-weight: 900; margin: 0 0 2px; }
          h2 { font-size: 13px; font-weight: 800; margin: 18px 0 8px; color: #0f172a; border-bottom: 2px solid #334155; padding-bottom: 4px; }
          h3 { font-size: 11px; font-weight: 700; margin: 10px 0 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
          th { background: #1e293b; color: white; padding: 5px 7px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
          td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) td { background: #f8fafc; }
          .badge { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 9px; font-weight: 800; }
          .ok { background: #dcfce7; color: #166534; }
          .warn { background: #fef3c7; color: #92400e; }
          .replace { background: #fee2e2; color: #991b1b; }
          .overdue { background: #fee2e2; color: #991b1b; }
          .on-track { background: #dcfce7; color: #166534; }
          .header-table { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
          .kpi-row { display: flex; gap: 12px; margin-bottom: 14px; }
          .kpi { flex: 1; background: #f1f5f9; border-radius: 6px; padding: 8px 10px; text-align: center; }
          .kpi-val { font-size: 22px; font-weight: 900; color: #0f172a; }
          .kpi-label { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 1px; }
          .desc { color: #475569; font-size: 10px; max-width: 220px; }
          @media print { .no-print { display: none; } }
        `}</style>
      </head>
      <body>
        <PrintButton />

        {/* Header */}
        <div className="header-table">
          <div>
            <h1>🔧 Maintenance Register</h1>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Generated: {new Date().toLocaleString("en-IN")}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
            <div>
              <strong>Total Jobs:</strong> {jobs.length}
            </div>
            <div>
              <strong>Open / In Progress:</strong> {openJobs.length}
            </div>
            <div>
              <strong>Closed:</strong> {closedJobs.length}
            </div>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="kpi-row">
          <div className="kpi">
            <div
              className="kpi-val"
              style={{ color: openJobs.length > 0 ? "#dc2626" : "#16a34a" }}
            >
              {openJobs.length}
            </div>
            <div className="kpi-label">Open Jobs</div>
          </div>
          <div className="kpi">
            <div
              className="kpi-val"
              style={{ color: overduePM.length > 0 ? "#d97706" : "#16a34a" }}
            >
              {overduePM.length}
            </div>
            <div className="kpi-label">PM Overdue</div>
          </div>
          <div className="kpi">
            <div
              className="kpi-val"
              style={{
                color: criticalTools.length > 0 ? "#d97706" : "#16a34a",
              }}
            >
              {criticalTools.length}
            </div>
            <div className="kpi-label">Tools at Risk</div>
          </div>
          <div className="kpi">
            <div className="kpi-val">₹{totalCost.toLocaleString("en-IN")}</div>
            <div className="kpi-label">Total Maintenance Cost</div>
          </div>
          <div className="kpi">
            <div className="kpi-val">{totalLabor.toFixed(1)}h</div>
            <div className="kpi-label">Total Labor Hours</div>
          </div>
        </div>

        {/* Maintenance Jobs */}
        <h2>📋 Maintenance Job Cards ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No maintenance jobs recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Root Cause</th>
                <th>Parts</th>
                <th>Cost ₹</th>
                <th>Labor h</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j: any) => (
                <tr key={j.id}>
                  <td>
                    <strong>{j.machine.code}</strong>
                    <br />
                    <span style={{ color: "#64748b", fontSize: 9 }}>
                      {j.machine.name}
                    </span>
                  </td>
                  <td>{j.type}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: PRIORITY_COLOR[j.priority] + "20",
                        color: PRIORITY_COLOR[j.priority],
                      }}
                    >
                      {j.priority}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: STATUS_COLOR[j.status] + "20",
                        color: STATUS_COLOR[j.status],
                      }}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td>{j.requestedByName}</td>
                  <td>{fmt(j.openedAt)}</td>
                  <td>{fmt(j.closedAt)}</td>
                  <td className="desc">{j.rootCause || "—"}</td>
                  <td className="desc">{j.partsUsed || "—"}</td>
                  <td>
                    {j.costRupees != null
                      ? `₹${j.costRupees.toLocaleString("en-IN")}`
                      : "—"}
                  </td>
                  <td>{j.laborHours != null ? `${j.laborHours}h` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* PM Schedule */}
        <h2>📅 Preventive Maintenance Schedule</h2>
        {pmRules.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No PM rules configured.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>PM Rule</th>
                <th>Interval</th>
                <th>Last Done</th>
                <th>Next Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pmRules.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.machine.code}</strong>
                    <br />
                    <span style={{ color: "#64748b", fontSize: 9 }}>
                      {r.machine.name}
                    </span>
                  </td>
                  <td>{r.title}</td>
                  <td>
                    {r.intervalDays
                      ? `${r.intervalDays} days`
                      : r.intervalRunHours
                        ? `${r.intervalRunHours}h run`
                        : "—"}
                  </td>
                  <td>{fmt(r.lastDoneAt)}</td>
                  <td>{fmt(r.nextDue)}</td>
                  <td>
                    <span
                      className={`badge ${r.isOverdue ? "overdue" : "on-track"}`}
                    >
                      {r.isOverdue ? "OVERDUE" : "ON TRACK"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Tool Life */}
        <h2>🔩 Tool Life Summary</h2>
        {tools.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No tools configured.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Machine</th>
                <th>Used</th>
                <th>Rated</th>
                <th>Life %</th>
                <th>Status</th>
                <th>Last Changed</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t: any) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                    {t.code}
                  </td>
                  <td>{t.name || "—"}</td>
                  <td>{t.kind}</td>
                  <td>{t.machine ? `${t.machine.code}` : "—"}</td>
                  <td>{t.usedUnits.toLocaleString()}</td>
                  <td>{t.ratedLifeUnits.toLocaleString()}</td>
                  <td style={{ fontWeight: 700 }}>{t.lifePct}%</td>
                  <td>
                    <span
                      className={`badge ${t.toolStatus === "REPLACE" ? "replace" : t.toolStatus === "WARN" ? "warn" : "ok"}`}
                    >
                      {t.toolStatus}
                    </span>
                  </td>
                  <td>{fmt(t.lastChangedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div
          style={{
            marginTop: 24,
            paddingTop: 12,
            borderTop: "1px solid #e2e8f0",
            color: "#94a3b8",
            fontSize: 10,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Manufacturing MES — Maintenance Register</span>
          <span>Generated {new Date().toLocaleString("en-IN")}</span>
        </div>
      </body>
    </html>
  );
}
