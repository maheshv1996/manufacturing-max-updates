import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    // Auth: upload is privileged — require session and system/exec permission. Proxy already 401s anonymous, but double-check.
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!can(user, "system.edit") && !can(user, "exec.view") && !user.isOwner) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = (formData.get("logo") as File | null) || (formData.get("file") as File | null);

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const settings = await getSettings();
    const maxMb = settings.maxFileUploadMb || 4;
    const maxBytes = maxMb * 1024 * 1024;

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File size exceeds the ${maxMb}MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB).`,
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    const mime = (file.type || "").toLowerCase();
    // SVG needs extra guard: text scrub could hide scripts, but we store as data URI and serve via <img> (no script execution). Still block non-image.
    if (mime && !ALLOWED_LOGO_TYPES.has(mime)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${mime}. Allowed: PNG, JPEG, WEBP, SVG, GIF` },
        { status: 415 },
      );
    }

    // Serverless-safe: store as data URI in Setting.branding (no filesystem on Vercel)
    const buffer = Buffer.from(await file.arrayBuffer());
    // Re-validate size after buffering (defense against Content-Length spoof)
    if (buffer.length > maxBytes) {
      return NextResponse.json({ error: `File exceeds ${maxMb}MB limit` }, { status: 413 });
    }
    const safeMime = ALLOWED_LOGO_TYPES.has(mime) ? mime : "image/png";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${safeMime};base64,${base64}`;

    // Persist into branding JSON so <img src={branding.logoUrl}> works with data URI (no /uploads filesystem needed)
    const existing = await prisma.setting.findUnique({ where: { key: "branding" } });
    let branding: any = {};
    try {
      branding = existing?.value ? JSON.parse(existing.value) : {};
    } catch {
      branding = {};
    }
    branding.logoUrl = dataUrl;

    await prisma.setting.upsert({
      where: { key: "branding" },
      update: { value: JSON.stringify(branding) },
      create: { key: "branding", value: JSON.stringify(branding) },
    });

    await prisma.auditLog.create({
      data: {
        actor: user.name || user.id || "system",
        action: "FILE_UPLOADED",
        entityType: "BRANDING",
        entityId: "branding",
        details: `Branding logo updated: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${safeMime}) by ${user.name || user.id}`,
      },
    });

    return NextResponse.json({ url: dataUrl });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 },
    );
  }
}
