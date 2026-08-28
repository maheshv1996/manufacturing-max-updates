import { NextResponse } from "next/server";
import { controlFetch, isDesktopMode } from "@/lib/desktopControl";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDesktopMode()) {
    return NextResponse.json({ phase: "idle" });
  }
  const res = await controlFetch("/update/progress");
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}
