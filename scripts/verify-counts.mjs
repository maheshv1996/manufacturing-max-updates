import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function countFiles(dir, matchName) {
  let count = 0;
  function walk(current) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name === matchName) {
        count++;
      }
    }
  }
  walk(dir);
  return count;
}

const pageCount = countFiles(path.join(root, "src/app"), "page.tsx");
const apiRouteCount = countFiles(path.join(root, "src/app/api"), "route.ts");

const schemaPath = path.join(root, "prisma/schema.prisma");
const schemaContent = fs.readFileSync(schemaPath, "utf8");
const modelCount = (schemaContent.match(/^model\s+\w+/gm) || []).length;
const enumCount = (schemaContent.match(/^enum\s+\w+/gm) || []).length;

const memoryPath = path.join(root, "MEMORY.md");
if (!fs.existsSync(memoryPath)) {
  console.error("FAIL: MEMORY.md not found at " + memoryPath);
  process.exit(1);
}

const memoryContent = fs.readFileSync(memoryPath, "utf8");
const countRegex = /(\d+)\s+pages,\s*(\d+)\s+API routes[^\d]*?(\d+)\s+Prisma models[^\d]*?(\d+)\s+enums/i;
const match = memoryContent.match(countRegex);

const isFix = process.argv.includes("--fix") || process.argv.includes("-u");

if (!match) {
  if (isFix) {
    const updated = memoryContent.replace(
      /# System Memory & State[\s\S]*?\n\n/i,
      `# System Memory & State\n\nThe company brain. Every module listed below was verified against the codebase on this audit:\n${pageCount} pages, ${apiRouteCount} API routes, ${modelCount} Prisma models, ${enumCount} enums. NO UPDATE = NOT DONE.\n\n`
    );
    fs.writeFileSync(memoryPath, updated, "utf8");
    console.log(`[FIXED] Updated MEMORY.md counts to: ${pageCount} pages, ${apiRouteCount} API routes, ${modelCount} models, ${enumCount} enums`);
    process.exit(0);
  }
  console.error("FAIL: Could not parse count line in MEMORY.md (expected format: 'X pages, Y API routes, Z Prisma models, W enums')");
  process.exit(1);
}

const memPages = parseInt(match[1], 10);
const memApis = parseInt(match[2], 10);
const memModels = parseInt(match[3], 10);
const memEnums = parseInt(match[4], 10);

const hasDivergence =
  memPages !== pageCount ||
  memApis !== apiRouteCount ||
  memModels !== modelCount ||
  memEnums !== enumCount;

if (hasDivergence) {
  if (isFix) {
    const updated = memoryContent.replace(
      countRegex,
      `${pageCount} pages, ${apiRouteCount} API routes, ${modelCount} Prisma models, ${enumCount} enums`
    );
    fs.writeFileSync(memoryPath, updated, "utf8");
    console.log(`[FIXED] Updated MEMORY.md counts from (${memPages}/${memApis}/${memModels}/${memEnums}) -> (${pageCount}/${apiRouteCount}/${modelCount}/${enumCount})`);
    process.exit(0);
  }

  console.error("\n=======================================================");
  console.error(" [FAIL] MEMORY.md counts have diverged from codebase!");
  console.error("=======================================================");
  console.error(` Pages (page.tsx):       Codebase: ${pageCount} | MEMORY.md: ${memPages} ${pageCount !== memPages ? "❌ MISMATCH" : "✓"}`);
  console.error(` API routes (route.ts):  Codebase: ${apiRouteCount} | MEMORY.md: ${memApis} ${apiRouteCount !== memApis ? "❌ MISMATCH" : "✓"}`);
  console.error(` Prisma models (model):  Codebase: ${modelCount} | MEMORY.md: ${memModels} ${modelCount !== memModels ? "❌ MISMATCH" : "✓"}`);
  console.error(` Prisma enums (enum):    Codebase: ${enumCount} | MEMORY.md: ${memEnums} ${enumCount !== memEnums ? "❌ MISMATCH" : "✓"}`);
  console.error("=======================================================");
  console.error(" Run 'node scripts/verify-counts.mjs --fix' to synchronize MEMORY.md.\n");
  process.exit(1);
}

console.log(`[PASS] Counts verified in MEMORY.md: ${pageCount} pages, ${apiRouteCount} API routes, ${modelCount} models, ${enumCount} enums.`);
process.exit(0);
