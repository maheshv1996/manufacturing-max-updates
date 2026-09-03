import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await logAudit({
    actor: "system",
    action: "AI_MODEL_INSTALLED",
    entityType: "SystemAi",
    details: "AI Model installed",
  });

  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    // Allow if user is owner, manager, admin, has system.edit, or in local loopback
    const host = headersList.get("host") || "";
    const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
    if (
      !isLocalhost &&
      user.id &&
      !user.isOwner &&
      user.level !== "MANAGER" &&
      user.level !== "OWNER" &&
      user.roleName !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Admin or Manager level required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { modelId, tag, provider, apiKey } = body;

    // 1. Built-in Offline Industrial Core
    if (provider === "heuristic" || modelId === "built-in-heuristic") {
      const config = {
        provider: "heuristic",
        model: "AURA Industrial Knowledge Core (Offline)",
      };
      await prisma.setting.upsert({
        where: { key: "ai_llm_config" },
        update: { value: JSON.stringify(config) },
        create: { key: "ai_llm_config", value: JSON.stringify(config) },
      });
      return NextResponse.json({
        success: true,
        message:
          "Activated Built-in Industrial Knowledge Core! Works 100% offline with zero external dependencies.",
      });
    }

    // 2. Google Gemini Cloud API
    if (provider === "gemini" || modelId === "gemini-cloud") {
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
      return NextResponse.json({
        success: true,
        message: "Activated Google Gemini 2.0 Flash Cloud AI!",
      });
    }

    // 3. Groq Cloud API
    if (provider === "groq" || modelId === "groq-cloud") {
      const config = {
        provider: "groq",
        apiKey: apiKey || "",
        model: "llama-3.3-70b-versatile",
      };
      await prisma.setting.upsert({
        where: { key: "ai_llm_config" },
        update: { value: JSON.stringify(config) },
        create: { key: "ai_llm_config", value: JSON.stringify(config) },
      });
      return NextResponse.json({
        success: true,
        message: "Activated Groq Cloud Llama 3.3 (70B) Ultra-Fast Engine!",
      });
    }

    // 4. Local Model Installation via Ollama with strict tag sanitization
    const rawTag = String(tag || modelId || "deepseek-r1:14b");
    const targetTag = rawTag.replace(/[^a-zA-Z0-9.:_-]/g, "");

    if (!targetTag || targetTag.length > 64) {
      return NextResponse.json(
        { error: "Invalid model identifier" },
        { status: 400 }
      );
    }

    let isOllamaRunning = false;
    let installedModels: string[] = [];
    try {
      const ping = await fetch("http://127.0.0.1:11434/api/tags", {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (ping.ok) {
        isOllamaRunning = true;
        const data = await ping.json();
        if (Array.isArray(data.models)) {
          installedModels = data.models.map((m: any) =>
            (m.name || m.model || "").toLowerCase()
          );
        }
      }
    } catch {}

    if (!isOllamaRunning) {
      return NextResponse.json(
        {
          error:
            "Ollama is not running on localhost:11434. Please start Ollama on your workstation first.",
        },
        { status: 503 }
      );
    }

    const isAlreadyInstalled = installedModels.some((name) => {
      const target = targetTag.toLowerCase();
      return (
        name === target ||
        name.startsWith(target) ||
        target.startsWith(name)
      );
    });

    // If download requested explicitly (or model is not installed and download=true)
    const isDownloadRequest =
      body.action === "download" || body.download === true;

    if (!isAlreadyInstalled && !isDownloadRequest) {
      return NextResponse.json(
        {
          success: false,
          requiresDownload: true,
          modelTag: targetTag,
          error: `Model '${targetTag}' is not downloaded on your workstation yet. Please click "Download & Install" to pull it into Ollama.`,
        },
        { status: 400 }
      );
    }

    // If downloading via Ollama
    if (isDownloadRequest) {
      try {
        const pullRes = await fetch("http://127.0.0.1:11434/api/pull", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: targetTag,
            stream: true,
          }),
        });

        if (!pullRes.ok) {
          const errText = await pullRes.text();
          return NextResponse.json(
            { error: `Ollama download failed: ${errText || pullRes.statusText}` },
            { status: 502 }
          );
        }

        const reader = pullRes.body?.getReader();
        if (!reader) {
          return NextResponse.json(
            { error: "Failed to read stream from Ollama" },
            { status: 502 }
          );
        }

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }

              // Persist config once download completes
              const config = {
                provider: "ollama",
                model: targetTag,
                baseUrl: "http://127.0.0.1:11434",
              };
              await prisma.setting.upsert({
                where: { key: "ai_llm_config" },
                update: { value: JSON.stringify(config) },
                create: { key: "ai_llm_config", value: JSON.stringify(config) },
              });

              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Transfer-Encoding": "chunked",
          },
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: `Download failed: ${err.message}` },
          { status: 500 }
        );
      }
    }

    // Save config in DB
    const config = {
      provider: "ollama",
      model: targetTag,
      baseUrl: "http://127.0.0.1:11434",
    };

    await prisma.setting.upsert({
      where: { key: "ai_llm_config" },
      update: { value: JSON.stringify(config) },
      create: { key: "ai_llm_config", value: JSON.stringify(config) },
    });

    return NextResponse.json({
      success: true,
      message: isDownloadRequest
        ? `Successfully downloaded and connected ${targetTag}!`
        : `Successfully activated local Ollama model ${targetTag}!`,
    });
  } catch (error: any) {
    console.error("POST /api/system/ai/install-model error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
