import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !user.isOwner &&
    !canAny(user, ["quality.edit", "ops.edit", "system.edit"])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const toolId = formData.get("toolId") as string | null;
    const file = formData.get("file");

    if (!toolId) {
      return NextResponse.json({ error: "Missing toolId" }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const tool = await prisma.calibratedTool.findUnique({
      where: { id: toolId },
    });
    if (!tool) {
      return NextResponse.json(
        { error: "Calibrated tool not found" },
        { status: 404 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sizeKb = Math.round(bytes.length / 1024);

    if (bytes.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.calibratedTool.update({
        where: { id: toolId },
        data: {
          certFileData: bytes,
          certFileMime: file.type || "application/pdf",
          certFileSizeKb: sizeKb,
        },
      });

      await logAuditTx(tx, {
        actor: user.name || "Crib Clerk",
        action: "CERT_UPLOADED",
        entityType: "CALIBRATED_TOOL",
        entityId: toolId,
        details: `Uploaded calibration certificate for ${tool.name} (${tool.serialNumber}): ${file.name} (${sizeKb} KB)`,
      });
    });

    return NextResponse.json({ success: true, sizeKb, fileName: file.name });
  } catch (error) {
    console.error("POST /api/metrology/cert error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const toolId = searchParams.get("toolId");

  if (!toolId) {
    return NextResponse.json({ error: "Missing toolId" }, { status: 400 });
  }

  try {
    const tool = await prisma.calibratedTool.findUnique({
      where: { id: toolId },
      select: {
        certFileData: true,
        certFileMime: true,
        name: true,
        serialNumber: true,
      },
    });
    if (!tool || !tool.certFileData) {
      return NextResponse.json(
        { error: "No certificate on file" },
        { status: 404 },
      );
    }

    const safeName = (tool.name || tool.serialNumber)
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    return new NextResponse(tool.certFileData, {
      headers: {
        "Content-Type": tool.certFileMime || "application/pdf",
        "Content-Disposition": `inline; filename="cert-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("GET /api/metrology/cert error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
