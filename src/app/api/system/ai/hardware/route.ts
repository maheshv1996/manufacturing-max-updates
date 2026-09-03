import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const totalRamBytes = os.totalmem();
    const totalRamGb = Math.round(totalRamBytes / (1024 * 1024 * 1024));
    const freeRamBytes = os.freemem();
    const freeRamGb = Number((freeRamBytes / (1024 * 1024 * 1024)).toFixed(1));
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Multi-Core Industrial CPU";
    const cpuCores = cpus.length;

    // Detect GPU quietly via in-process inspection (Zero cmd/powershell popups)
    let gpuName = "Integrated GPU / CPU Inference Engine";
    let hasDedicatedGpu = false;

    if (process.platform === "win32") {
      const winDrivers = [
        "C:\\Program Files\\NVIDIA Corporation",
        "C:\\Program Files (x86)\\NVIDIA Corporation",
        "C:\\Program Files\\AMD",
      ];
      for (const d of winDrivers) {
        if (fs.existsSync(/*turbopackIgnore: true*/ d)) {
          hasDedicatedGpu = true;
          gpuName = d.includes("NVIDIA") ? "NVIDIA Dedicated GPU" : "AMD Radeon GPU";
          break;
        }
      }
    }

    const installedOllamaModels: {
      id: string;
      name: string;
      tag: string;
      size: string;
      minRamGb: number;
      recommendedRamGb: number;
      isRecommended: boolean;
      desc: string;
      category: string;
    }[] = [];

    // Check if Ollama is running quietly via in-process HTTP fetch
    let ollamaStatus: "RUNNING" | "INSTALLED_STOPPED" | "NOT_INSTALLED" = "NOT_INSTALLED";

    try {
      const res = await fetch("http://127.0.0.1:11434/api/tags", {
        method: "GET",
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) {
        ollamaStatus = "RUNNING";
        const data = await res.json();
        if (Array.isArray(data.models)) {
          for (const m of data.models) {
            const sizeGb = m.size
              ? (m.size / (1024 * 1024 * 1024)).toFixed(1) + " GB"
              : "Installed";
            const tag = m.model || m.name;
            const isCoder = tag.includes("code") || tag.includes("qwen");
            const isReasoning = tag.includes("deepseek") || tag.includes("r1");

            installedOllamaModels.push({
              id: tag,
              name: `${tag.toUpperCase()} (Installed on Workstation)`,
              tag: tag,
              size: sizeGb,
              minRamGb: 8,
              recommendedRamGb: 16,
              isRecommended: true,
              desc: isReasoning
                ? "Hardware-matched local core! Deep chain-of-thought reasoning for complex root-cause, metallurgy, and machining."
                : isCoder
                  ? "Hardware-matched local core! Code-optimized model for G-code generation, Fanuc macro logic, and script verification."
                  : `Hardware-matched local core! Local private inference with zero cloud latency.`,
              category: "Installed on Workstation",
            });
          }
        }
      } else {
        ollamaStatus = "INSTALLED_STOPPED";
      }
    } catch {
      // API not answering; inspect ~/.ollama filesystem directly (Zero cmd/powershell popups)
      try {
        const ollamaLibDir = path.join(
          os.homedir(),
          ".ollama",
          "models",
          "manifests",
          "registry.ollama.ai",
          "library"
        );
        const username = os.userInfo().username;
        const localOllamaApp = path.join(
          process.env.LOCALAPPDATA || `C:\\Users\\${username}\\AppData\\Local`,
          "Programs",
          "Ollama"
        );

        if (fs.existsSync(ollamaLibDir)) {
          ollamaStatus = "INSTALLED_STOPPED";
          const modelDirs = fs.readdirSync(ollamaLibDir, { withFileTypes: true });
          for (const dirent of modelDirs) {
            if (dirent.isDirectory()) {
              const modelName = dirent.name;
              const tags = fs.readdirSync(path.join(ollamaLibDir, modelName));
              for (const tagFile of tags) {
                const fullTag = `${modelName}:${tagFile}`;
                const isCoder = fullTag.includes("code") || fullTag.includes("qwen");
                const isReasoning = fullTag.includes("deepseek") || fullTag.includes("r1");

                installedOllamaModels.push({
                  id: fullTag,
                  name: `${fullTag.toUpperCase()} (Installed on Workstation)`,
                  tag: fullTag,
                  size: "Installed",
                  minRamGb: 8,
                  recommendedRamGb: 16,
                  isRecommended: true,
                  desc: isReasoning
                    ? "Hardware-matched local core! Deep chain-of-thought reasoning for complex root-cause, metallurgy, and machining."
                    : isCoder
                      ? "Hardware-matched local core! Code-optimized model for G-code generation, Fanuc macro logic, and script verification."
                      : `Hardware-matched local core! Local private inference with zero cloud latency.`,
                  category: "Installed on Workstation",
                });
              }
            }
          }
        } else if (fs.existsSync(localOllamaApp)) {
          ollamaStatus = "INSTALLED_STOPPED";
        } else {
          ollamaStatus = "NOT_INSTALLED";
        }
      } catch {
        ollamaStatus = "NOT_INSTALLED";
      }
    }

    // Default recommendation priority:
    // 1. Installed local models (DeepSeek-R1, Qwen, etc.)
    // 2. Built-in industrial core
    const recommendedModelId =
      installedOllamaModels.length > 0
        ? installedOllamaModels[0].id
        : "built-in-heuristic";

    const standardModels = [
      {
        id: "built-in-heuristic",
        name: "Built-in Industrial Knowledge Core",
        tag: "deterministic-core",
        size: "0 MB (Embedded)",
        minRamGb: 1,
        recommendedRamGb: 2,
        isRecommended: installedOllamaModels.length === 0,
        desc: "Zero-dependency offline engine for AS9100D, speeds/feeds, G-code check, and shopfloor troubleshooting. Always works offline with 0 setup.",
        category: "Always-On Offline Core",
      },
      {
        id: "gemini-cloud",
        name: "Google Gemini 2.0 Flash (Free Cloud)",
        tag: "gemini-2.0-flash",
        size: "Cloud API",
        minRamGb: 2,
        recommendedRamGb: 4,
        isRecommended: false,
        desc: "High-speed multimodal generative reasoning via Google AI Studio free tier. Fast factory reasoning with zero local RAM load.",
        category: "Free Cloud Generative",
      },
      {
        id: "groq-cloud",
        name: "Groq Cloud (Llama 3.3 70B)",
        tag: "llama-3.3-70b-versatile",
        size: "Cloud API (500 t/s)",
        minRamGb: 2,
        recommendedRamGb: 4,
        isRecommended: false,
        desc: "Ultra-fast open-weight reasoning hosted on Groq LPU hardware. 100% free tier key available from console.groq.com.",
        category: "Ultra-Fast Cloud",
      },
      {
        id: "llama3.2:3b",
        name: "Meta Llama 3.2 (3B) - Local Ollama",
        tag: "llama3.2:3b",
        size: "2.0 GB",
        minRamGb: 8,
        recommendedRamGb: 16,
        isRecommended: false,
        desc: "Optimal balance of aerospace reasoning, work order tracking, and sub-second speed running privately on your PC.",
        category: "Balanced Local Ollama",
      },
    ];

    // Filter out standard models that are already in installedOllamaModels
    const existingTags = new Set(installedOllamaModels.map((m) => m.tag));
    const finalStandard = standardModels.filter((m) => !existingTags.has(m.tag));

    const availableModels = [...installedOllamaModels, ...finalStandard];

    return NextResponse.json({
      success: true,
      hardware: {
        totalRamGb,
        freeRamGb,
        cpuModel,
        cpuCores,
        gpuName,
        hasDedicatedGpu,
        ollamaStatus,
      },
      recommendedModelId,
      availableModels,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
