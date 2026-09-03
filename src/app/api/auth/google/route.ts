import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "google-not-registered");
    return NextResponse.redirect(loginUrl);
  }

  const requestUrl = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    requestUrl.protocol.replace(":", "");
  const host = request.headers.get("host") || requestUrl.host;
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  const state = randomBytes(16).toString("hex");

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleAuthUrl.toString());

  const proto = request.headers.get("x-forwarded-proto") || "";
  const isHttps = proto === "https" || request.url.startsWith("https://");

  response.cookies.set({
    name: "google_oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
