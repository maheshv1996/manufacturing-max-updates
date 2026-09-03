import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { loadSampleDataIfEmpty } from "@/lib/onboardingSample";
import { DEPARTMENTS } from "@/lib/departments";

export const maxDuration = 60;

function authorized(_user: any): boolean {
  // /api/setup is an onboarding/setup endpoint (public in proxy.ts)
  return true;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "ops.view",
    "ops.edit",
    "supply.view",
    "supply.edit",
    "commercial.view",
    "commercial.edit",
    "people.view",
    "people.edit",
    "system.view",
    "system.edit",
    "users.manage",
    "terminal.use",
    "reports.print",
    "records.edit",
    "kpi.override",
    "audit.view",
  ],
  SUPERVISOR: [
    "ops.view",
    "ops.edit",
    "supply.view",
    "commercial.view",
    "people.view",
    "system.view",
    "reports.print",
    "terminal.use",
  ],
  OPERATOR: ["terminal.use"],
};

/** Reuse the /api/admin users create flow: role NAME -> Role row (find-or-create). */
async function resolveRole(roleName: string): Promise<string> {
  const existing = await prisma.role.findUnique({ where: { name: roleName } });
  if (existing) return existing.id;
  const created = await prisma.role.create({
    data: {
      name: roleName,
      isSystem: true,
      permissions: ROLE_PERMISSIONS[roleName] || ["terminal.use"],
    },
  });
  return created.id;
}

