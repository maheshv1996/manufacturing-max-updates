import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export interface AutomationRule {
  id: string;
  name: string;
  domain: "SCM" | "FINANCE" | "QUALITY" | "MACHINE_IOT" | "TOOLING" | "HR_EHS";
  triggerEvent: string;
  conditionDescription: string;
  actions: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "rule-scm-subcontract",
    name: "Subcontractor Delay Penalty & Schedule Rebalancing",
    domain: "SCM",
    triggerEvent: "Subcontract Challan overdue by > 48 hours",
    conditionDescription: "Material is Titanium/Inconel & Work Order Priority is AOG/URGENT",
    actions: ["Apply vendor scorecard penalty", "Alert SCM Lead", "Rebalance assembly schedule"],
    isActive: true,
    triggerCount: 4,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "rule-fin-credit",
    name: "Customer Credit Limit & Overdue Lockout Guard",
    domain: "FINANCE",
    triggerEvent: "Invoice unpaid > 45 days OR Exposure > Credit Limit ($250K)",
    conditionDescription: "Customer Payment Terms = Net 30",
    actions: ["Freeze new dispatch creation", "Alert Commercial Director", "Auto-send Dunning Notice"],
    isActive: true,
    triggerCount: 12,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 22).toISOString(),
  },
  {
    id: "rule-tool-wear",
    name: "Carbide Insert Flank Wear Taylor Index Warning",
    domain: "TOOLING",
    triggerEvent: "Tool cutting time reaches 95% of Taylor rating",
    conditionDescription: "Spindle speed > 10,000 RPM on Hardened Alloys",
    actions: ["Pop up Tool Change prompt on Kiosk", "Decrement crib stock reserve", "Log tool change in OEE"],
    isActive: true,
    triggerCount: 28,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "rule-iot-idle",
    name: "Unlogged Spindle Micro-Stoppage Sentinel",
    domain: "MACHINE_IOT",
    triggerEvent: "Spindle Current Draw = 0 Amps for > 25 minutes during shift",
    conditionDescription: "No active downtime reason code submitted on Kiosk",
    actions: ["Trigger Amber Andon light", "Ping Cell Supervisor tablet", "Record unallocated loss in OEE"],
    isActive: true,
    triggerCount: 19,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: "rule-hr-ot",
    name: "Statutory 50-Hour Overtime Compliance Shield",
    domain: "HR_EHS",
    triggerEvent: "Machinist monthly overtime reaches 45 hours",
    conditionDescription: "Factories Act Statutory Monthly Limit = 50 hours",
    actions: ["Restrict OT on shift roster", "Notify HR Time Office", "Request relief worker allocation"],
    isActive: true,
    triggerCount: 7,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: "rule-qual-calib",
    name: "Metrology Calibration Expiry Hard Lock",
    domain: "QUALITY",
    triggerEvent: "Vernier / Micrometer / CMM calibration due date < today",
    conditionDescription: "Instrument status is ACTIVE in crib",
    actions: ["Lock instrument in IPQC checklist", "Send recalibration work order to Cal Lab", "Flag quarantine hold"],
    isActive: true,
    triggerCount: 3,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
];

async function getStoredRules() {
  const row = await prisma.setting.findUnique({ where: { key: "automation_rules_v2" } });
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return DEFAULT_RULES;
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["system.view", "ops.view", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rules = await getStoredRules();
    return NextResponse.json({ success: true, rules });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const action = typeof body.action === "string" ? body.action : "";
    const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";
    const newRule = body.newRule as Record<string, unknown> | undefined;

    let rules = await getStoredRules();
    let auditDetails = `Automation action: ${action}`;

    if (action === "TOGGLE_ACTIVE") {
      rules = rules.map((r: AutomationRule) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
      auditDetails = `Toggled active state for automation rule ${ruleId}`;
    } else if (action === "TEST_FIRE") {
      rules = rules.map((r: AutomationRule) =>
        r.id === ruleId
          ? {
              ...r,
              triggerCount: r.triggerCount + 1,
              lastTriggeredAt: new Date().toISOString(),
            }
          : r
      );
      auditDetails = `Test-fired automation rule ${ruleId}`;
    } else if (action === "ADD_RULE" && newRule) {
      const created: AutomationRule = {
        id: "rule-" + Date.now().toString().slice(-6),
        name: typeof newRule.name === "string" ? newRule.name.slice(0, 100) : "Custom Rule",
        domain: (typeof newRule.domain === "string" ? newRule.domain : "QUALITY") as AutomationRule["domain"],
        triggerEvent: typeof newRule.triggerEvent === "string" ? newRule.triggerEvent.slice(0, 100) : "EVENT",
        conditionDescription: typeof newRule.conditionDescription === "string" ? newRule.conditionDescription.slice(0, 200) : "Universal Condition",
        actions: Array.isArray(newRule.actions) ? newRule.actions.map(String) : ["Alert Supervisor"],
        isActive: true,
        triggerCount: 0,
      };
      rules = [created, ...rules];
      auditDetails = `Created new automation rule "${created.name}"`;
    }

    const actor = user.name || user.id || "Admin";

    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "automation_rules_v2" },
        update: { value: JSON.stringify(rules) },
        create: { key: "automation_rules_v2", value: JSON.stringify(rules) },
      });

      await logAuditTx(tx, {
        actor,
        action: "AUTOMATION_RULE_SAVED",
        entityType: "Setting",
        details: auditDetails,
      });
    });

    return NextResponse.json({ success: true, rules });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
