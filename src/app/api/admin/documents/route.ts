import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const db = prisma as any;
    const documents = await db.document.findMany({
      select: {
        id: true,
        title: true,
        productId: true,
        operationId: true,
        version: true,
        mimeType: true,
        sizeKb: true,
        status: true,
        uploadedBy: true,
        uploadedAt: true,
        notes: true,
        product: { select: { id: true, name: true, sku: true } },
        operation: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { productId: "asc" },
        { operationId: "asc" },
        { version: "desc" },
      ],
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const actorName = headersList.get("x-user-name") || "Admin";
    const db = prisma as any;

    const contentType = req.headers.get("content-type") || "";

    // Handle Manual Archive Action via JSON
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { action, documentId } = body;

      if (action === "ARCHIVE" && documentId) {
        const doc = await db.document.findUnique({
          where: { id: documentId },
          include: { product: true, operation: true },
        });

        if (!doc) {
          return NextResponse.json(
            { error: "Document not found" },
            { status: 404 },
          );
        }

        const updatedDoc = await db.document.update({
          where: { id: documentId },
          data: { status: "ARCHIVED" },
        });

        await logAudit({
          actor: actorName,
          action: "DOCUMENT_ARCHIVED",
          entityType: "DOCUMENT",
          entityId: documentId,
          details: `Manually archived document '${doc.title}' (REV ${doc.version}) for product ${doc.product?.name}`,
        });

        return NextResponse.json({ success: true, document: updatedDoc });
      }

      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Handle File Upload via Multipart FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const productId = (formData.get("productId") as string) || "";
    const rawOperationId = (formData.get("operationId") as string) || "";
    const notes = (formData.get("notes") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "No file was uploaded." },
        { status: 400 },
      );
    }

    if (!title || !productId) {
      return NextResponse.json(
        { error: "Title and Product are required." },
        { status: 400 },
      );
    }

    // Enforce 4MB Upload Limit (4 * 1024 * 1024 bytes)
    const MAX_SIZE_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds the 4MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please upload a smaller file.`,
        },
        { status: 400 },
      );
    }

    const opId =
      rawOperationId && rawOperationId !== "null" && rawOperationId !== ""
        ? rawOperationId
        : null;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sizeKb = Math.ceil(fileBuffer.length / 1024);
    const mimeType = file.type || "application/octet-stream";

    // Auto-archive existing CURRENT document for product + operation combination
    const existingCurrentDoc = await db.document.findFirst({
      where: {
        productId,
        operationId: opId,
        status: "CURRENT",
      },
      include: { product: true },
    });

    let version = 1;

    if (existingCurrentDoc) {
      version = existingCurrentDoc.version + 1;

      await db.document.update({
        where: { id: existingCurrentDoc.id },
        data: { status: "ARCHIVED" },
      });

      await logAudit({
        actor: actorName,
        action: "DOCUMENT_ARCHIVED",
        entityType: "DOCUMENT",
        entityId: existingCurrentDoc.id,
        details: `Auto-archived REV ${existingCurrentDoc.version} of '${existingCurrentDoc.title}' upon upload of new REV ${version}`,
      });
    }

    const newDoc = await db.document.create({
      data: {
        title,
        productId,
        operationId: opId,
        version,
        mimeType,
        fileData: fileBuffer,
        sizeKb,
        status: "CURRENT",
        uploadedBy: actorName,
        notes: notes || null,
      },
      select: {
        id: true,
        title: true,
        productId: true,
        operationId: true,
        version: true,
        mimeType: true,
        sizeKb: true,
        status: true,
        uploadedBy: true,
        uploadedAt: true,
        notes: true,
        product: { select: { id: true, name: true, sku: true } },
        operation: { select: { id: true, name: true, code: true } },
      },
    });

    await logAudit({
      actor: actorName,
      action: "DOCUMENT_UPLOADED",
      entityType: "DOCUMENT",
      entityId: newDoc.id,
      details: `Uploaded '${newDoc.title}' (REV ${version}) for product ${newDoc.product?.name}`,
    });

    return NextResponse.json({ success: true, document: newDoc });
  } catch (error) {
    console.error("Document API upload error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
