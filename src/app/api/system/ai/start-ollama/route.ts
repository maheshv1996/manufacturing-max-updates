import { NextResponse } from "next/server";
import { spawn } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 1. Check if Ollama is already responding
    try {
      const ping = await fetch("http://127.0.0.1:11434/api/tags", {
        method: "GET",
        signal: AbortSignal.timeout(1200),
      });
      if (ping.ok) {
        return NextResponse.json({
          success: true,
          status: "ALREADY_RUNNING",
          message: "Ollama background service is already active on port 11434.",
        });
      }
    } catch {}

    // 2. Discover Ollama executable on the workstation
    const username = os.userInfo().username;
    const possibleExes = [
      path.join(
        process.env.LOCALAPPDATA || `C:\\Users\\${username}\\AppData\\Local`,
        "Programs",
        "Ollama",
        "ollama app.exe"
      ),
      path.join(
        process.env.LOCALAPPDATA || `C:\\Users\\${username}\\AppData\\Local`,
        "Programs",
        "Ollama",
        "ollama.exe"
      ),
      "ollama.exe",
      "ollama",
    ];

    let started = false;
    for (const exe of possibleExes) {
      if (fs.existsSync(/*turbopackIgnore: true*/ exe) || !exe.includes("\\")) {
        try {
          const args = exe.endsWith("app.exe") ? [] : ["serve"];
          const child = spawn(/*turbopackIgnore: true*/ exe, args, {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          });
          child.unref();
          started = true;
          break;
        } catch {
          // Try next
        }
      }
    }

    if (!started) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not locate Ollama installation on this workstation. Please install Ollama from https://ollama.com first.",
        },
        { status: 404 }
      );
    }

    // 3. Poll for up to 6 seconds until Ollama is responding
    let isReady = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        const check = await fetch("http://127.0.0.1:11434/api/tags", {
          signal: AbortSignal.timeout(800),
        });
        if (check.ok) {
          isReady = true;
          break;
        }
      } catch {}
    }

    if (isReady) {
      return NextResponse.json({
        success: true,
        status: "RUNNING",
        message: "Ollama background service started successfully.",
      });
    }

    return NextResponse.json({
      success: true,
      status: "STARTING",
      message:
        "Ollama process launched in the background. It will become active shortly.",
    });
  } catch (error: any) {
    console.error("POST /api/system/ai/start-ollama error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start Ollama" },
      { status: 500 }
    );
  }
}
