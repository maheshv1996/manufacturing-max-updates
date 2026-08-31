import { NextResponse } from "next/server";
import os from "os";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const totalRamBytes = os.totalmem();
    const totalRamGb = Math.round(totalRamBytes / (1024 * 1024 * 1024));
    const freeRamBytes = os.freemem();
    const freeRamGb = Math.round(freeRamBytes / (1024 * 1024 * 1024));
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Multi-Core Industrial CPU";
    const cpuCores = cpus.length;

    // Check for GPU on Windows
    let gpuName = "Standard Integrated Graphics";
    let hasDedicatedGpu = false;

    try {
      if (process.platform === "win32") {
        const { stdout } = await execPromise("wmic path win32_VideoController get name");
        const lines = stdout.split("\n").map((l) => l.trim()).filter((l) => l && l !== "Name");
        if (lines.length > 0) {
          gpuName = lines[0];
          if (/nvidia|rtx|gtx|radeon/i.test(gpuName)) {
            hasDedicatedGpu = true;
          }
        }
      }
    } catch {}

    // Check if Ollama is installed and running
    let ollamaStatus: "RUNNING" | "INSTALLED_STOPPED" | "NOT_INSTALLED" = "NOT_INSTALLED";
    try {
      const res = await fetch("http://localhost:11434/api/tags", { method: "GET", signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        ollamaStatus = "RUNNING";
      } else {
        ollamaStatus = "INSTALLED_STOPPED";
      }
    } catch {
      // check if executable exists
      try {
        await execPromise("ollama --version");
        ollamaStatus = "INSTALLED_STOPPED";
      } catch {
        ollamaStatus = "NOT_INSTALLED";
      }
    }

    // Determine model recommendations based on RAM and GPU
    let recommendedModelId = "llama3.2:3b";
    if (totalRamGb < 8) {
      recommendedModelId = "llama3.2:1b";
    } else if (totalRamGb >= 32 || (hasDedicatedGpu && totalRamGb >= 16)) {
      recommendedModelId = "llama3.2:3b";
    }

    const availableModels = [
      {
        id: "llama3.2:3b",
        name: "Meta Llama 3.2 (3B)",
        tag: "llama3.2:3b",
        size: "2.0 GB",
        minRamGb: 8,
        recommendedRamGb: 16,
        isRecommended: recommendedModelId === "llama3.2:3b",
        desc: "Optimal balance of aerospace reasoning, work order tracking, and sub-second speed.",
        category: "Balanced Precision (Offline)",
      },
      {
        id: "llama3.2:1b",
        name: "Meta Llama 3.2 (1B)",
        tag: "llama3.2:1b",
        size: "1.1 GB",
        minRamGb: 4,
        recommendedRamGb: 8,
        isRecommended: recommendedModelId === "llama3.2:1b",
        desc: "Ultra-compact and super fast. Fits any low-spec shopfloor tablet or older laptop.",
        category: "Ultra-Lightweight (Offline)",
      },
      {
        id: "deepseek-r1:7b",
        name: "DeepSeek-R1 (7B)",
        tag: "deepseek-r1:7b",
        size: "4.7 GB",
        minRamGb: 16,
        recommendedRamGb: 32,
        isRecommended: totalRamGb >= 24,
        desc: "Heavy engineering reasoning, complex metallurgical 8D analysis, and root-cause logic.",
        category: "Deep Engineering Reasoning (Offline)",
      },
      {
        id: "gemini-cloud",
        name: "Google Gemini Free Cloud API",
        tag: "gemini-2.0-flash",
        size: "0 GB (Cloud)",
        minRamGb: 2,
        recommendedRamGb: 4,
        isRecommended: false,
        desc: "Uses zero computer storage. Fast cloud multimodal reasoning with free API key.",
        category: "Zero-Storage Cloud",
      },
    ];

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
