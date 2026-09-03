import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");

    const cookieHeader = request.headers.get("cookie") || "";
    const savedStateCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("google_oauth_state="));
    const savedState = savedStateCookie
      ? savedStateCookie.split("=")[1]?.trim()
      : null;

    if (!code || !state || !savedState || state !== savedState) {
      console.error("Google OAuth state mismatch or missing parameters.");
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      return NextResponse.redirect(errorUrl);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      return NextResponse.redirect(errorUrl);
    }

    const protocol =
      request.headers.get("x-forwarded-proto") ||
      requestUrl.protocol.replace(":", "");
    const host = request.headers.get("host") || requestUrl.host;
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

    // Exchange authorization code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google OAuth token exchange failed:", errText);
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      return NextResponse.redirect(errorUrl);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      return NextResponse.redirect(errorUrl);
    }

    // Fetch user email from Google userinfo API
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!userInfoRes.ok) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      return NextResponse.redirect(errorUrl);
    }

    const userInfo = await userInfoRes.json();
    const email = userInfo.email ? userInfo.email.toLowerCase().trim() : null;

    if (!email) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      return NextResponse.redirect(errorUrl);
    }

    // Look up User by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        isActive: true,
      },
      include: { role: true },
    });

    if (!user) {
      await logAudit({
        actor: email,
        action: "LOGIN_FAILURE_GOOGLE",
        entityType: "USER",
        details: `Google account ${email} is not registered in MES database`,
      });

      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "google-not-registered");
      const res = NextResponse.redirect(errorUrl);
      res.cookies.delete("google_oauth_state");
      return res;
    }

    // User is found! Generate app_session token
    const token = await signSessionToken({
      id: user.id,
      username: user.username || user.email || email,
      name: user.name || "",
      roleId: user.roleId || "",
      roleName: user.role?.name || "",
      permissions: user.role?.permissions || [],
      isOwner: user.isOwner,
      level: user.level || "WORKER",
      mustChangePassword: user.mustChangePassword,
      sess: user.sessionEpoch ?? 0,
    });

    let landingPage = user.mustChangePassword
      ? "/change-password"
      : !user.isOwner &&
          (user.role?.permissions || []).length === 1 &&
          (user.role?.permissions || [])[0] === "terminal.use"
        ? "/terminal"
        : "/";

    if (
      user.prefs &&
      typeof user.prefs === "object" &&
      "landingPage" in user.prefs
    ) {
      landingPage = (user.prefs as any).landingPage as string;
    }

    const redirectUrl = new URL(landingPage, request.url);
    const response = NextResponse.redirect(redirectUrl);

    const proto = request.headers.get("x-forwarded-proto") || "";
    const isHttps = proto === "https" || request.url.startsWith("https://");

    response.cookies.set({
      name: "app_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    response.cookies.delete("google_oauth_state");

    await logAudit({
      actor: user.username || email,
      action: "LOGIN_SUCCESS_GOOGLE",
      entityType: "USER",
      entityId: user.id,
      details: `User ${user.username || email} logged in via Google OAuth`,
    });

    return response;
  } catch (error) {
    console.error("Error in Google OAuth callback API:", error);
    const errorUrl = new URL("/login", request.url);
    errorUrl.searchParams.set("error", "google-not-registered");
    return NextResponse.redirect(errorUrl);
  }
}
