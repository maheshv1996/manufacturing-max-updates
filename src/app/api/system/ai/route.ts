import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveLLMConfig } from "@/lib/llmGateway";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["system.view", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await getActiveLLMConfig();
    const maskedConfig = {
      ...config,
      apiKey: config.apiKey ? `***${config.apiKey.slice(-4)}` : "",
    };

    return NextResponse.json({ success: true, config: maskedConfig });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const provider = typeof body.provider === "string" ? body.provider : "gemini";
    let apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const model = typeof body.model === "string" ? body.model : (provider === "gemini" ? "gemini-2.0-flash" : provider === "groq" ? "llama-3.3-70b-versatile" : "llama3.2");
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "http://localhost:11434";

    // If apiKey is masked (e.g. ***1234) or empty, retain current stored key
    if (apiKey.startsWith("***") || !apiKey) {
      const existing = await prisma.setting.findUnique({ where: { key: "ai_llm_config" } });
      if (existing?.value) {
        try {
          const parsed = JSON.parse(existing.value);
          if (parsed.apiKey) apiKey = parsed.apiKey;
        } catch {}
      }
    }

    const config = {
      provider,
      apiKey,
      model,
      baseUrl,
    };

    const actor = user.name || user.id || "Admin";

    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "ai_llm_config" },
        update: { value: JSON.stringify(config) },
        create: { key: "ai_llm_config", value: JSON.stringify(config) },
      });

      await logAuditTx(tx, {
        actor,
        action: "AI_SETTINGS_UPDATED",
        entityType: "Setting",
        details: `Updated AI LLM settings: provider=${provider}, model=${model}`,
      });
    });

    const maskedConfig = {
      ...config,
      apiKey: config.apiKey ? `***${config.apiKey.slice(-4)}` : "",
    };

    return NextResponse.json({ success: true, config: maskedConfig });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
