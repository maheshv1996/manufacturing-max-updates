import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { permissionForPath } from "@/lib/departments";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSecretKey } from "@/lib/auth";

// Next 16 proxies always run on the Node.js runtime, so the proxy can query
// the DB directly to re-check sessionEpoch — this is what makes session
// rotation (role/permission change) real: revoked or re-roled users lose
// access immediately, not at token expiry.

// Routes fully bypassed regardless of auth state
const PUBLIC_PREFIXES = [
  "/onboarding",
  "/login",
  "/landing",
  "/showroom", // Interactive client-side 3D demo showroom — public showcase
  "/terminal",
  "/track",
  "/api/setup",
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/health", // public liveness/status — the offline banner pings it from public pages too
  "/api/settings",
  "/api/marketing/landing",
  "/api/landing/lead",
  "/ops/andon", // public wall display — always accessible
  // Shop-floor kiosk APIs — the /terminal is a LAN kiosk by design: operators
  // clock in with an employee number (no web session), so every endpoint the
  // terminal calls must pass through to the routes (which hold their own
  // manager-action guards). Without these the proxy 401s the kiosk before the
  // route ever runs.
  "/api/operator",
  "/api/terminal",
  "/api/attendance/clock",
  "/api/ipcc",
  "/api/hold-points",
  "/api/ideas",
  "/api/logs",
  "/api/maintenance/jobs",
  "/api/movement",
  "/api/safety",
  "/api/shift-counts",
  "/_next",
  "/favicon.ico",
  "/grid.svg",
];

// Public gateway page — renders for anonymous visitors, but logged-in
// users still get identity headers forwarded so the gateway can show
// "continue to workspace" states.
const GATEWAY_PATH = "/";

export async function proxy(request: NextRequest) {
  // Fail-closed in production: auth cannot be bypassed in production builds
  const isAuthEnabled =
    process.env.NODE_ENV === "production"
      ? true
      : process.env.AUTH_ENABLED !== "false";

  if (!isAuthEnabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow static files (.js, .css, .ico, etc.) and public routes. When a valid
  // session exists we still forward identity headers so public surfaces (e.g.
  // /api/auth/me, the gateway, /login) can greet the logged-in user by name.
  if (
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    ) ||
    /\.(js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|map|txt|webmanifest)$/i.test(pathname)
  ) {
    const sessionCookie = request.cookies.get("app_session")?.value;
    if (sessionCookie) {
      try {
        const { payload } = await jwtVerify(sessionCookie, getSecretKey());
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", (payload.id as string) || "");
        requestHeaders.set(
          "x-user-name",
          (payload.name as string) || (payload.username as string) || "",
        );
        requestHeaders.set("x-user-role-id", (payload.roleId as string) || "");
        requestHeaders.set(
          "x-user-role-name",
          (payload.roleName as string) || "",
        );
        requestHeaders.set(
          "x-user-is-owner",
          payload.isOwner ? "true" : "false",
        );
        requestHeaders.set(
          "x-user-level",
          (payload.level as string) || "WORKER",
        );
        requestHeaders.set(
          "x-user-permissions",
          ((payload.permissions as string[]) || []).join(","),
        );
        requestHeaders.set(
          "x-user-must-change-password",
          payload.mustChangePassword ? "true" : "false",
        );
        return NextResponse.next({ request: { headers: requestHeaders } });
      } catch {
        // Invalid/expired session — treat as anonymous.
      }
    }
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("app_session")?.value;

  // No session → the gateway stays public, everything else goes to /login (401 for APIs)
  if (!sessionCookie) {
    if (pathname === GATEWAY_PATH) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT
  try {
    const { payload } = await jwtVerify(sessionCookie, getSecretKey());
    const roleId = payload.roleId as string;
    const roleName = payload.roleName as string;
    const isOwner = payload.isOwner as boolean;
    const permissions = (payload.permissions as string[]) || [];
    let mustChangePassword = payload.mustChangePassword as boolean;
    const userId = payload.id as string;
    const username = payload.username as string;
    const displayName = (payload.name as string) || username;
    const sess = (payload.sess as number) || 0;

    // Session rotation: re-check the DB epoch + active flag on every request so
    // a role/permission change, password reset, or disable invalidates existing
    // sessions immediately. Skipped for the .env fallback users (no DB row) and
    // fails open on a DB hiccup so an infrastructure blip never bricks login —
    // authentication itself stays fail-closed.
    if (!userId.startsWith("fallback-")) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            sessionEpoch: true,
            isActive: true,
            mustChangePassword: true,
          },
        });
        if (!dbUser || !dbUser.isActive || dbUser.sessionEpoch !== sess) {
          // Session was rotated or the user was disabled — drop the cookie.
          if (pathname.startsWith("/api/")) {
            const res = NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 },
            );
            res.cookies.delete("app_session");
            return res;
          }
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("from", pathname);
          const res = NextResponse.redirect(loginUrl);
          res.cookies.delete("app_session");
          return res;
        }
        mustChangePassword = dbUser.mustChangePassword;
      } catch {
        // DB unreachable — fall back to the JWT claims (offline tolerance).
      }
    }

    const isPasswordResetRoute =
      pathname === "/change-password" ||
      pathname === "/api/auth/change-password" ||
      pathname === "/api/auth/logout";

    if (mustChangePassword && !isPasswordResetRoute) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Password change required" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/change-password", request.url));
    }

    // Users with ONLY terminal.use should be restricted to /terminal
    const hasOnlyTerminalAccess =
      !isOwner && permissions.length === 1 && permissions[0] === "terminal.use";
    if (hasOnlyTerminalAccess) {
      const isAllowed =
        pathname === "/terminal" ||
        pathname.startsWith("/terminal/") ||
        pathname.startsWith("/api/operator/") ||
        pathname.startsWith("/api/overtime") || // P9 — OT requests originate from the floor
        pathname.startsWith("/api/ipcc") || // P10 — IPQC checklists run on the floor
        pathname.startsWith("/api/auth/") ||
        pathname === "/change-password";

      if (!isAllowed) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/terminal", request.url));
      }
    }

    // Department permission check for routes
    const requiredPerm = permissionForPath(pathname);
    if (requiredPerm && !can({ isOwner, permissions }, requiredPerm)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden: insufficient permissions" },
          { status: 403 },
        );
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "unauthorized");
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Forward user info to server components via request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", userId);
    requestHeaders.set("x-user-name", displayName);
    requestHeaders.set("x-user-role-id", roleId);
    requestHeaders.set("x-user-role-name", roleName);
    requestHeaders.set("x-user-is-owner", isOwner ? "true" : "false");
    requestHeaders.set("x-user-level", (payload.level as string) || "WORKER");
    requestHeaders.set("x-user-permissions", permissions.join(","));
    requestHeaders.set(
      "x-user-must-change-password",
      mustChangePassword ? "true" : "false",
    );

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Invalid/expired token → treat as unauthenticated
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
