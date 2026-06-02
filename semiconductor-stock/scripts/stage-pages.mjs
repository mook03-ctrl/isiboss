/**
 * GitHub Pages용: out/ → semiconductor-stock/ 루트 복사 (로컬 CI와 동일)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(root, "..");
const outDir = path.join(project, "out");

if (!fs.existsSync(outDir)) {
  console.error("out/ 없음 — 먼저 npm run build 실행");
  process.exit(1);
}

function copyRecursive(src, dest) {
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

copyRecursive(outDir, project);
console.log("Staged static export into semiconductor-stock/");
