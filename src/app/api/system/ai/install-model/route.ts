import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import util from "util";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const execFilePromise = util.promisify(execFile);

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "AI_MODEL_INSTALLED", entityType: "SystemAi", details: "AI Model installed" });
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && user.level !== "MANAGER")) {
      return NextResponse.json({ error: "Forbidden: Admin or Manager level required" }, { status: 403 });
    }

    const { modelId, tag, provider, apiKey } = await req.json();

    if (provider === "gemini") {
      const config = {
        provider: "gemini",
        apiKey: apiKey || "",
        model: "gemini-2.0-flash",
        baseUrl: "https://generativelanguage.googleapis.com",
      };
      await prisma.setting.upsert({
        where: { key: "ai_llm_config" },
        update: { value: JSON.stringify(config) },
        create: { key: "ai_llm_config", value: JSON.stringify(config) },
      });
      return NextResponse.json({ success: true, message: "Activated Google Gemini Cloud AI!" });
    }

    // Local Model Installation via Ollama with strict tag sanitization
    const rawTag = String(tag || modelId || "llama3.2:3b");
    const targetTag = rawTag.replace(/[^a-zA-Z0-9.:_-]/g, "");

    if (!targetTag || targetTag.length > 64) {
      return NextResponse.json({ error: "Invalid model identifier" }, { status: 400 });
    }

    // Attempt to pull model if ollama is present
    try {
      // Direct API pull if service is alive
      const pullRes = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: targetTag, stream: false }),
      });

      if (!pullRes.ok) {
        // Safe execFile without shell expansion
        await execFilePromise("ollama", ["pull", targetTag]);
      }
    } catch (e: any) {
          }

    // Save config in DB
    const config = {
      provider: "ollama",
      model: targetTag,
      baseUrl: "http://localhost:11434",
    };

    await prisma.setting.upsert({
      where: { key: "ai_llm_config" },
      update: { value: JSON.stringify(config) },
      create: { key: "ai_llm_config", value: JSON.stringify(config) },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully configured model ${targetTag}`,
    });
  } catch (error: any) {
    console.error("POST /api/system/ai/install-model error:", error);
    return NextResponse.json({ error: error.message || "Failed to install model" }, { status: 500 });
  }
}
