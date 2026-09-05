// Experiential Labs gateway smoke test
// Reads EXPLABS_API_KEY from environment — never hardcoded.
// Usage: node explabs_smoke.mjs
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency needed)
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()])
      process.env[k.trim()] = v.join("=").trim();
  }
} catch {}

const KEY = process.env.EXPLABS_API_KEY;
if (!KEY) {
  console.error("❌  EXPLABS_API_KEY not set in environment or .env.local");
  process.exit(1);
}

const BASE = "https://api.experientiallabs.ai/v1";
const MODELS = ["claude-fable-5.1", "gpt-6-astra"];

async function chat(model) {
  console.log(`\n▶  Testing model: ${model}`);
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Say hello in one sentence." }],
    }),
  });

  const status = res.status;
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }

  if (!res.ok) {
    console.error(`   ✗  HTTP ${status}:`, JSON.stringify(body, null, 2));
    return { model, ok: false, status, body };
  }

  const reply = body.choices?.[0]?.message?.content ?? "(no content)";
  const usage = body.usage ?? {};
  const cost  = body.cost ?? body.usage?.cost ?? "(not reported)";

  console.log(`   ✓  HTTP ${status}`);
  console.log(`   Reply   : ${reply}`);
  console.log(`   Tokens  : prompt=${usage.prompt_tokens ?? "?"} completion=${usage.completion_tokens ?? "?"}`);
  console.log(`   Cost    : ${typeof cost === "object" ? JSON.stringify(cost) : cost}`);
  return { model, ok: true, status, reply, usage, cost };
}

const results = [];
for (const m of MODELS) results.push(await chat(m));

console.log("\n── Summary ────────────────────────────────");
for (const r of results)
  console.log(`  ${r.ok ? "✓" : "✗"}  ${r.model}  →  ${r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} (failed)`}`);
