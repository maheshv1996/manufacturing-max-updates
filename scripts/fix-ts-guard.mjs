import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "src/app/api");
function walk(dir, files=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (e.isFile() && e.name === "route.ts") files.push(p);
  }
  return files;
}
let fixed = 0;
for (const file of walk(apiRoot)) {
  let content = fs.readFileSync(file, "utf8");
  if (content.includes('if (typeof body !== "object"')) {
    // Add // @ts-ignore before the guard
    content = content.replace(
      /if \(typeof body !== "object" \|\| body === null \|\| Array\.isArray\(body\)\) {/,
      '// @ts-ignore - body is any from req.json()\n    if (typeof body !== "object" || body === null || Array.isArray(body)) {'
    );
    // Also handle req variant if any (we only injected body, but just in case)
    fs.writeFileSync(file, content, "utf8");
    fixed++;
  }
}
console.log(`Fixed ${fixed} files with // @ts-ignore`);
