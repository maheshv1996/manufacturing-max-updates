import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const doc = await (prisma as any).document.findUnique({
      where: { id },
    });

    if (!doc || !doc.fileData) {
      return new NextResponse("Document not found", { status: 404 });
    }

    const buffer = Buffer.from(doc.fileData);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.title)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving document file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
