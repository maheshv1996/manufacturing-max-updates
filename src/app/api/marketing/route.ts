import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

export const DEFAULT_LANDING_CONTENT = {
  appName: "Manufacturing Max",
  badge: "Manufacturing Max",
  heroLines: ["THE DIGITAL NERVOUS", "SYSTEM OF YOUR FACTORY"],
  heroSubtitle:
    "Track OEE in real-time, eliminate downtime, and run your shop floor seamlessly with our all-in-one digital manufacturing platform.",
  ctaPrimary: "View Plans",
  ctaSecondary: "Sign In",
  stats: [
    { value: 140, suffix: "+", label: "Features" },
    { value: 13, suffix: "", label: "Reports" },
    { value: 9, suffix: "", label: "Departments" },
    { value: 3, suffix: "", label: "Plants" },
  ],
};

export async function getLandingContent(): Promise<
  typeof DEFAULT_LANDING_CONTENT
> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "landingContent" },
    });
    if (!setting?.value) return DEFAULT_LANDING_CONTENT;
    return { ...DEFAULT_LANDING_CONTENT, ...JSON.parse(setting.value) };
  } catch (e) {
    console.error("getLandingContent error:", e);
    return DEFAULT_LANDING_CONTENT;
  }
}

// Route entity keys -> Prisma model names (client exposes camelCase model names only).
const ENTITY_MODELS: Record<string, string> = {
  campaigns: "marketingCampaign",
  leads: "lead",
};

const ENTITY_FIELDS: Record<string, string[]> = {
  campaigns: [
    "name",
    "channel",
    "budget",
    "spent",
    "status",
    "startDate",
    "endDate",
    "notes",
  ],
  leads: [
    "company",
    "contactName",
    "phone",
    "email",
    "campaignId",
    "source",
    "status",
    "value",
    "notes",
  ],
};

const NUMERIC_FIELDS = new Set(["budget", "spent", "value"]);
const DATE_FIELDS = new Set(["startDate", "endDate"]);

function coerce(fields: string[], data: any): any {
  const out: any = {};
  for (const f of fields) {
    if (data[f] === undefined) continue;
    const val = data[f];
    if (NUMERIC_FIELDS.has(f))
      out[f] = val === "" || val == null ? 0 : Number(val);
    else if (DATE_FIELDS.has(f)) out[f] = val ? new Date(val) : null;
    else out[f] = val === "" ? null : val;
  }
  return out;
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["commercial.view", "commercial.edit", "system.view", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [campaigns, leads, landing] = await Promise.all([
      prisma.marketingCampaign.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { leads: true } } },
      }),
      prisma.lead.findMany({
        orderBy: { at: "desc" },
        include: { campaign: { select: { name: true } } },
      }),
      getLandingContent(),
    ]);
    return NextResponse.json({ campaigns, leads, landing });
  } catch (error) {
    console.error("GET /api/marketing error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["commercial.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actor = user.name || "Admin";

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entity, action, data } = body;
    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    }

    if (action !== "saveLanding") {
      if (!entity || !ENTITY_FIELDS[entity] || !ENTITY_MODELS[entity]) {
        return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
      }
      if ((action === "update" || action === "delete") && !data.id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      if (action !== "create" && action !== "update" && action !== "delete") {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let res: any;

      if (action === "saveLanding") {
        await tx.setting.upsert({
          where: { key: "landingContent" },
          update: { value: JSON.stringify(data) },
          create: { key: "landingContent", value: JSON.stringify(data) },
        });
        res = { key: "landingContent" };
      } else {
        const model = (tx as any)[ENTITY_MODELS[entity]];
        if (action === "create") {
          res = await model.create({
            data: coerce(ENTITY_FIELDS[entity], data),
          });
        } else if (action === "update") {
          res = await model.update({
            where: { id: data.id },
            data: coerce(ENTITY_FIELDS[entity], data),
          });
        } else if (action === "delete") {
          res = await model.delete({ where: { id: data.id } });
        }
      }

      await logAuditTx(tx, {
        actor,
        action: `${action.toUpperCase()}_${(entity || "LANDING").toUpperCase()}`,
        entityType: (entity || "LANDING").toUpperCase(),
        entityId: res?.id || data?.id || "unknown",
        details: `${actor} ${action} on ${entity || "landing page"}`,
      });

      return res;
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/marketing error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
