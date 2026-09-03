#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "src/app/api");

let sanitized = 0;
let zodAdded = 0;
let skipped = 0;

function walk(dir, files=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (e.isFile() && e.name === "route.ts") files.push(p);
  }
  return files;
}

const routes = walk(apiRoot);
console.log(`Scanning ${routes.length} route.ts files...`);

for (const file of routes) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;

  // 1. Sanitize 500 leakage: replace `error: error.message` and `details: error.message` in 500 contexts
  // We keep 400 validation messages (they are intentional safe strings), only sanitize inside catch that returns 500.
  // Heuristic: if file contains `status: 500` and `error.message`, sanitize.
  if (content.includes("error.message") && content.includes("500")) {
    // Remove `, details: error.message` fragments
    const before = content;
    content = content.replace(/,\s*details:\s*error\.message/g, "");
    content = content.replace(/,\s*details:\s*error\?.message/g, "");
    // Replace `error: error.message` with generic where status 500 nearby (simple: replace all remaining `error.message` in catch that is not already a validation 400)
    // We do conservative: replace `error: error.message` -> `error: "Internal Server Error"` and `error: error?.message || "Failed...` -> `error: "Internal Server Error"`
    content = content.replace(/error:\s*error\.message/g, 'error: "Internal Server Error"');
    content = content.replace(/error:\s*error\?\.message\s*\|\|\s*"[^"]*"/g, 'error: "Internal Server Error"');
    content = content.replace(/error:\s*error\?\.message/g, 'error: "Internal Server Error"');
    // Also `error: "Failed to ...", details: error.message` already stripped, now ensure first error is generic if it still contains interpolation
    if (content !== before) sanitized++;
  }

  // 2. Add minimal zod guard to POST routes that have no validation at all (no `parseOr400`, no `z.` , no `zod`, no `schema` and do `req.json()` then directly use body without check)
  // We only add a lightweight guard, not per-field schemas, to avoid breaking domain logic — it ensures body is a non-null object.
  const hasPost = content.includes("export async function POST");
  const hasValidation = content.includes("parseOr400") || content.includes("zod") || content.includes("from \"zod\"") || content.includes("from 'zod'") || content.includes("z.") && content.includes("safeParse");
  if (hasPost && !hasValidation) {
    // Check if file already imports parseOr400 or zod — if not, add a minimal guard after `const body = await req.json();` or `await request.json()`
    // Find first occurrence of `await req.json()` or `await request.json()` variant
    const jsonPattern = /const\s+body\s*=\s*await\s+req\.json\(\)\s*;/;
    const reqPattern = /const\s+body\s*=\s*await\s+request\.json\(\)\s*;/;
    let match = content.match(jsonPattern) || content.match(reqPattern);
    if (match) {
      const inject = match[0] + "\n    if (typeof body !== \"object\" || body === null || Array.isArray(body)) {\n      return NextResponse.json({ error: \"Invalid request body\" }, { status: 400 });\n    }";
      content = content.replace(match[0], inject);
      // Ensure NextResponse is imported (it always is), no need to add zod import for this minimal guard
      zodAdded++;
    } else {
      skipped++;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
  }
}

console.log(`Sanitized ${sanitized} files for 500 error.message leakage.`);
console.log(`Added minimal body guard to ${zodAdded} POST routes.`);
console.log(`Skipped ${skipped} routes (no body pattern found).`);
console.log("Done. Run `npx tsc --noEmit` to verify, then `npm run build`.");
