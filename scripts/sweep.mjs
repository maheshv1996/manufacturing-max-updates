import { spawn } from "child_process";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const root = process.cwd();
const outDir = path.join(root, "screenshots");
fs.mkdirSync(outDir, { recursive: true });

console.log("Starting Next server...");
const server = spawn("npx", ["next", "start", "-p", "3000"], {
  cwd: root,
  env: { ...process.env, PORT: "3000" },
  stdio: "pipe",
  shell: true,
});

let serverOutput = "";
server.stdout.on("data", (d) => { serverOutput += d.toString(); console.log("[server]", d.toString().trim().slice(0,200)); });
server.stderr.on("data", (d) => { serverOutput += d.toString(); console.log("[server-err]", d.toString().trim().slice(0,200)); });

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

console.log("Waiting for http://localhost:3000/api/health...");
const ok = await waitForServer("http://localhost:3000/api/health", 30000);
if (!ok) {
  console.error("Server did not become ready in 30s");
  console.log(serverOutput.slice(-3000));
  server.kill();
  process.exit(1);
}
console.log("Server ready, launching browser...");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const targets = [
  { path: "/landing", file: "01-landing.png" },
  { path: "/login", file: "02-login.png" },
  { path: "/", file: "03-gateway.png" },
  { path: "/command", file: "04-command.png" },
  { path: "/custom", file: "05-custom.png" },
];

for (const t of targets) {
  const url = `http://localhost:3000${t.path}`;
  console.log(`→ ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, t.file), fullPage: true });
    console.log(`  ✓ ${t.file}`);
  } catch (e) {
    console.log(`  ✗ ${t.path} failed: ${e.message}`);
    try { await page.screenshot({ path: path.join(outDir, t.file), fullPage: true }); } catch {}
  }
}

await browser.close();
server.kill();
console.log(`Done. Screenshots in ${outDir}`);