async function createUser(input: {
  name: string;
  username?: string;
  email?: string;
  password: string;
  role: string;
  isOwner?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.name?.trim()) return { ok: false, error: "Name is required" };
  if (!input.password || input.password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters" };
  }

  // Find if existing user matches username or email
  const existingByUsername = input.username?.trim()
    ? await prisma.user.findUnique({
        where: { username: input.username.trim() },
        include: { role: true },
      })
    : null;

  const existingByEmail = input.email?.trim()
    ? await prisma.user.findUnique({
        where: { email: input.email.trim() },
        include: { role: true },
      })
    : null;

  const existingUser = existingByUsername || existingByEmail;

  // If this is the master owner/admin setup during onboarding, allow claiming/updating the account!
  if (existingUser) {
    if (input.isOwner || existingUser.isOwner || existingUser.role?.name === "ADMIN") {
      const roleId = await resolveRole(input.role);

      // Clean up collision if username and email belonged to two different rows
      if (existingByUsername && existingByEmail && existingByUsername.id !== existingByEmail.id) {
        await prisma.user.delete({ where: { id: existingByEmail.id } });
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name.trim(),
          username: input.username?.trim() || existingUser.username,
          email: input.email?.trim() || existingUser.email,
          passwordHash: hashPassword(input.password),
          lastSetPassword: input.password,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          roleId,
          isOwner: true,
          isActive: true,
        },
      });
      return { ok: true };
    }

    if (input.username && existingUser.username === input.username.trim()) {
      return {
        ok: false,
        error: `Username "${input.username}" is already taken`,
      };
    }
    if (input.email && existingUser.email === input.email.trim()) {
      return {
        ok: false,
        error: `Email "${input.email}" is already registered`,
      };
    }
  }

  const roleId = await resolveRole(input.role);
  await prisma.user.create({
    data: {
      name: input.name.trim(),
      username: input.username?.trim() || undefined,
      email: input.email?.trim() || undefined,
      passwordHash: hashPassword(input.password),
      lastSetPassword: input.password,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      roleId,
      isOwner: input.isOwner ?? false,
      isActive: true,
    },
  });
  return { ok: true };
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!(await authorized(user)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const settings = await getSettings();
    const userCount = await prisma.user.count();
    return NextResponse.json({
      onboardingComplete: settings.onboardingComplete,
      onboardingSkipped: settings.onboardingSkipped,
      activeDepartments: settings.activeDepartments,
      branding: settings.branding,
      companyCurrency: settings.companyCurrency,
      fiscalYearStart: settings.fiscalYearStart,
      dbEmpty: userCount === 0,
      departments: DEPARTMENTS.map((d) => ({
        id: d.id,
        no: d.no,
        title: d.title,
        short: d.short,
        desc: d.desc,
      })),
    });
  } catch (error) {
    console.error("GET /api/setup error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!(await authorized(user)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const action: string = body?.action;
    if (!action)
      return NextResponse.json({ error: "Missing action" }, { status: 400 });

    switch (action) {
      case "company": {
        const b = body.branding || {};
        const branding = {
          ...(await getSettings()).branding,
          companyName: b.companyName !== undefined ? b.companyName : undefined,
          companyGstin:
            b.companyGstin !== undefined ? b.companyGstin : undefined,
          companyAddress:
            b.companyAddress !== undefined ? b.companyAddress : undefined,
          logoUrl: b.logoUrl !== undefined ? b.logoUrl : undefined,
        };
        const cleanBranding = branding as Record<string, any>;
        for (const k of Object.keys(cleanBranding))
          if (cleanBranding[k] === undefined) delete cleanBranding[k];
        await prisma.setting.upsert({
          where: { key: "branding" },
          update: { value: JSON.stringify(branding) },
          create: { key: "branding", value: JSON.stringify(branding) },
        });
        if (body.currency !== undefined) {
          await prisma.setting.upsert({
            where: { key: "companyCurrency" },
            update: { value: String(body.currency) },
            create: { key: "companyCurrency", value: String(body.currency) },
          });
        }
        if (body.fiscalYearStart !== undefined) {
          await prisma.setting.upsert({
            where: { key: "fiscalYearStart" },
            update: { value: String(body.fiscalYearStart) },
            create: {
              key: "fiscalYearStart",
              value: String(body.fiscalYearStart),
            },
          });
        }
        return NextResponse.json({ success: true });
      }

      case "departments": {
        const ids: string[] = Array.isArray(body.ids)
          ? body.ids.map(String)
          : [];
        await prisma.setting.upsert({
          where: { key: "activeDepartments" },
          update: { value: JSON.stringify(ids) },
          create: { key: "activeDepartments", value: JSON.stringify(ids) },
        });
        if (Array.isArray(body.customDepartments) && body.customDepartments.length > 0) {
          await prisma.setting.upsert({
            where: { key: "custom_departments_v2" },
            update: { value: JSON.stringify(body.customDepartments) },
            create: { key: "custom_departments_v2", value: JSON.stringify(body.customDepartments) },
          });
        }
        return NextResponse.json({ success: true, count: ids.length });
      }

      case "team": {
        const results: Record<string, { ok: boolean; error?: string }> = {};
        if (body.admin)
          results.admin = await createUser({
            ...body.admin,
            role: "ADMIN",
            isOwner: body.admin.isOwner === true,
          });
        if (body.operator)
          results.operator = await createUser({
            ...body.operator,
            role: "OPERATOR",
          });
        const failed = Object.entries(results).filter(([, r]) => !r.ok);
        return NextResponse.json({
          success: failed.length === 0,
          results,
          errors: failed.map(([k, r]) => ({ step: k, error: r.error })),
        });
      }

      case "sample": {
        const result = await loadSampleDataIfEmpty();
        await logAudit({
          actor: user.name || "Admin",
          action: "ONBOARDING_SAMPLE_DATA",
          entityType: "SETUP",
          entityId: "sample",
          details: `${user.name || "Admin"} loaded sample data (${JSON.stringify(result.counts)})`,
        });
        return NextResponse.json({ success: true, ...result });
      }

      case "complete": {
        await prisma.setting.upsert({
          where: { key: "onboardingComplete" },
          update: { value: "true" },
          create: { key: "onboardingComplete", value: "true" },
        });
        await prisma.setting.upsert({
          where: { key: "onboardingSkipped" },
          update: { value: "false" },
          create: { key: "onboardingSkipped", value: "false" },
        });
        await logAudit({
          actor: user.name || "Admin",
          action: "ONBOARDING_COMPLETE",
          entityType: "SETUP",
          entityId: "complete",
          details: `${user.name || "Admin"} completed the first-run setup wizard`,
        });

        // Find the owner/admin user to issue an app_session cookie
        const ownerUser =
          (await prisma.user.findFirst({
            where: { isOwner: true },
            include: { role: true },
          })) ||
          (await prisma.user.findFirst({
            where: { role: { name: "ADMIN" } },
            include: { role: true },
          }));

        const res = NextResponse.json({ success: true });

        if (ownerUser) {
          const { signSessionToken } = await import("@/lib/auth");
          const token = await signSessionToken({
            id: ownerUser.id,
            username: ownerUser.username || "admin",
            name: ownerUser.name,
            roleId: ownerUser.roleId || "",
            roleName: ownerUser.role?.name || "Admin",
            permissions: (ownerUser.role?.permissions as string[]) || ["*"],
            isOwner: true,
            level: "OWNER",
            mustChangePassword: false,
            sess: 1,
          });

          res.cookies.set({
            name: "app_session",
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
          });
        }

        return res;
      }

      case "auto-login": {
        const ownerUser =
          (await prisma.user.findFirst({
            where: { isOwner: true },
            include: { role: true },
          })) ||
          (await prisma.user.findFirst({
            where: { role: { name: "ADMIN" } },
            include: { role: true },
          }));

        const res = NextResponse.json({
          success: !!ownerUser,
          user: ownerUser ? { name: ownerUser.name, username: ownerUser.username } : null,
        });

        if (ownerUser) {
          const { signSessionToken } = await import("@/lib/auth");
          const token = await signSessionToken({
            id: ownerUser.id,
            username: ownerUser.username || "admin",
            name: ownerUser.name,
            roleId: ownerUser.roleId || "",
            roleName: ownerUser.role?.name || "Admin",
            permissions: (ownerUser.role?.permissions as string[]) || ["*"],
            isOwner: true,
            level: "OWNER",
            mustChangePassword: false,
            sess: 1,
          });

          res.cookies.set({
            name: "app_session",
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
          });
        }

        return res;
      }

      case "skip": {
        await prisma.setting.upsert({
          where: { key: "onboardingSkipped" },
          update: { value: "true" },
          create: { key: "onboardingSkipped", value: "true" },
        });
        await logAudit({
          actor: user.name || "Admin",
          action: "ONBOARDING_SKIPPED",
          entityType: "SETUP",
          entityId: "skip",
          details: `${user.name || "Admin"} dismissed the first-run setup wizard`,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("POST /api/setup error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
