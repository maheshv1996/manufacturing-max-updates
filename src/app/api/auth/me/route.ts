import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id && !user.isOwner) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user });
}
