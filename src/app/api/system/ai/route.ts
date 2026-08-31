import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveLLMConfig } from "@/lib/llmGateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getActiveLLMConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "AI_SETTINGS_UPDATED", entityType: "SystemAi", details: "AI Settings updated" });
  try {
    const body = await req.json();
    const { provider, apiKey, model, baseUrl } = body;

    const config = {
      provider: provider || "gemini",
      apiKey: apiKey || "",
      model: model || (provider === "gemini" ? "gemini-2.0-flash" : provider === "groq" ? "llama-3.3-70b-versatile" : "llama3.2"),
      baseUrl: baseUrl || "http://localhost:11434",
    };

    await prisma.setting.upsert({
      where: { key: "ai_llm_config" },
      update: { value: JSON.stringify(config) },
      create: { key: "ai_llm_config", value: JSON.stringify(config) },
    });

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
