import { prisma } from "@/lib/prisma";

export interface LLMConfig {
  provider: "gemini" | "ollama" | "groq" | "heuristic";
  apiKey?: string;
  model?: string;
  baseUrl?: string; // e.g. http://localhost:11434
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

// Sliding-window rate limiter: max 60 requests per minute
const requestTimestamps: number[] = [];
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export function checkLlmRateLimit(): boolean {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  requestTimestamps.push(now);
  return true;
}

export async function getActiveLLMConfig(): Promise<LLMConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "ai_llm_config" } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed && parsed.provider) return parsed;
    }
  } catch (err) {
    console.warn("Failed to load AI LLM config from database setting:", err);
  }

  // Check env vars fallback
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }

  // Default to local Ollama or built-in engine
  return {
    provider: "ollama",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL || "deepseek-r1:14b",
  };
}

export async function queryAuraLLM(
  rawPrompt: string,
  systemContext?: string,
): Promise<{ text: string; provider: string; model: string }> {
  const prompt = String(rawPrompt || "").trim();
  if (!prompt) {
    return {
      text: "Please provide a valid question or command for AURA.",
      provider: "Built-in Industrial Engine",
      model: "Rule-Based Guard v1.0",
    };
  }

  if (!checkLlmRateLimit()) {
    return {
      text: "⚠️ Rate limit reached (max 60 queries/min). Please pause for a moment before querying AURA again.",
      provider: "Rate Limiter",
      model: "Sliding Window Guard",
    };
  }

  const config = await getActiveLLMConfig();
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;

  const fullSystemPrompt = `You are AURA (Autonomous Universal Resource Advisor), the master industrial AI for a precision manufacturing enterprise.
You are deeply knowledgeable in AS9100D, ISO 9001, Six Sigma (DMAIC), CNC Machining (Speeds/Feeds/Tool wear), Lean Manufacturing (5S/Kaizen/SMED), SCM MRP planning, and Activity-Based Costing.
Enforce the Human-in-the-Loop safety protocol (you provide structured actionable advice, but human managers authorize execution).
${systemContext || ""}`;

  // 1. GOOGLE GEMINI API
  if (config.provider === "gemini" && config.apiKey) {
    try {
      const modelName = config.model || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${fullSystemPrompt}\n\nUser Request: ${prompt}` }],
            },
          ],
        }),
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, provider: "Google Gemini", model: modelName };
        }
      } else {
        console.warn(`Gemini API returned status ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.warn("Gemini API error, falling back to next provider:", err);
    }
  }

  // 2. LOCAL OLLAMA (Offline / On-Premise)
  if (config.provider === "ollama") {
    try {
      let baseUrl = config.baseUrl || "http://127.0.0.1:11434";
      if (baseUrl.includes("localhost")) {
        baseUrl = baseUrl.replace("localhost", "127.0.0.1");
      }
      const modelName = config.model || "deepseek-r1:14b";
      // Allow up to 90 seconds for local 14B models on CPU/GPU
      const effectiveTimeout = Math.max(timeoutMs, 90000);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeout);

      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelName,
          prompt: `${fullSystemPrompt}\n\nUser: ${prompt}\nAURA:`,
          stream: false,
        }),
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data?.response) {
          // Clean out think tags if present from deepseek-r1 for clean UI display
          const cleanedText = String(data.response).replace(/<think>[\s\S]*?<\/think>/g, "").trim() || data.response;
          return {
            text: cleanedText,
            provider: "Local Ollama (Offline)",
            model: modelName,
          };
        }
      }
    } catch {
      // Ollama service unreachable or timed out
    }
  }

  // 3. GROQ CLOUD API
  if (config.provider === "groq" && config.apiKey) {
    try {
      const modelName = config.model || "llama-3.3-70b-versatile";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: fullSystemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return { text, provider: "Groq Cloud API", model: modelName };
        }
      } else {
        console.warn(`Groq API returned status ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.warn("Groq API error, falling back:", err);
    }
  }

  // 4. BUILT-IN INDUSTRIAL KNOWLEDGE CORE (Intelligent Offline Engine)
  const q = prompt.toLowerCase();
  let advice = "";

  if (q.includes("speed") || q.includes("feed") || q.includes("cutting") || q.includes("lathe") || q.includes("turning") || q.includes("milling") || q.includes("tool") || q.includes("353") || q.includes("inconel")) {
    advice = `⚙️ PRECISION MACHINING & TOOLING ADVICE:
• Surface Cutting Speed Formula: Vc = (π × D × N) / 1000 [m/min]
• Feed Per Tooth: Fz = Vf / (Z × n) [mm/tooth]
• Material Recommendations:
  - Inconel 718: Vc 25–45 m/min, Ceramic/Carbide TiAlN, High-pressure flood coolant (>40 PSI) to prevent work hardening.
  - Tough 353 / EN24 Alloy: Vc 90–140 m/min, feed 0.15–0.25 mm/rev, Seco/Sandvik grade with rigid toolholder to eliminate deep-hole vibration.
  - Ti-6Al-4V Titanium: Vc 40–60 m/min, sharp positive rake, avoid dwell to prevent ignition/notch wear.
• Wear Limit: Spindle load > 85% or flank wear VB > 0.3mm requires mandatory insert indexing.`;
  } else if (q.includes("audit") || q.includes("status") || q.includes("machine") || q.includes("plant") || q.includes("oee") || q.includes("downtime")) {
    advice = `📊 FACTORY OPERATIONS & OEE AUDIT:
• OEE Target: ≥ 85.0% World Class (Availability × Performance × Quality)
• Shopfloor Status Overview:
${systemContext ? systemContext.trim() : "All active machines connected to telemetry."}
• Immediate Recommendations:
  1. Audit machine cycle times against standard routing master (OP10/OP20).
  2. Ensure shift handover logs are signed off by departing shift lead.
  3. Verify all open downtime reasons are categorized with root-cause tags.`;
  } else if (q.includes("quality") || q.includes("fai") || q.includes("as9100") || q.includes("as9102") || q.includes("inspection") || q.includes("first article")) {
    advice = `🛡️ AS9100D & AS9102 FAI QUALITY COMPLIANCE:
• AS9102 Rev C 3-Form Requirements:
  - Form 1: Part Number Accountability & Drawing Revision Lock
  - Form 2: Product Accountability (Raw Material Mill Test Report + Subcontract Heat Treatment/Plating certs)
  - Form 3: Characteristic Accountability (100% ballooned dimension verification)
• Calibration Status: All digital micrometers, verniers, and CMM probes must have valid NIST/NABL calibration tags.
• Heat-Lot Traceability: Maintain 100% serial number tracking through subcontracting delivery challans.`;
  } else {
    advice = `🏭 AURA ENTERPRISE INTELLIGENCE:
I have evaluated your query in the context of your factory's active shopfloor parameters.

${systemContext ? systemContext.trim() + "\n\n" : ""}Key Operational Directives:
1. Enforce Human-in-the-Loop approval for all machine overrides and production plan shifts.
2. Maintain strict batch genealogy for all raw materials and secondary subcontracted processes.
3. For live generative reasoning via Cloud LLMs or local neural weights, ensure Google Gemini or Ollama is configured in System > AI Settings.`;
  }

  return {
    text: advice,
    provider: "AURA Industrial Knowledge Core (Offline)",
    model: "Embedded Precision Rules v2.0",
  };
}
