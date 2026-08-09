/**
 * Node 진입점 → PyKRX(Python) bake 실행
 * GitHub Actions / prebuild 공용
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(root, "generate-stock-json.py");

const candidates = process.platform === "win32"
  ? ["python", "py", "python3"]
  : ["python3", "python"];

let lastErr = null;
for (const cmd of candidates) {
  const args = cmd === "py" ? ["-3", script] : [script];
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (r.error) {
    lastErr = r.error;
    continue;
  }
  if (r.status === 0) process.exit(0);
  lastErr = new Error(`${cmd} exited ${r.status}`);
  // pykrx missing 등으로 실패 시 다음 인터프리터 시도하지 않고 종료 코드 전달
  if (r.status != null && r.status !== 0) process.exit(r.status);
}

console.error(
  "Python 실행 실패. `pip install pykrx` 후 다시 시도하세요.",
  lastErr || ""
);
process.exit(1);
