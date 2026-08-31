import { prisma } from "@/lib/prisma";
import { CALIBRATION_WARNING_DAYS } from "./calibration";

const d = (v: Date | string | null | undefined): string => {
  if (!v) return "—";
  const dateObj = new Date(v);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-IN");
};

export async function buildAuditPack() {
  const [
    tools,
    activeUsers,
    certs,
    ncrs,
    eightDs,
    ppaps,
    mrms,
    controlPlans,
    grrs,
  ] = await Promise.all([
    prisma.calibratedTool.findMany({ orderBy: { expiresAt: "asc" }, take: 10 }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.certification.findMany({
      where: { isActive: true },
      include: { machine: true },
      take: 10,
    }),
    prisma.ncrReport.findMany({ orderBy: { raisedAt: "desc" }, take: 10 }),
    prisma.eightDReport.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.ppapSubmission.findMany({
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.mrmMeeting.findMany({ orderBy: { date: "desc" }, take: 10 }),
    prisma.controlPlan.findMany({ where: { status: "ACTIVE" }, take: 10 }),
    prisma.gageRnrStudy.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const openNcrs = ncrs.filter((n) => n.status === "OPEN").length;
  const expiringCal = tools.filter((t) => {
    if (t.status === "EXPIRED") return true;
    if (!t.expiresAt) return false;
    const expTime = new Date(t.expiresAt).getTime();
    if (isNaN(expTime)) return false;
    const days = (expTime - Date.now()) / 86400000;
    return days < CALIBRATION_WARNING_DAYS;
  }).length;

  const registers = [
    {
      id: "calibration",
      title: "Calibration Register (Metrology)",
      clause: "ISO 9001 cl.7.1.5 / AS9100",
      count: tools.length,
      status: expiringCal > 0 ? "ATTENTION" : "OK",
      note:
        expiringCal > 0
          ? `${expiringCal} instruments expired or expiring < ${CALIBRATION_WARNING_DAYS} days`
          : "All instruments in calibration window",
      latest: tools.length ? d(tools[0].calibratedAt) : "—",
    },
    {
      id: "training",
      title: "Operator Training / Certifications",
      clause: "ISO 9001 cl.7.2",
      count: certs.length,
      status: certs.length > 0 ? "OK" : "ATTENTION",
      note: `${activeUsers} active users · ${certs.length} certifications on file`,
      latest: certs.length ? d(certs[0].validFrom) : "—",
    },
    {
      id: "ncr",
      title: "Non-Conformance Register (NCR)",
      clause: "ISO 9001 cl.8.7",
      count: ncrs.length,
      status: openNcrs > 0 ? "ATTENTION" : "OK",
      note: `${openNcrs} open of ${ncrs.length} total`,
      latest: ncrs.length ? d(ncrs[0].raisedAt) : "—",
    },
    {
      id: "8d",
      title: "8D / CAPA Register",
      clause: "ISO 9001 cl.10.2",
      count: eightDs.length,
      status: eightDs.length ? "OK" : "ATTENTION",
      note: `${eightDs.length} reports on file`,
      latest: eightDs.length ? d(eightDs[0].createdAt) : "—",
    },
    {
      id: "ppap",
      title: "PPAP / Control Plans",
      clause: "AIAG PPAP 4th ed.",
      count: ppaps.length,
      status: ppaps.some((p) => p.status === "APPROVED") ? "OK" : "ATTENTION",
      note: `${ppaps.length} submissions · ${controlPlans.length} approved control plans`,
      latest: ppaps.length
        ? d(ppaps[0].submittedAt || ppaps[0].createdAt)
        : "—",
    },
    {
      id: "mrm",
      title: "Management Review Minutes",
      clause: "ISO 9001 cl.9.3",
      count: mrms.length,
      status: mrms.length > 0 ? "OK" : "ATTENTION",
      note: `${mrms.length} meetings recorded`,
      latest: mrms.length ? d(mrms[0].date) : "—",
    },
    {
      id: "grr",
      title: "Gage R&R / MSA Studies",
      clause: "AIAG MSA 4th ed.",
      count: grrs.length,
      status: grrs.length ? "OK" : "ATTENTION",
      note: `${grrs.length} studies on file`,
      latest: grrs.length ? d(grrs[0].createdAt) : "—",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    registers,
    coverage: {
      ok: registers.filter((r) => r.status === "OK").length,
      attention: registers.filter((r) => r.status === "ATTENTION").length,
      total: registers.length,
    },
    calibration: tools.map((t) => ({
      id: t.id,
      name: t.name,
      serial: t.serialNumber,
      cert: t.certNumber,
      calibrated: d(t.calibratedAt),
      expires: d(t.expiresAt),
      status: t.status,
    })),
    training: certs.map((c) => ({
      id: c.id,
      machine: c.machine?.name || c.machineId,
      certifiedBy: c.certifiedBy,
      validFrom: d(c.validFrom),
      validUntil: d(c.validUntil),
    })),
    ncrs: ncrs.map((n) => ({
      id: n.id,
      number: n.ncrNumber,
      severity: n.severity,
      status: n.status,
      raised: d(n.raisedAt),
    })),
    eightDs: eightDs.map((e) => ({
      id: e.id,
      number: e.reportNumber,
      severity: e.severity,
      status: e.status,
    })),
    ppaps: ppaps.map((p) => ({
      id: p.id,
      number: p.ppapNumber,
      product: p.product?.name,
      status: p.status,
    })),
    mrms: mrms.map((m) => ({
      id: m.id,
      number: m.meetingNumber,
      date: d(m.date),
      status: m.status,
    })),
  };
}
