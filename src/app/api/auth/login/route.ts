import { can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import { NextResponse } from "next/server";
import { signSessionToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { findUserByIdentifier } from "@/lib/employeeLookup";

// Login hardening: 5 failed attempts per user per 10 minutes -> 15-minute
// lockout. Tracked in the LoginAttempt table (audited, pruned daily).
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

async function clientIp(request: Request): Promise<string> {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

/** True while >=5 failures from this identifier sit in the trailing 10-min window. */
async function checkLockout(
  identifier: string,
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const fails = await prisma.loginAttempt.findMany({
    where: { identifier, success: false, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: RATE_MAX_FAILS,
    select: { createdAt: true },
  });
  if (fails.length < RATE_MAX_FAILS)
    return { locked: false, retryAfterSeconds: 0 };
  const lockUntil = fails[0].createdAt.getTime() + LOCKOUT_MS;
  const remaining = lockUntil - Date.now();
  if (remaining <= 0) return { locked: false, retryAfterSeconds: 0 };
  return { locked: true, retryAfterSeconds: Math.ceil(remaining / 1000) };
}

/** Keep the table small — drop attempts older than a day. */
async function pruneAttempts() {
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, requestedPath } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    const identifier = String(username).trim().toLowerCase();
    const ip = await clientIp(request);

    // 1. Lockout gate — reject before doing ANY credential work.
    const { locked, retryAfterSeconds } = await checkLockout(identifier);
    if (locked) {
      await logAudit({
        actor: username,
        action: "LOGIN_LOCKOUT",
        entityType: "USER",
        details: `Login blocked for ${identifier} — ${RATE_MAX_FAILS} failures in ${RATE_WINDOW_MS / 60000} min (lockout ${LOCKOUT_MS / 60000} min, ip ${ip})`,
      });
      return NextResponse.json(
        {
          error: `Too many failed attempts. Account is locked. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }

    let validUsername = "";
    let userId = "";
    let mustChangePassword = false;
    let landingPage: string | null = null;
    let roleId = "";
    let roleName = "";
    let permissions: string[] = [];
    let isOwner = false;
    let sessionEpoch = 0;

    // 2. Try Database Auth — employee number FIRST (badge culture), then
    //    username/email fallback so legacy accounts keep working.
    const user = (await findUserByIdentifier(prisma, username, {
      includeRole: true,
    })) as any;

    if (user && user.passwordHash) {
      const isValid = verifyPassword(password, user.passwordHash);
      if (isValid) {
        validUsername = user.username || user.email || username;
        userId = user.id;
        mustChangePassword = user.mustChangePassword;
        roleId = user.roleId || "";
        roleName = user.role?.name || "";
        permissions = user.role?.permissions || [];
        isOwner = user.isOwner;
        sessionEpoch = user.sessionEpoch || 0;
        if (
          user.prefs &&
          typeof user.prefs === "object" &&
          "landingPage" in user.prefs
        ) {
          landingPage = (user.prefs as any).landingPage as string;
        }
      }
    }

    // 3. Fallback to .env Auth
    if (!userId) {
      const adminUser = process.env.ADMIN_USER || "admin";
      const adminPass = process.env.ADMIN_PASSWORD || "factory123";

      const operatorUser = process.env.OPERATOR_USER || "operator";
      const operatorPass = process.env.OPERATOR_PASSWORD || "operator123";

      if (username === adminUser && password === adminPass) {
        roleName = "Administrator";
        permissions = [
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
          "quality.view",
          "quality.edit",
          "metrology.view",
          "metrology.edit",
          "engineering.view",
          "engineering.edit",
          "finance.view",
          "finance.edit",
          "ehs.view",
          "ehs.edit",
          "maintenance.view",
          "maintenance.edit",
          "projects.view",
          "projects.edit",
          "exec.view",
          "exec.edit",
          "users.manage",
          "terminal.use",
          "reports.print",
          "records.edit",
          "kpi.override",
          "audit.view",
        ];
        isOwner = true;
        validUsername = adminUser;
        userId = "fallback-admin";
      } else if (username === operatorUser && password === operatorPass) {
        roleName = "Operator";
        permissions = ["terminal.use"];
        isOwner = false;
        validUsername = operatorUser;
        userId = "fallback-operator";
      }
    }

    // 4. Failed attempt — record + audit, then reject.
    if (!userId) {
      await prisma.loginAttempt.create({
        data: { identifier, success: false, ip },
      });
      await pruneAttempts();
      await logAudit({
        actor: username,
        action: "LOGIN_FAILED",
        entityType: "USER",
        details: `Invalid credentials for ${identifier} (ip ${ip})`,
      });
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    }

    // Success — clear the failure window so the counter resets.
    await prisma.loginAttempt.deleteMany({
      where: {
        identifier,
        success: false,
        createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) },
      },
    });
    await prisma.loginAttempt.create({
      data: { identifier, success: true, ip },
    });
    await pruneAttempts();

    const token = await signSessionToken({
      id: userId,
      username: validUsername,
      name: user?.name || validUsername,
      roleId,
      roleName,
      permissions,
      isOwner,
      level: user?.level || "WORKER",
      mustChangePassword,
      sess: sessionEpoch,
    });
    const isProd = process.env.NODE_ENV === "production";

    // Contextual login: if the user asked for a specific page, verify server-side
    // that their role grants access to that department; otherwise fall back to their hub.
    const defaultRedirect =
      !isOwner && permissions.length === 1 && permissions[0] === "terminal.use"
        ? "/terminal"
        : landingPage || "/";
    let finalRedirect = mustChangePassword
      ? "/change-password"
      : defaultRedirect;
    if (requestedPath && !mustChangePassword) {
      const perm = permissionForPath(requestedPath);
      if (perm && can({ isOwner, permissions }, perm)) {
        finalRedirect = requestedPath;
      }
    }

    const response = NextResponse.json({
      success: true,
      role: roleName,
      redirectTo: finalRedirect,
    });

    response.cookies.set({
      name: "app_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours — bounded window for stale role claims
    });

    // Log success
    await logAudit({
      actor: validUsername,
      action: "LOGIN_SUCCESS",
      entityType: "USER",
      entityId: userId,
      details: `User ${validUsername} logged in`,
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "An unexpected authentication error occurred." },
      { status: 500 },
    );
  }
}
