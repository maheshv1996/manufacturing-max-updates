import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const cert = await (prisma as any).materialCert.findUnique({
      where: { id },
    });

    if (!cert || !cert.fileData) {
      return new NextResponse("Cert file not found or no file attached", {
        status: 404,
      });
    }

    const buffer = Buffer.from(cert.fileData);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": cert.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="cert-${cert.heatNumber}.${cert.mimeType?.split("/")[1] || "pdf"}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving cert file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
