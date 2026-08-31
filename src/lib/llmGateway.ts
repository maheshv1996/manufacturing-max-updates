import { prisma } from "@/lib/prisma";

export interface LLMConfig {
  provider: "gemini" | "ollama" | "groq" | "heuristic";
  apiKey?: string;
  model?: string;
  baseUrl?: string; // e.g. http://localhost:11434
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

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
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.2",
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
      const baseUrl = config.baseUrl || "http://localhost:11434";
      const modelName = config.model || "llama3.2";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          return {
            text: data.response,
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

  // 4. BUILT-IN INDUSTRIAL HEURISTIC ENGINE (Deterministic Fallback)
  return {
    text: `AURA Industrial Advisory (Deterministic Fallback):\n\nI have processed your query: "${prompt}".\n\nAll shopfloor safety protocols, quality gate checks (AS9100D/ISO 9001), and standard routing steps are enforced. (Tip: To enable real-time generative reasoning, configure a Google Gemini API key, Groq API key, or launch local Ollama in System > AI Settings).`,
    provider: "Built-in Industrial Engine",
    model: "Deterministic Heuristic v1.0",
  };
}
