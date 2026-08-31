import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

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

    await logAudit({
      actor: "system",
      action: "FILE_UPLOADED",
      entityType: "Attachment",
      details: `File attachment ${file.name} (${(file.size / 1024).toFixed(1)} KB) uploaded`,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public/uploads");

    await fs.mkdir(uploadDir, { recursive: true });

    // Using a predictable name or preserving original name depending on requirement, let's use a unique name
    const ext = path.extname(file.name) || ".png";
    const filename = `logo-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 },
    );
  }
}
