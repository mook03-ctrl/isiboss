/**
 * Node 진입점 → PyKRX(Python) bake 실행
 * GitHub Actions / prebuild 공용
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(root, "generate-stock-json.py");

const candidates =
  process.platform === "win32"
    ? [
        { cmd: "py", args: ["-3", script] },
        { cmd: "python", args: [script] },
        { cmd: "python3", args: [script] },
      ]
    : [
        { cmd: "python3", args: [script] },
        { cmd: "python", args: [script] },
      ];

let lastStatus = 1;
for (const { cmd, args } of candidates) {
  // shell: false — 경로에 공백/한글이 있어도 인자가 쪼개지지 않음
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  if (r.error) {
    if (r.error.code === "ENOENT") continue;
    console.error(r.error);
    continue;
  }
  if (r.status === 0) process.exit(0);
  lastStatus = r.status ?? 1;
  // interpreter found but script failed — stop
  process.exit(lastStatus);
}

console.error(
  "Python 실행 실패. `pip install pykrx` 후 다시 시도하세요.\n",
  "script:",
  script
);
process.exit(1);
